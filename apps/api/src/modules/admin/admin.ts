import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { requireAdmin } from "../../lib/jwt.middleware";
import {} from "../../services/storage.service";
import type { Archiver as ArchiverType } from "archiver";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZipArchive } = require("archiver") as { ZipArchive: new (opts?: Record<string, unknown>) => ArchiverType };
import { Readable } from "stream";
import { Client } from "minio";
import { BookStatus, ModerationStatus, RoyaltyStatus } from "@prisma/client";

const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});
const BUCKET = process.env.MINIO_BUCKET_NAME || "knyha-books";

// In-memory service toggles (persists until server restart)
const serviceConfig = { d2d: true, kdp: true, google: true };

const distributionUpdateSchema = z.object({
  d2dStatus: z.enum(["NOT_SENT", "SENT", "PUBLISHED", "ERROR"]).optional(),
  kdpStatus: z.enum(["NOT_SENT", "SENT", "PUBLISHED", "ERROR"]).optional(),
  googleStatus: z.enum(["NOT_SENT", "SENT", "PUBLISHED", "ERROR"]).optional(),
  d2dSentAt: z.string().datetime().nullable().optional(),
  kdpSentAt: z.string().datetime().nullable().optional(),
  googleSentAt: z.string().datetime().nullable().optional(),
});

const BOOK_ADMIN_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  moderationStatus: true,
  isbn: true,
  coverUrl: true,
  epubUrl: true,
  fb2Url: true,
  mobiUrl: true,
  printPdfUrl: true,
  priceEbook: true,
  pricePrint: true,
  genre: true,
  language: true,
  pageCount: true,
  distributionStrategy: true,
  d2dStatus: true,
  d2dSentAt: true,
  kdpStatus: true,
  kdpSentAt: true,
  googleStatus: true,
  googleSentAt: true,
  publishedAt: true,
  createdAt: true,
  author: { select: { id: true, name: true, slug: true, email: true, contractAcceptedAt: true } },
} as const;

