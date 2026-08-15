import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { withCoverVersion } from "../../lib/coverVersion";

const BOOK_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  status: true,
  moderationStatus: true,
  moderationNote: true,
  archivedAt: true,
  unpublishedAt: true,
  isbn: true,
  udcCode: true,
  bbkCode: true,
  authorSign: true,
  coverUrl: true,
  backCoverUrl: true,
  spineUrl: true,
  coverImageLibrary: true,
  coverDesign: true,
  originalDocxUrl: true,
  docxUpdatedAt: true,
  republishRequestedAt: true,
  manuscriptImportedAt: true,
  manuscriptEditedAt: true,
  pdfUrl: true,
  epubUrl: true,
  fb2Url: true,
  mobiUrl: true,
  printPdfUrl: true,
  priceEbook: true,
  pricePrint: true,
  pricePrintHardcover: true,
  genre: true,
  subtitle: true,
  ageRating: true,
  aiGenerated: true,
  aiGeneratedNote: true,
  coAuthors: true,
  language: true,
  pageCount: true,
  pagesGeneratedAt: true,
  previewStart: true,
  previewEnd: true,
  distributionStrategy: true,
  distributionChannels: true,
  kdpSelectEnrolled: true,
  kdpSelectExpiry: true,
  d2dStatus: true,
  d2dSentAt: true,
  kdpStatus: true,
  kdpSentAt: true,
  googleStatus: true,
  googleSentAt: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  authorId: true,
  publicationTimeline: true,
  author: { select: { name: true, contractAcceptedAt: true } },
} as const;

const coAuthorSchema = z.object({
  name: z.string().min(1).max(255),
  photoUrl: z.string().url().optional(),
});

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  genre: z.string().max(100).nullable().optional(),
  subtitle: z.string().max(255).nullable().optional(),
  ageRating: z.enum(["0+", "0-6", "6-10", "11-14", "15-17", "18+"]).nullable().optional(),
  aiGenerated: z.boolean().optional(),
  aiGeneratedNote: z.string().max(1000).nullable().optional(),
  coAuthors: z.array(coAuthorSchema).max(10).nullable().optional(),
  language: z.string().length(2).optional(),
  priceEbook: z.number().positive().nullable().optional(),
  pricePrint: z.number().positive().nullable().optional(),
  pricePrintHardcover: z.number().positive().nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).optional(),
  distributionChannels: z.array(z.enum(["ULIT", "D2D", "KDP", "GOOGLE"])).optional(),
  kdpSelectExpiry: z.string().datetime().nullable().optional(),
  coverDesign: z
    .object({
      front: z.array(z.any()),
      backSpine: z.array(z.any()),
      background: z.object({ color: z.string(), imageUrl: z.string().optional() }),
    })
    .optional(),
});

const previewSchema = z.object({
  previewStart: z.number().int().min(1).nullable(),
  previewEnd: z.number().int().min(1).nullable(),
});

async function assertOwnership(bookId: string, userId: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { authorId: true, status: true } });
  if (!book) throw AppError.notFound("Book");
  if (book.authorId !== userId) throw AppError.forbidden("Not your book");
  return book;
}

