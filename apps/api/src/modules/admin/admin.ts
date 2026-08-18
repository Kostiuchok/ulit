import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { requireAdmin } from "../../lib/jwt.middleware";
import { getSignedUrl } from "../../services/storage.service";
import type { Archiver as ArchiverType } from "archiver";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZipArchive } = require("archiver") as { ZipArchive: new (opts?: Record<string, unknown>) => ArchiverType };
import { Readable } from "stream";
import { Client } from "minio";
import { BookStatus, ModerationStatus, RoyaltyStatus } from "@prisma/client";
import { queuePublishedEmail, scheduleKdpExpiryWarning } from "../../lib/email-queue";
import { enqueueConversionJobs } from "../../services/publishing.service";
import { withAvatarVersion } from "../../lib/coverVersion";

const KDP_SELECT_DAYS = 90;
const WARN_BEFORE_DAYS = 7;

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

// Admin-settable steps of the per-book publication timeline (T-1932).
// "created" (Book.createdAt) and "published" (status===PUBLISHED + isbn) are
// derived, not stored here — see PublicationTimeline.tsx on the frontend for
// the matching ordered list of labels shown to the author.
//
// T-1951: these keys are unchanged, but the author-facing meaning shifted —
// the actual contract (User.contractAcceptedAt) is now signed once, author-
// wide, BEFORE a book can even reach "submitted" (see publish.ts). So by the
// time a book gets here, contract_pending/contract_corrected/review_2 are
// really just "admin wants to re-verify this author's documents for this
// book" checkpoints, not a fresh signature — PublicationTimeline.tsx renders
// them as nested sub-items under one always-signed "Укладання договору" row.
// contract_signed keeps its real job unchanged: it's still the actual
// go-live trigger below (shouldPublish → ISBN + status=PUBLISHED), shown to
// the author as "Публікація у магазинах".
const PUBLICATION_TIMELINE_STEPS = [
  "submitted",
  "review_done",
  "contract_pending",
  "contract_corrected",
  "review_2",
  "contract_signed",
] as const;

const publicationTimelineUpdateSchema = z.object({
  step: z.enum(PUBLICATION_TIMELINE_STEPS),
  date: z.string().datetime().nullable(),
});

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
  description: true,
  status: true,
  moderationStatus: true,
  isbn: true,
  udcCode: true,
  bbkCode: true,
  authorSign: true,
  bookChamberSubmittedAt: true,
  coverUrl: true,
  epubUrl: true,
  fb2Url: true,
  mobiUrl: true,
  printPdfUrl: true,
  priceEbook: true,
  pricePrint: true,
  pricePrintHardcover: true,
  genre: true,
  language: true,
  pageCount: true,
  printPageCount: true,
  distributionStrategy: true,
  distributionChannels: true,
  d2dStatus: true,
  d2dSentAt: true,
  kdpStatus: true,
  kdpSentAt: true,
  googleStatus: true,
  googleSentAt: true,
  publishedAt: true,
  createdAt: true,
  publicationTimeline: true,
  originalDocxUrl: true,
  docxUpdatedAt: true,
  republishRequestedAt: true,
  unpublishedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      contractAcceptedAt: true,
      taxId: true,
      payoutDocument: true,
      bankIban: true,
      payoutDetailsSubmittedAt: true,
    },
  },
} as const;

