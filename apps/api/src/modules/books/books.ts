import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PRINT_FORMATS,
  PRINT_FORMAT_KEYS,
  ageRatingSchema,
  genreSchema,
  languageSchema,
  bookAuthorSchema,
  priceFieldSchema,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  isReadyToPublish,
  isRejectionReasonResolved,
  type RejectionReasonKey,
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
  language: languageSchema.default("uk"),
  // Same enum as book.ts's patchSchema -- BookWizard step 1 already collects
  // this (required there) but it was silently dropped on create since this
  // schema didn't declare it, forcing authors to re-enter it on output-data.
  ageRating: ageRatingSchema.optional(),
  priceEbook: priceFieldSchema,
  pricePrint: priceFieldSchema,
  pricePrintHardcover: priceFieldSchema,
  pricePrintBw: priceFieldSchema,
  pricePrintHardcoverBw: priceFieldSchema,
  // Real distribution channel selection never arrives here -- BookWizard
  // collects it on step 2, AFTER this draft already exists, via the
  // dedicated PATCH /api/books/:id/distribution (distribution.ts's own
  // switchSchema, already the real source of truth). A `distributionChannels`
  // field used to live in this schema too, parsed/defaulted but never
  // destructured or passed to prisma.book.create() below -- dead code,
  // removed (book-form-validation-audit.md's C.13 candidate).
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).default("WIDE"),
  // BookWizard shows the author's account-profile name as a read-only badge
  // ("ці дані беруться з Кабінету автора") and submits it here on create --
  // same bookAuthorSchema book.ts's PATCH already validates against, so even
  // auto-derived data (not hand-typed) is checked, not just trusted.
  bookAuthors: z.array(bookAuthorSchema).max(10).optional(),
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
        // Selected only to compute `needsAttention` below -- stripped from
        // the response afterwards, the list UI never needed these directly.
        ageRating: true,
        originalDocxUrl: true,
        pdfUrl: true,
        epubUrl: true,
        docxUpdatedAt: true,
        bookAuthors: true,
        pricePrintBw: true,
        pricePrintHardcoverBw: true,
        desiredRoyaltyAmount: true,
        desiredRoyaltyAmountPrint: true,
        moderationReasons: true,
        moderationFieldSnapshot: true,
      },
    });

    // T-2078 -- replaces the old "unread notification" badge (a book you'd
    // already opened once looked "fine" forever after, even if the
    // underlying rejection was never actually fixed). This is a live
    // computed state instead: true while either (a) the admin's rejection
    // has a reason whose flagged field still matches its snapshot value
    // (same "resolved" check output-data's own red-border banner uses), or
    // (b) isReadyToPublish (shared-types) -- the exact same check that
    // gates output-data's "Публікація" nav pill -- is false. Never derived
    // from moderationStatus alone: it would stay REJECTED forever until the
    // author actually resubmits, even after every flagged field is fixed.
    const withFlags = books.map((book) => {
      const snapshot = (book.moderationFieldSnapshot as Partial<Record<RejectionReasonKey, unknown>> | null) ?? null;
      const hasUnresolvedRejection = (book.moderationReasons as RejectionReasonKey[]).some(
        (key) => !isRejectionReasonResolved(key, book, snapshot)
      );
      const needsAttention = hasUnresolvedRejection || !isReadyToPublish(book);
      const {
        ageRating, originalDocxUrl, pdfUrl, epubUrl, docxUpdatedAt, bookAuthors,
        pricePrintBw, pricePrintHardcoverBw, desiredRoyaltyAmount, desiredRoyaltyAmountPrint,
        moderationReasons, moderationFieldSnapshot,
        ...rest
      } = book;
      return { ...rest, needsAttention };
    });

    return reply.send({ books: withFlags.map(withCoverVersion) });
  });

  // Create draft book
  app.post("/api/books", { preHandler: authenticate }, async (request, reply) => {
    const result = createSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const {
      title, description, genre, printFormatKey, language, ageRating,
      priceEbook, pricePrint, pricePrintHardcover, pricePrintBw, pricePrintHardcoverBw,
      distributionStrategy, bookAuthors,
    } = result.data;
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
        pricePrintBw: pricePrintBw ? pricePrintBw : undefined,
        pricePrintHardcoverBw: pricePrintHardcoverBw ? pricePrintHardcoverBw : undefined,
        distributionStrategy,
        bookAuthors: bookAuthors && bookAuthors.length > 0 ? bookAuthors : undefined,
        authorId: request.user.id,
        status: "DRAFT",
      },
    });

    return reply.status(201).send({ book });
  });
}