export async function adminRoutes(app: FastifyInstance) {
  // ─── Stats ────────────────────────────────────────────────────────────────
  app.get("/api/admin/stats", { preHandler: requireAdmin }, async (_request, reply) => {
    const [bookCounts, orderCounts, revenueAgg, royaltiesAgg, recentReview] = await Promise.all([
      prisma.book.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.order.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.order.aggregate({
        where: { status: { in: ["PAID", "FULFILLED"] } },
        _sum: { total: true },
      }),
      prisma.royalty.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.book.findMany({
        where: { status: "REVIEW" },
        select: BOOK_ADMIN_SELECT,
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),
    ]);

    const books = Object.fromEntries(
      bookCounts.map((b) => [b.status, b._count.id])
    ) as Record<string, number>;
    const orders = Object.fromEntries(
      orderCounts.map((o) => [o.status, o._count.id])
    ) as Record<string, number>;

    return reply.send({
      books: {
        ...books,
        total: bookCounts.reduce((s, b) => s + b._count.id, 0),
      },
      orders: {
        ...orders,
        total: orderCounts.reduce((s, o) => s + o._count.id, 0),
      },
      revenue: Number(revenueAgg._sum.total ?? 0),
      pendingRoyalties: Number(royaltiesAgg._sum.amount ?? 0),
      recentReview,
    });
  });

  // ─── Books list ───────────────────────────────────────────────────────────
  app.get("/api/admin/books", { preHandler: requireAdmin }, async (request, reply) => {
    const { status, moderationStatus, genre, q } = request.query as {
      status?: BookStatus;
      moderationStatus?: ModerationStatus;
      genre?: string;
      q?: string;
    };

    const books = await prisma.book.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(moderationStatus ? { moderationStatus } : {}),
        ...(genre ? { genre } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      select: BOOK_ADMIN_SELECT,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return reply.send({ books });
  });

  // ─── Single book for distribute page ────────────────────────────────────
  app.get("/api/admin/books/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const book = await prisma.book.findUnique({ where: { id }, select: BOOK_ADMIN_SELECT });
    if (!book) throw AppError.notFound("Book");
    return reply.send({ book });
  });

  // ─── Approve ──────────────────────────────────────────────────────────────
  app.patch(
    "/api/admin/books/:id/approve",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: { status: true, title: true },
      });
      if (!book) throw AppError.notFound("Book");

      const updated = await prisma.book.update({
        where: { id },
        data: {
          moderationStatus: "APPROVED",
          status: book.status === "REVIEW" ? "PUBLISHED" : undefined,
          publishedAt: book.status === "REVIEW" ? new Date() : undefined,
        },
        select: BOOK_ADMIN_SELECT,
      });

      return reply.send({ book: updated });
    }
  );

  // ─── Reject ───────────────────────────────────────────────────────────────
  app.patch(
    "/api/admin/books/:id/reject",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { reason?: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: { title: true, author: { select: { email: true, name: true } } },
      });
      if (!book) throw AppError.notFound("Book");

      const updated = await prisma.book.update({
        where: { id },
        data: {
          moderationStatus: "REJECTED",
          status: "DRAFT",
          moderationNote: body.reason ?? null,
        },
        select: BOOK_ADMIN_SELECT,
      });

      app.log.info(
        { bookId: id, reason: body.reason, author: book.author.email },
        "Book rejected"
      );

      return reply.send({ book: updated, reason: body.reason });
    }
  );

  // ─── Distribution status update ──────────────────────────────────────────
  app.patch(
    "/api/admin/books/:id/distribution",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = distributionUpdateSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const data = result.data;
      const book = await prisma.book.update({
        where: { id },
        data: {
          ...(data.d2dStatus !== undefined ? { d2dStatus: data.d2dStatus } : {}),
          ...(data.kdpStatus !== undefined ? { kdpStatus: data.kdpStatus } : {}),
          ...(data.googleStatus !== undefined ? { googleStatus: data.googleStatus } : {}),
          ...(data.d2dSentAt !== undefined
            ? { d2dSentAt: data.d2dSentAt ? new Date(data.d2dSentAt) : null }
            : {}),
          ...(data.kdpSentAt !== undefined
            ? { kdpSentAt: data.kdpSentAt ? new Date(data.kdpSentAt) : null }
            : {}),
          ...(data.googleSentAt !== undefined
            ? { googleSentAt: data.googleSentAt ? new Date(data.googleSentAt) : null }
            : {}),
        },
        select: BOOK_ADMIN_SELECT,
      });

      return reply.send({ book });
    }
  );

  // ─── Download individual file ─────────────────────────────────────────────
  app.get(
    "/api/admin/books/:id/file/:type",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id, type } = request.params as { id: string; type: string };
      const VALID = ["epub", "fb2", "mobi", "print", "cover"] as const;
      if (!VALID.includes(type as (typeof VALID)[number])) {
        return reply.status(400).send({ error: "Invalid file type" });
      }

      const book = await prisma.book.findUnique({ where: { id }, select: BOOK_ADMIN_SELECT });
      if (!book) throw AppError.notFound("Book");

      let objectName: string | null = null;
      let contentType = "application/octet-stream";

      switch (type) {
        case "epub":  objectName = book.epubUrl;     contentType = "application/epub+zip"; break;
        case "fb2":   objectName = book.fb2Url;      contentType = "application/x-fictionbook+xml"; break;
        case "mobi":  objectName = book.mobiUrl;     contentType = "application/x-mobipocket-ebook"; break;
        case "print": objectName = book.printPdfUrl; contentType = "application/pdf"; break;
        case "cover":
          if (book.coverUrl) {
            const filename = book.coverUrl.split("/").pop() ?? "";
            objectName = `public/covers/${filename}`;
            const ext = filename.split(".").pop() ?? "jpg";
            contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
          }
          break;
      }

      if (!objectName) return reply.status(404).send({ error: "File not found" });

      try {
        const stream = await minio.getObject(BUCKET, objectName);
        reply.header("Content-Type", contentType);
        reply.header("Content-Disposition", "attachment");
        return reply.send(stream);
      } catch {
        return reply.status(404).send({ error: "File not found in storage" });
      }
    }
  );

  // ─── Distribution queue ───────────────────────────────────────────────────
  app.get(
    "/api/admin/distribution/queue",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const books = await prisma.book.findMany({
        where: {
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          OR: [
            { d2dStatus: "NOT_SENT", distributionStrategy: "WIDE" },
            { kdpStatus: "NOT_SENT" },
            { googleStatus: "NOT_SENT", distributionStrategy: "WIDE" },
          ],
        },
        select: BOOK_ADMIN_SELECT,
        orderBy: { publishedAt: "desc" },
      });

      return reply.send({ books });
    }
  );

  // ─── Bulk export ─────────────────────────────────────────────────────────
  app.post(
    "/api/admin/distribution/bulk",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { bookIds } = (request.body ?? {}) as { bookIds?: string[] };
      if (!bookIds?.length) {
        return reply.status(400).send({ error: "bookIds is required" });
      }

      const books = await prisma.book.findMany({
        where: { id: { in: bookIds }, status: "PUBLISHED" },
        select: BOOK_ADMIN_SELECT,
      });

      const archive = new ZipArchive({ zlib: { level: 6 } });
      reply.raw.setHeader("Content-Type", "application/zip");
      reply.raw.setHeader("Content-Disposition", `attachment; filename="knyha-bulk.zip"`);
      archive.pipe(reply.raw);

      for (const book of books) {
        const dir = `${book.id.slice(0, 8)}-${book.title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, "_")}`;

        const meta = JSON.stringify(
          {
            title: book.title,
            isbn: book.isbn,
            author: book.author.name,
            priceEbook: book.priceEbook,
            language: book.language,
          },
          null,
          2
        );
        archive.append(meta, { name: `${dir}/metadata.json` });

        const files = [
          { obj: book.epubUrl, name: "book.epub" },
          { obj: book.fb2Url, name: "book.fb2" },
          { obj: book.mobiUrl, name: "book.mobi" },
          { obj: book.printPdfUrl, name: "print.pdf" },
        ];
        for (const f of files) {
          if (!f.obj) continue;
          try {
            const stream = await minio.getObject(BUCKET, f.obj);
            archive.append(stream as unknown as Readable, { name: `${dir}/${f.name}` });
          } catch {
            // skip
          }
        }
      }

      await archive.finalize();
      return reply;
    }
  );

  // ─── Royalties ────────────────────────────────────────────────────────────
  app.get("/api/admin/royalties", { preHandler: requireAdmin }, async (request, reply) => {
    const { status } = request.query as { status?: RoyaltyStatus };
    const royalties = await prisma.royalty.findMany({
      where: status ? { status } : {},
      include: {
        author: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true, isbn: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by author for threshold display
    const byAuthor: Record<string, number> = {};
    for (const r of royalties.filter((r) => r.status === "PENDING")) {
      byAuthor[r.authorId] = (byAuthor[r.authorId] ?? 0) + Number(r.amount);
    }

    return reply.send({ royalties, pendingByAuthor: byAuthor });
  });

  app.post(
    "/api/admin/royalties/:id/pay",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const royalty = await prisma.royalty.update({
        where: { id },
        data: { status: "PAID", paidAt: new Date() },
      });
      return reply.send({ royalty });
    }
  );

  // CSV export
  app.get("/api/admin/royalties/export", { preHandler: requireAdmin }, async (_request, reply) => {
    const royalties = await prisma.royalty.findMany({
      include: {
        author: { select: { name: true, email: true } },
        book: { select: { title: true, isbn: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = [
      "id,author,email,book,isbn,amount,source,status,createdAt,paidAt",
      ...royalties.map((r) =>
        [
          r.id,
          `"${r.author.name}"`,
          r.author.email,
          `"${r.book.title}"`,
          r.book.isbn ?? "",
          Number(r.amount).toFixed(2),
          r.source,
          r.status,
          r.createdAt.toISOString(),
          r.paidAt?.toISOString() ?? "",
        ].join(",")
      ),
    ].join("\n");

    reply.raw.setHeader("Content-Type", "text/csv; charset=utf-8");
    reply.raw.setHeader("Content-Disposition", "attachment; filename=royalties.csv");
    return reply.send(rows);
  });

  // ─── Authors ──────────────────────────────────────────────────────────────
  app.get("/api/admin/authors", { preHandler: requireAdmin }, async (_request, reply) => {
    const authors = await prisma.user.findMany({
      where: { role: "AUTHOR" },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        avatarUrl: true,
        contractAcceptedAt: true,
        createdAt: true,
        _count: { select: { books: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ authors });
  });

  // ─── Author detail ────────────────────────────────────────────────────────
  app.get("/api/admin/authors/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const author = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        avatarUrl: true,
        bio: true,
        role: true,
        contractAcceptedAt: true,
        contractAcceptedIp: true,
        createdAt: true,
        _count: { select: { books: true, orders: true } },
        books: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            moderationStatus: true,
            isbn: true,
            coverUrl: true,
            pdfUrl: true,
            epubUrl: true,
            fb2Url: true,
            mobiUrl: true,
            printPdfUrl: true,
            priceEbook: true,
            pricePrint: true,
            genre: true,
            language: true,
            distributionStrategy: true,
            d2dStatus: true,
            kdpStatus: true,
            googleStatus: true,
            createdAt: true,
            publishedAt: true,
          },
        },
      },
    });
    if (!author) throw AppError.notFound("Author");
    return reply.send({ author });
  });

  // ─── Delete author account ────────────────────────────────────────────────
  app.delete("/api/admin/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!user) throw AppError.notFound("User");
    if (user.role === "ADMIN") throw new AppError("Cannot delete admin accounts", 403, "FORBIDDEN");

    await prisma.$transaction([
      prisma.royalty.deleteMany({ where: { authorId: id } }),
      prisma.royalty.deleteMany({ where: { book: { authorId: id } } }),
      prisma.orderItem.deleteMany({ where: { book: { authorId: id } } }),
      prisma.conversionJob.deleteMany({ where: { book: { authorId: id } } }),
      prisma.book.deleteMany({ where: { authorId: id } }),
      prisma.order.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    return reply.send({ ok: true });
  });

  // ─── Service toggles ──────────────────────────────────────────────────────
  app.get("/api/admin/settings", { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send({ services: serviceConfig });
  });

  app.patch("/api/admin/settings", { preHandler: requireAdmin }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      services?: { d2d?: boolean; kdp?: boolean; google?: boolean };
    };
    if (body.services) {
      if (typeof body.services.d2d === "boolean") serviceConfig.d2d = body.services.d2d;
      if (typeof body.services.kdp === "boolean") serviceConfig.kdp = body.services.kdp;
      if (typeof body.services.google === "boolean") serviceConfig.google = body.services.google;
    }
    return reply.send({ services: serviceConfig });
  });
}

// Re-export for use in liqpay callback (royalty creation)
export async function createSiteRoyalties(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { book: { select: { authorId: true } } } },
    },
  });
  if (!order) return;

  const ROYALTY_RATE = 0.7;

  for (const item of order.items) {
    await prisma.royalty.upsert({
      where: { id: `${orderId}_${item.id}` },
      update: {},
      create: {
        id: `${orderId}_${item.id}`,
        authorId: item.book.authorId,
        bookId: item.bookId,
        amount: Number(item.price) * ROYALTY_RATE,
        source: "SITE",
        status: "PENDING",
      },
    });
  }
}