export async function adminRoutes(app: FastifyInstance) {
  // ─── Stats ────────────────────────────────────────────────────────────────
  app.get("/api/admin/stats", { preHandler: requireAdmin }, async (_request, reply) => {
    const [bookCounts, orderCounts, revenueAgg, royaltiesAgg, recentReview, pendingRepublish] = await Promise.all([
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
        // Books here are never published yet, so publishedAt is normally
        // null -- sorting by it was a no-op. createdAt actually orders the
        // review queue meaningfully (oldest submissions surface, which is
        // also closer to the SLA-deadline urgency the dashboard shows).
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Books already PUBLISHED whose author submitted post-publish changes
      // (RepublishButton.tsx) -- distinct queue from recentReview above,
      // both feed the dashboard's "Книги" action block.
      prisma.book.findMany({
        where: { status: "PUBLISHED", republishRequestedAt: { not: null } },
        select: BOOK_ADMIN_SELECT,
        orderBy: { republishRequestedAt: "desc" },
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
      pendingRepublish,
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
  // T-1951 follow-up: "Схвалити" and "Опублікувати книгу" used to be two
  // separate admin actions (review checkpoint vs. actual go-live), which
  // read as one step to admins in practice — now approving a REVIEW book
  // publishes it in the same click: marks review_done AND does everything
  // the old contract_signed publish trigger did (ISBN, status=PUBLISHED,
  // KDP Select enrollment, notification email). The manual per-step editor
  // on /admin/books/:id/distribute (advanced/collapsed) still exists for the
  // rare case a book needs re-verification or a book was approved before
  // this change without being published.
  app.patch(
    "/api/admin/books/:id/approve",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          status: true,
          title: true,
          isbn: true,
          publicationTimeline: true,
          distributionStrategy: true,
          kdpSelectEnrolled: true,
          kdpSelectExpiry: true,
          author: { select: { id: true, email: true, name: true } },
        },
      });
      if (!book) throw AppError.notFound("Book");

      const now = new Date();
      const timeline = { ...((book.publicationTimeline as Record<string, string>) ?? {}) };
      const shouldPublish = book.status === "REVIEW";

      if (shouldPublish) {
        // A book can only reach REVIEW after being submitted — backfill `submitted`
        // for legacy books that reached REVIEW before that step was tracked, so the
        // author's timeline doesn't show review_done green with submitted still empty.
        if (!timeline.submitted) timeline.submitted = now.toISOString();
        timeline.review_done = now.toISOString();
        timeline.contract_signed = now.toISOString();
      }

      const isbn = book.isbn;
      let kdpSelectEnrolled = book.kdpSelectEnrolled;
      let kdpSelectExpiry = book.kdpSelectExpiry;

      if (shouldPublish) {
        // No auto-generated placeholder ISBN -- a book can go PUBLISHED on
        // Ulit's own store without one (Ridero's reference UX has an
        // explicit "без ISBN" mode too; ISBN is a specific-retailer
        // requirement, e.g. Amazon KDP, not a legal precondition for
        // selling a book at all). The real ISBN only ever comes from the
        // admin manually entering it below, after actually registering with
        // Книжкова палата -- see "Реєстрація ISBN" section.
        const isKdpSelect = book.distributionStrategy === "KDP_SELECT";
        if (isKdpSelect && !kdpSelectEnrolled) {
          kdpSelectEnrolled = true;
          kdpSelectExpiry = new Date(now.getTime() + KDP_SELECT_DAYS * 24 * 60 * 60 * 1000);
        }
      }

      const updated = await prisma.book.update({
        where: { id },
        data: {
          moderationStatus: "APPROVED",
          publicationTimeline: timeline,
          status: shouldPublish ? "PUBLISHED" : undefined,
          publishedAt: shouldPublish ? now : undefined,
          isbn: shouldPublish ? isbn : undefined,
          kdpSelectEnrolled: shouldPublish ? kdpSelectEnrolled : undefined,
          kdpSelectExpiry: shouldPublish ? kdpSelectExpiry : undefined,
        },
        select: BOOK_ADMIN_SELECT,
      });

      if (shouldPublish) {
        queuePublishedEmail({
          email: book.author.email,
          name: book.author.name,
          bookTitle: book.title,
          bookId: id,
          isbn,
        }).catch((err) => console.error("[email] published notification failed:", err));

        if (book.distributionStrategy === "KDP_SELECT" && !book.kdpSelectEnrolled && kdpSelectExpiry) {
          scheduleKdpExpiryWarning(
            { email: book.author.email, name: book.author.name, bookTitle: book.title, bookId: id, expiryDate: kdpSelectExpiry.toISOString() },
            kdpSelectExpiry
          ).catch((err) => console.error("[email] KDP warning schedule failed:", err));
        }
      }

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

  // ─── Publication timeline step update ────────────────────────────────────
  // Real process: submitted -> review_done -> contract_pending/corrected ->
  // review_2 -> contract_signed. Only once admin sets "Договір укладено"
  // does the book actually go live on Ulit (ISBN + PUBLISHED) — everything
  // before that is checkpoint tracking only. Sending to external stores
  // (D2D/KDP/Google) stays a separate manual step via /distribution.
  app.patch(
    "/api/admin/books/:id/publication-timeline",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = publicationTimelineUpdateSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const existing = await prisma.book.findUnique({
        where: { id },
        select: {
          status: true,
          title: true,
          isbn: true,
          publicationTimeline: true,
          distributionStrategy: true,
          kdpSelectEnrolled: true,
          kdpSelectExpiry: true,
          author: { select: { id: true, email: true, name: true } },
        },
      });
      if (!existing) throw AppError.notFound("Book");

      const timeline = { ...((existing.publicationTimeline as Record<string, string>) ?? {}) };
      if (result.data.date) {
        timeline[result.data.step] = result.data.date;
      } else {
        delete timeline[result.data.step];
      }

      const shouldPublish =
        result.data.step === "contract_signed" && !!result.data.date && existing.status !== "PUBLISHED";

      const now = new Date();
      const isbn = existing.isbn;
      let kdpSelectEnrolled = existing.kdpSelectEnrolled;
      let kdpSelectExpiry = existing.kdpSelectExpiry;

      if (shouldPublish) {
        // See the /approve handler above -- no placeholder ISBN generation.
        const isKdpSelect = existing.distributionStrategy === "KDP_SELECT";
        if (isKdpSelect && !kdpSelectEnrolled) {
          kdpSelectEnrolled = true;
          kdpSelectExpiry = new Date(now.getTime() + KDP_SELECT_DAYS * 24 * 60 * 60 * 1000);
        }
      }

      const book = await prisma.book.update({
        where: { id },
        data: {
          publicationTimeline: timeline,
          status: shouldPublish ? "PUBLISHED" : undefined,
          publishedAt: shouldPublish ? now : undefined,
          isbn: shouldPublish ? isbn : undefined,
          kdpSelectEnrolled: shouldPublish ? kdpSelectEnrolled : undefined,
          kdpSelectExpiry: shouldPublish ? kdpSelectExpiry : undefined,
        },
        select: BOOK_ADMIN_SELECT,
      });

      if (shouldPublish) {
        queuePublishedEmail({
          email: existing.author.email,
          name: existing.author.name,
          bookTitle: existing.title,
          bookId: id,
          isbn,
        }).catch((err) => console.error("[email] published notification failed:", err));

        if (existing.distributionStrategy === "KDP_SELECT" && !existing.kdpSelectEnrolled && kdpSelectExpiry) {
          scheduleKdpExpiryWarning(
            { email: existing.author.email, name: existing.author.name, bookTitle: existing.title, bookId: id, expiryDate: kdpSelectExpiry.toISOString() },
            kdpSelectExpiry
          ).catch((err) => console.error("[email] KDP warning schedule failed:", err));
        }
      }

      return reply.send({ book });
    }
  );

  // ─── Republish (post-publish changes) approval ───────────────────────────
  // Author submitted a new .docx for an already-PUBLISHED book (T-1948/T-1949
  // — re-moderation model per docs/TECHNICAL-DECISIONS.md "Референс:
  // республікація змін на Рідеро"). The live book/files stay untouched until
  // an admin reviews and approves here.
  app.patch(
    "/api/admin/books/:id/republish",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: { status: true, originalDocxUrl: true, republishRequestedAt: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.status !== "PUBLISHED" || !book.republishRequestedAt) {
        throw new AppError("Немає змін, що очікують на модерацію", 400, "NO_PENDING_REPUBLISH");
      }
      if (!book.originalDocxUrl) throw new AppError("Немає файлу рукопису", 400, "NO_DOCX");

      await enqueueConversionJobs(id, book.originalDocxUrl, { setProcessing: false });

      const updated = await prisma.book.update({
        where: { id },
        data: { publishedAt: new Date(), republishRequestedAt: null },
        select: BOOK_ADMIN_SELECT,
      });

      return reply.send({ book: updated });
    }
  );

  app.patch(
    "/api/admin/books/:id/republish/reject",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { reason?: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: { status: true, republishRequestedAt: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.status !== "PUBLISHED" || !book.republishRequestedAt) {
        throw new AppError("Немає змін, що очікують на модерацію", 400, "NO_PENDING_REPUBLISH");
      }

      const updated = await prisma.book.update({
        where: { id },
        data: { republishRequestedAt: null, moderationNote: body.reason ?? null },
        select: BOOK_ADMIN_SELECT,
      });

      return reply.send({ book: updated });
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

      // Downloading the ZIP is the admin's signal that files were handed off for
      // upload — mark each book's enabled external channels SENT so the queue
      // (/admin/distribution/queue) reflects it without a separate manual step.
      // Only touches channels actually enabled for that book and still NOT_SENT —
      // never downgrades an already SENT/PUBLISHED/ERROR status.
      const now = new Date();
      const sentUpdates = books.flatMap((book) => {
        const channels = book.distributionChannels ?? [];
        const data: { d2dStatus?: "SENT"; d2dSentAt?: Date; kdpStatus?: "SENT"; kdpSentAt?: Date; googleStatus?: "SENT"; googleSentAt?: Date } = {};
        if (channels.includes("D2D") && book.d2dStatus === "NOT_SENT") {
          data.d2dStatus = "SENT";
          data.d2dSentAt = now;
        }
        if (channels.includes("KDP") && book.kdpStatus === "NOT_SENT") {
          data.kdpStatus = "SENT";
          data.kdpSentAt = now;
        }
        if (channels.includes("GOOGLE") && book.googleStatus === "NOT_SENT") {
          data.googleStatus = "SENT";
          data.googleSentAt = now;
        }
        return Object.keys(data).length > 0 ? [prisma.book.update({ where: { id: book.id }, data })] : [];
      });
      if (sentUpdates.length > 0) {
        await prisma.$transaction(sentUpdates);
      }

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
  app.get("/api/admin/authors", { preHandler: requireAdmin }, async (request, reply) => {
    const { contract } = request.query as { contract?: "signed" | "unsigned" };

    const raw = await prisma.user.findMany({
      where: {
        role: "AUTHOR",
        ...(contract === "signed" ? { contractAcceptedAt: { not: null } } : {}),
        ...(contract === "unsigned" ? { contractAcceptedAt: null } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        avatarUrl: true,
        contractAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { books: true } },
        books: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const authors = raw.map(({ books, ...a }) => ({
      ...withAvatarVersion(a),
      lastBookAt: books[0]?.createdAt ?? null,
    }));

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
        updatedAt: true,
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
            pricePrintHardcover: true,
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
    return reply.send({ author: withAvatarVersion(author) });
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

  // ─── Book signed download URLs ────────────────────────────────────────────
  app.get("/api/admin/books/:id/signed-urls", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const book = await prisma.book.findUnique({
      where: { id },
      select: { pdfUrl: true, epubUrl: true, fb2Url: true, mobiUrl: true, printPdfUrl: true },
    });
    if (!book) throw AppError.notFound("Book");

    const [pdf, epub, fb2, mobi, printPdf] = await Promise.all([
      book.pdfUrl ? getSignedUrl(book.pdfUrl).catch(() => null) : null,
      book.epubUrl ? getSignedUrl(book.epubUrl).catch(() => null) : null,
      book.fb2Url ? getSignedUrl(book.fb2Url).catch(() => null) : null,
      book.mobiUrl ? getSignedUrl(book.mobiUrl).catch(() => null) : null,
      book.printPdfUrl ? getSignedUrl(book.printPdfUrl).catch(() => null) : null,
    ]);

    return reply.send({ pdf, epub, fb2, mobi, printPdf });
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