export async function bookRoutes(app: FastifyInstance) {
  // Get single book
  app.get("/api/books/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await assertOwnership(id, request.user.id);

    const book = await prisma.book.findUnique({ where: { id }, select: BOOK_SELECT });
    return reply.send({ book: withCoverVersion(book) });
  });

  // Update book metadata
  app.patch("/api/books/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await assertOwnership(id, request.user.id);

    const result = patchSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const data = result.data;
    const book = await prisma.book.update({
      where: { id },
      data: {
        ...data,
        priceEbook: data.priceEbook !== undefined ? (data.priceEbook ?? undefined) : undefined,
        pricePrint: data.pricePrint !== undefined ? (data.pricePrint ?? undefined) : undefined,
        pricePrintHardcover: data.pricePrintHardcover !== undefined ? (data.pricePrintHardcover ?? undefined) : undefined,
        kdpSelectExpiry: data.kdpSelectExpiry !== undefined
          ? (data.kdpSelectExpiry ? new Date(data.kdpSelectExpiry) : null)
          : undefined,
        coAuthors: data.coAuthors !== undefined
          ? (data.coAuthors ?? Prisma.JsonNull)
          : undefined,
      },
      select: BOOK_SELECT,
    });

    return reply.send({ book: withCoverVersion(book) });
  });

  // PATCH /api/books/:id/preview — set excerpt range (allowed for any status)
  app.patch("/api/books/:id/preview", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await assertOwnership(id, request.user.id);

    const result = previewSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message });
    }
    const { previewStart, previewEnd } = result.data;

    if (previewStart !== null && previewEnd !== null && previewEnd <= previewStart) {
      return reply.status(400).send({ error: "previewEnd must be greater than previewStart" });
    }

    const book = await prisma.book.update({
      where: { id },
      data: { previewStart, previewEnd },
      select: { id: true, previewStart: true, previewEnd: true, pageCount: true },
    });

    return reply.send({ book: withCoverVersion(book) });
  });

  // Delete book (soft — recoverable via /restore)
  app.delete("/api/books/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await assertOwnership(id, request.user.id);

    if (existing.status === "ARCHIVED") {
      throw new AppError("Book already deleted", 400, "ALREADY_ARCHIVED");
    }

    await prisma.book.update({
      where: { id },
      data: { status: "ARCHIVED", previousStatus: existing.status, archivedAt: new Date() },
    });
    return reply.status(204).send();
  });

  // Restore a soft-deleted book
  app.post("/api/books/:id/restore", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await assertOwnership(id, request.user.id);

    if (existing.status !== "ARCHIVED") {
      throw new AppError("Book is not deleted", 400, "NOT_ARCHIVED");
    }

    const record = await prisma.book.findUnique({ where: { id }, select: { previousStatus: true } });
    const book = await prisma.book.update({
      where: { id },
      data: {
        status: (record?.previousStatus as any) || "DRAFT",
        previousStatus: null,
        archivedAt: null,
      },
      select: BOOK_SELECT,
    });

    return reply.send({ book: withCoverVersion(book) });
  });

  // Unpublish (T-1950): take a PUBLISHED book off sale — hidden from the
  // Ulit store and checkout (store/order queries filter on status ===
  // "PUBLISHED"), external marketplace removal stays the existing manual
  // admin step via PATCH /api/admin/books/:id/distribution. Files, ISBN and
  // publishedAt are left untouched so /relist can bring it straight back.
  // Distinct from DELETE (soft-delete/archive) — the book keeps showing in
  // the author's active books list, not the archived section.
  app.post("/api/books/:id/unpublish", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await assertOwnership(id, request.user.id);

    if (existing.status !== "PUBLISHED") {
      throw new AppError("Ця дія доступна лише для опублікованих книг", 400, "NOT_PUBLISHED");
    }

    const book = await prisma.book.update({
      where: { id },
      data: { status: "UNPUBLISHED", unpublishedAt: new Date() },
      select: BOOK_SELECT,
    });
    return reply.send({ book: withCoverVersion(book) });
  });

  // Relist a previously unpublished book — same files/ISBN as before, goes
  // straight back to PUBLISHED without re-moderation (content hasn't changed
  // since the last approval; a fresh .docx upload still goes through the
  // normal /republish re-moderation flow once live again).
  app.post("/api/books/:id/relist", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await assertOwnership(id, request.user.id);

    if (existing.status !== "UNPUBLISHED") {
      throw new AppError("Книга не знята з публікації", 400, "NOT_UNPUBLISHED");
    }

    const book = await prisma.book.update({
      where: { id },
      data: { status: "PUBLISHED", unpublishedAt: null },
      select: BOOK_SELECT,
    });
    return reply.send({ book: withCoverVersion(book) });
  });
}
