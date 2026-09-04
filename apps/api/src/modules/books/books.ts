import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PRINT_FORMATS,
  PRINT_FORMAT_KEYS,
  ageRatingSchema,
  genreSchema,
  distributionChannelsSchema,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  type PrintFormatKey,
} from "shared-types";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { withCoverVersion } from "../../lib/coverVersion";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  // 120-500 (BookWizard step 1 already enforces this client-side, matching
  // the same shared-types constants) -- required now, not just capped at
  // 5000, so this endpoint can't itself be a way around the requirement
  // every real caller (BookWizard) already applies before ever getting here.
  description: z.string().min(DESCRIPTION_MIN_LENGTH).max(DESCRIPTION_MAX_LENGTH),
  genre: genreSchema.optional(),
  // Book size is its own independent choice in BookWizard, not derived from
  // genre -- see packages/shared-types PRINT_FORMATS for the allowed keys.
  printFormatKey: z.enum(PRINT_FORMAT_KEYS as [string, ...string[]]).optional(),
  language: z.string().length(2).default("uk"),
  // Same enum as book.ts's patchSchema -- BookWizard step 1 already collects
  // this (required there) but it was silently dropped on create since this
  // schema didn't declare it, forcing authors to re-enter it on output-data.
  ageRating: ageRatingSchema.optional(),
  priceEbook: z.number().positive().optional(),
  pricePrint: z.number().positive().optional(),
  pricePrintHardcover: z.number().positive().optional(),
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).default("WIDE"),
  distributionChannels: distributionChannelsSchema.default(["ULIT", "D2D", "KDP", "GOOGLE"]),
});

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function uniqueBookSlug(base: string): Promise<string> {
  const slug = slugifyTitle(base) || `book-${Date.now()}`;
  let candidate = slug;
  let i = 1;
  while (await prisma.book.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}

const listQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional(),
});

export async function booksRoutes(app: FastifyInstance) {
  // List author's books
  app.get("/api/books", { preHandler: authenticate }, async (request, reply) => {
    const { includeArchived } = listQuerySchema.parse(request.query);

    const books = await prisma.book.findMany({
      where: {
        authorId: request.user.id,
        ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        moderationStatus: true,
        coverUrl: true,
        updatedAt: true,
        priceEbook: true,
        pricePrint: true,
        pricePrintHardcover: true,
        genre: true,
        language: true,
        pageCount: true,
        printPageCount: true,
        isbn: true,
        distributionStrategy: true,
        d2dStatus: true,
        kdpStatus: true,
        googleStatus: true,
        publicationTimeline: true,
        createdAt: true,
        publishedAt: true,
        archivedAt: true,
      },
    });
    return reply.send({ books: books.map(withCoverVersion) });
  });

  // Create draft book
  app.post("/api/books", { preHandler: authenticate }, async (request, reply) => {
    const result = createSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { title, description, genre, printFormatKey, language, ageRating, priceEbook, pricePrint, pricePrintHardcover, distributionStrategy } = result.data;
    const slug = await uniqueBookSlug(title);

    // Explicit, independent from genre -- if the wizard sent a known format
    // key, lock it in now so upload validation/cover geometry/output-data all
    // use it from the start instead of falling back to a genre-derived guess.
    const format = printFormatKey ? PRINT_FORMATS[printFormatKey as PrintFormatKey] : undefined;

    const book = await prisma.book.create({
      data: {
        slug,
        title,
        description,
        genre,
        printFormatKey: format?.key,
        printWidthMm: format?.widthMm,
        printHeightMm: format?.heightMm,
        language,
        ageRating,
        priceEbook: priceEbook ? priceEbook : undefined,
        pricePrint: pricePrint ? pricePrint : undefined,
        pricePrintHardcover: pricePrintHardcover ? pricePrintHardcover : undefined,
        distributionStrategy,
        authorId: request.user.id,
        status: "DRAFT",
      },
    });

    return reply.status(201).send({ book });
  });
}
