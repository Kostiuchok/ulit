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
  getPublishReadinessFields,
  type RejectionReasonKey,
  type PrintFormatKey,
} from "shared-types";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { withCoverVersion } from "../../lib/coverVersion";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  // A book is created from its title alone (the "Створити книжку" dialog,
  // owner's decision 2026-10-06 -- the creation wizard is gone). Everything
  // else is filled in on the book's own pages. The annotation is optional
  // HERE but, when sent, must already be valid (120-500) so this endpoint
  // can't store a value the edit form would immediately flag; it stays
  // REQUIRED for publishing (PUBLISH_FIELD_CHECKS, shared-types).
  description: z.string().min(DESCRIPTION_MIN_LENGTH).max(DESCRIPTION_MAX_LENGTH).optional(),
  genre: genreSchema.optional(),
  // Book size is its own independent choice, not derived from genre -- see
  // packages/shared-types PRINT_FORMATS for the allowed keys. Defaults to
  // DEFAULT_PRINT_FORMAT_KEY below when omitted.
  printFormatKey: z.enum(PRINT_FORMAT_KEYS as [string, ...string[]]).optional(),
  language: languageSchema.default("uk"),
  // Same enum as book.ts's patchSchema.
  ageRating: ageRatingSchema.optional(),
  priceEbook: priceFieldSchema,
  pricePrint: priceFieldSchema,
  pricePrintHardcover: priceFieldSchema,
  pricePrintBw: priceFieldSchema,
  pricePrintHardcoverBw: priceFieldSchema,
  // Distribution channels are never set here -- the new draft takes the
  // column default and the author changes them on «Ціна» (PATCH /api/books/:id).
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).default("WIDE"),
  // Normally omitted: the server fills the book's author from the account
  // profile (profileBookAuthor below). Same bookAuthorSchema book.ts's PATCH
  // validates against.
  bookAuthors: z.array(bookAuthorSchema).max(10).optional(),
});

// The size a new book starts with -- the first entry of the "Розмір книги"
// selector, and what the removed wizard preselected.
const DEFAULT_PRINT_FORMAT_KEY: PrintFormatKey = "standard";

// The account owner as the book's first author, or null when the profile has
// no first/last name yet (the author then adds themselves on «Вихідні дані»,
// which flags the empty block). Checked against bookAuthorSchema like any
// hand-typed author; a photo address that fails it is dropped rather than
// costing the author the whole entry.
export function profileBookAuthor(profile: {
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  avatarUrl?: string | null;
} | null): z.infer<typeof bookAuthorSchema> | null {
  if (!profile) return null;
  const base = {
    lastName: profile.lastName?.trim() ?? "",
    firstName: profile.firstName?.trim() ?? "",
    middleName: profile.patronymic?.trim() || undefined,
  };
  const withPhoto = bookAuthorSchema.safeParse({ ...base, photoUrl: profile.avatarUrl?.trim() || undefined });
  if (withPhoto.success) return withPhoto.data;
  const withoutPhoto = bookAuthorSchema.safeParse(base);
  return withoutPhoto.success ? withoutPhoto.data : null;
}

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
        coverThumbUrl: true,
        coverUpdatedAt: true,
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
        moderationReasons: true,
        moderationFieldSnapshot: true,
        // Journal #32 -- printFormatKey was missing here entirely, silently
        // (no type error: every PublishStepBook field is optional), which
        // left isReadyToPublish permanently false and `needsAttention`
        // permanently `true` for EVERY book on the platform regardless of
        // actual readiness. Rather than hand-list the readiness fields here
        // (the exact kind of parallel list that caused that bug -- adding a
        // new PUBLISH_FIELD_CHECKS entry gives no signal that THIS select
        // also needs editing), this spreads getPublishReadinessFields()
        // (shared-types), which derives the field list directly from the
        // check functions themselves by recording which properties they
        // actually read. A future required field is selected here with zero
        // additional edits -- see that function's own comment for how/why
        // this holds even for the `price` check's OR-chain of 7 fields.
        // Sends a few fields (ageRating, authorBio, bookAuthors,
        // printFormatKey, originalDocxUrl/pdfUrl/epubUrl,
        // pricePrintBw/HardcoverBw, desiredRoyaltyAmount(Print)) the list UI
        // doesn't otherwise display -- deliberately not hand-stripped
        // afterwards either, for the same reason: a hand-maintained strip
        // list is just as capable of silently drifting as a hand-maintained
        // select was.
        ...(Object.fromEntries(getPublishReadinessFields().map((f) => [f, true])) as Record<string, true>),
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
      return { ...book, needsAttention };
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
      distributionStrategy,
    } = result.data;
    const slug = await uniqueBookSlug(title);

    // Locked in from the start so upload validation, cover geometry and
    // output-data never fall back to a genre-derived guess.
    const format = PRINT_FORMATS[(printFormatKey as PrintFormatKey | undefined) ?? DEFAULT_PRINT_FORMAT_KEY];

    let bookAuthors = result.data.bookAuthors;
    if (!bookAuthors || bookAuthors.length === 0) {
      const profile = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { firstName: true, lastName: true, patronymic: true, avatarUrl: true },
      });
      const fromProfile = profileBookAuthor(profile);
      bookAuthors = fromProfile ? [fromProfile] : undefined;
    }

    const book = await prisma.book.create({
      data: {
        slug,
        title,
        description,
        genre,
        printFormatKey: format.key,
        printWidthMm: format.widthMm,
        printHeightMm: format.heightMm,
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
