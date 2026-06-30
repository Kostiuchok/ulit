import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const BOOK_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  status: true,
  moderationStatus: true,
  moderationNote: true,
  isbn: true,
  coverUrl: true,
  originalDocxUrl: true,
  pdfUrl: true,
  epubUrl: true,
  fb2Url: true,
  mobiUrl: true,
  printPdfUrl: true,
  priceEbook: true,
  pricePrint: true,
  genre: true,
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
} as const;

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  genre: z.string().max(100).nullable().optional(),
  language: z.string().length(2).optional(),
  priceEbook: z.number().positive().nullable().optional(),
  pricePrint: z.number().positive().nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).optional(),
  distributionChannels: z.array(z.enum(["ULIT", "D2D", "KDP", "GOOGLE"])).optional(),
  kdpSelectExpiry: z.string().datetime().nullable().optional(),
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
    return reply.send({ book });
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
        kdpSelectExpiry: data.kdpSelectExpiry !== undefined
          ? (data.kdpSelectExpiry ? new Date(data.kdpSelectExpiry) : null)
          : undefined,
      },
      select: BOOK_SELECT,
    });

    return reply.send({ book });
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

    return reply.send({ book });
  });

  // Delete book
  app.delete("/api/books/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await assertOwnership(id, request.user.id);

    if (existing.status === "PUBLISHED") {
      throw new AppError("Published books cannot be deleted", 400, "BOOK_PUBLISHED");
    }

    await prisma.book.delete({ where: { id } });
    return reply.status(204).send();
  });
}
