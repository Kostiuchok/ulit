import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  GENRE_TO_PRINT_FORMAT,
  PRINT_FORMATS,
  PRINT_FORMAT_KEYS,
  ageRatingSchema,
  distributionChannelsSchema,
  bookAuthorSchema,
  getRequiredDescriptionMinLength,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from "shared-types";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { withCoverVersion } from "../../lib/coverVersion";
import { validateIsbn13 } from "../../services/isbn.service";

const BOOK_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  status: true,
  moderationStatus: true,
  moderationNote: true,
  moderationReasons: true,
  moderationCustomNote: true,
  moderationFieldSnapshot: true,
  archivedAt: true,
  unpublishedAt: true,
  isbn: true,
  udcCode: true,
  authorSign: true,
  copyrightYear: true,
  copyrightHolder: true,
  priorPublicationCertificate: true,
  coverUrl: true,
  backCoverUrl: true,
  spineUrl: true,
  coverImageLibrary: true,
  coverDesign: true,
  originalDocxUrl: true,
  docxUpdatedAt: true,
  republishRequestedAt: true,
  pendingTitle: true,
  pendingDescription: true,
  pendingGenre: true,
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
  pricePrintBw: true,
  pricePrintHardcoverBw: true,
  genre: true,
  printFormatKey: true,
  printWidthMm: true,
  printHeightMm: true,
  bookAuthors: true,
  contributors: true,
  authorBio: true,
  coverIndependentFromBookData: true,
  desiredRoyaltyAmount: true,
  desiredRoyaltyAmountPrint: true,
  subtitle: true,
  ageRating: true,
  aiGenerated: true,
  aiGeneratedNote: true,
  coAuthors: true,
  language: true,
  pageCount: true,
  printPageCount: true,
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

// bookAuthorSchema now lives in shared-types -- apps/web's output-data page
// (the "Автори книги" add-author form) validates against the exact same
// rules, instead of its own looser ad hoc `.trim()` checks.

// T-2060 п.5 -- "Над книгою працювали", separate from bookAuthors/coAuthors.
const contributorSchema = z.object({
  role: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
});

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  // 120-500 enforced on save now, not just at publish time (PUBLISH_FIELD_CHECKS)
  // -- see the description cross-check below the zod parse, which additionally
  // raises the minimum when a distribution channel with its own stricter
  // preference (KDP/Google) is enabled.
  description: z.string().min(DESCRIPTION_MIN_LENGTH).max(DESCRIPTION_MAX_LENGTH).nullable().optional(),
  genre: z.string().max(100).nullable().optional(),
  printFormatKey: z.enum(PRINT_FORMAT_KEYS as [string, ...string[]]).nullable().optional(),
  printWidthMm: z.number().int().positive().nullable().optional(),
  printHeightMm: z.number().int().positive().nullable().optional(),
  subtitle: z.string().max(255).nullable().optional(),
  ageRating: ageRatingSchema.nullable().optional(),
  aiGenerated: z.boolean().optional(),
  aiGeneratedNote: z.string().max(1000).nullable().optional(),
  coAuthors: z.array(coAuthorSchema).max(10).nullable().optional(),
  bookAuthors: z.array(bookAuthorSchema).max(10).nullable().optional(),
  contributors: z.array(contributorSchema).max(20).nullable().optional(),
  authorBio: z.string().max(3000).nullable().optional(),
  // Only relevant for a book that was already published elsewhere before
  // joining ULIT -- freely re-editable, no special validation (unlike isbn
  // itself, which has its own dedicated PATCH /api/books/:id/claim-isbn).
  copyrightYear: z.string().max(4).nullable().optional(),
  copyrightHolder: z.string().max(255).nullable().optional(),
  priorPublicationCertificate: z.string().max(100).nullable().optional(),
  coverIndependentFromBookData: z.boolean().optional(),
  desiredRoyaltyAmount: z.number().positive().nullable().optional(),
  desiredRoyaltyAmountPrint: z.number().positive().nullable().optional(),
  language: z.string().length(2).optional(),
  priceEbook: z.number().positive().nullable().optional(),
  pricePrint: z.number().positive().nullable().optional(),
  pricePrintHardcover: z.number().positive().nullable().optional(),
  pricePrintBw: z.number().positive().nullable().optional(),
  pricePrintHardcoverBw: z.number().positive().nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).optional(),
  distributionChannels: distributionChannelsSchema.optional(),
  kdpSelectExpiry: z.string().datetime().nullable().optional(),
  coverDesign: z
    .object({
      front: z.array(z.any()),
      backSpine: z.array(z.any()),
      // left/top/scaleX/scaleY -- the author's own pan/zoom/crop of the
      // background image, so it survives a format switch or reload instead
      // of resetting to the auto-centered cover-fit every time. layoutW/H --
      // the cover's total width/height this was captured at, so it can be
      // rescaled proportionally on restore into a different-width format.
      background: z.object({
        color: z.string(),
        imageUrl: z.string().optional(),
        left: z.number().optional(),
        top: z.number().optional(),
        scaleX: z.number().optional(),
        scaleY: z.number().optional(),
        layoutW: z.number().optional(),
        layoutH: z.number().optional(),
      }),
    })
    .optional(),
});

const previewSchema = z.object({
  previewStart: z.number().int().min(1).nullable(),
  previewEnd: z.number().int().min(1).nullable(),
});

async function assertOwnership(bookId: string, userId: string) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      authorId: true,
      status: true,
      printWidthMm: true,
      printHeightMm: true,
      title: true,
      description: true,
      genre: true,
      distributionChannels: true,
    },
  });
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

    // The zod schema above already enforces Ulit's own flat 120-500 window
    // on `description` in isolation, but a channel like Amazon KDP prefers a
    // longer annotation (250+) than Ulit's own floor -- once KDP is one of
    // the book's enabled channels, that becomes a real save-time
    // requirement, not just the informational badge output-data already
    // showed. Checked against the EFFECTIVE post-patch state (whichever of
    // description/distributionChannels this request actually changes,
    // falling back to what's already on the book) since either one changing
    // can newly violate the other -- enabling KDP without a long-enough
    // annotation, or shortening the annotation while KDP is already enabled.
    if (data.description !== undefined || data.distributionChannels !== undefined) {
      const effectiveDescription = data.description !== undefined ? data.description : existing.description;
      const effectiveChannels = data.distributionChannels !== undefined ? data.distributionChannels : existing.distributionChannels;
      const requiredMin = getRequiredDescriptionMinLength(effectiveChannels);
      const effectiveLength = (effectiveDescription ?? "").trim().length;
      if (effectiveLength > 0 && effectiveLength < requiredMin) {
        return reply.status(400).send({
          error: `Анотація має містити щонайменше ${requiredMin} символів для обраних платформ розповсюдження (зараз ${effectiveLength})`,
          code: "VALIDATION_ERROR",
        });
      }
    }

    // Book size is now its own independent choice (BookWizard's "Розмір
    // книги" selector, not derived from genre) -- genre only still supplies a
    // one-time fallback default here, for a book that has no print size on
    // record at all yet (existing.printWidthMm/printHeightMm both null,
    // e.g. created before this field existed, or via an API call that
    // omitted printFormatKey). Once a book has ANY size on record -- explicit
    // or previously auto-derived -- editing genre afterwards never touches
    // it again, so genre and size stay decoupled from here on.
    let printFormatOverride: { printFormatKey: string; printWidthMm: number; printHeightMm: number } | undefined;
    if (
      data.genre !== undefined &&
      data.printWidthMm === undefined &&
      data.printHeightMm === undefined &&
      existing.printWidthMm == null &&
      existing.printHeightMm == null
    ) {
      const formatKey = data.genre ? GENRE_TO_PRINT_FORMAT[data.genre] : undefined;
      const format = formatKey ? PRINT_FORMATS[formatKey] : PRINT_FORMATS.standard;
      printFormatOverride = { printFormatKey: format.key, printWidthMm: format.widthMm, printHeightMm: format.heightMm };
    }

    // Назва/Анотація/Жанр on an already-PUBLISHED book stage into pending*
    // instead of writing live -- same re-moderation model already used for
    // manuscript changes (originalDocxUrl/docxUpdatedAt, republishRequestedAt):
    // the live storefront listing must not change until an admin approves
    // via POST .../republish + PATCH .../admin/books/:id/republish. Anything
    // else in this same PATCH (subtitle, print format, language, age rating,
    // authors, bio, price, distribution...) still applies immediately, as
    // before -- only these three are considered "sensitive" content that
    // moderation actually reviews.
    const isPublished = existing.status === "PUBLISHED";
    const stageTitle = isPublished && data.title !== undefined && data.title !== existing.title;
    const stageDescription =
      isPublished && data.description !== undefined && (data.description ?? null) !== (existing.description ?? null);
    const stageGenre = isPublished && data.genre !== undefined && (data.genre ?? null) !== (existing.genre ?? null);

    const book = await prisma.book.update({
      where: { id },
      data: {
        ...data,
        ...printFormatOverride,
        title: stageTitle ? undefined : data.title,
        description: stageDescription ? undefined : data.description,
        genre: stageGenre ? undefined : data.genre,
        pendingTitle: stageTitle ? data.title : undefined,
        pendingDescription: stageDescription ? data.description : undefined,
        pendingGenre: stageGenre ? data.genre : undefined,
        // No override needed for priceEbook/pricePrint/pricePrintHardcover/
        // pricePrintBw/pricePrintHardcoverBw (unlike kdpSelectExpiry/
        // coAuthors/etc. below, which map a JSON null to a Prisma-specific
        // null marker) -- the `...data` spread above already passes an
        // explicit `null` straight through as-is, which Prisma correctly
        // treats as "clear this column", exactly like desiredRoyaltyAmount/
        // desiredRoyaltyAmountPrint (same nullable().optional() schema,
        // also with no override). A previous `field ?? undefined` override
        // here silently coerced an explicit null BACK to undefined --
        // Prisma treats undefined as "don't touch this column" -- so
        // clearing a price via this endpoint never actually reached the DB.
        kdpSelectExpiry: data.kdpSelectExpiry !== undefined
          ? (data.kdpSelectExpiry ? new Date(data.kdpSelectExpiry) : null)
          : undefined,
        coAuthors: data.coAuthors !== undefined
          ? (data.coAuthors ?? Prisma.JsonNull)
          : undefined,
        bookAuthors: data.bookAuthors !== undefined
          ? (data.bookAuthors ?? Prisma.JsonNull)
          : undefined,
        contributors: data.contributors !== undefined
          ? (data.contributors ?? Prisma.JsonNull)
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

  // PATCH /api/books/:id/claim-isbn — a book already published elsewhere
  // before joining ULIT may already have a real ISBN of its own; this lets
  // the author record it directly as this book's ISBN instead of going
  // through Ulit's own Книжкова палата registration (admin's book-chamber.ts
  // route), which /api/admin/isbn-queue already correctly skips once isbn is
  // non-null. Author-settable exactly once -- immutable afterwards (like
  // admin-assigned ISBNs) so it can't be accidentally overwritten later.
  app.patch("/api/books/:id/claim-isbn", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.book.findUnique({ where: { id }, select: { authorId: true, isbn: true } });
    if (!existing) throw AppError.notFound("Book");
    if (existing.authorId !== request.user.id) throw AppError.forbidden("Not your book");
    if (existing.isbn) {
      throw new AppError("ISBN вже присвоєно цій книзі", 400, "ISBN_ALREADY_SET");
    }

    const result = z.object({ isbn: z.string().min(1) }).safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }
    const { isbn } = result.data;

    if (!validateIsbn13(isbn)) {
      throw new AppError("Невалідний ISBN-13", 400, "INVALID_ISBN");
    }
    const collision = await prisma.book.findFirst({ where: { isbn, NOT: { id } }, select: { id: true } });
    if (collision) {
      throw new AppError("Цей ISBN вже присвоєно іншій книзі", 400, "ISBN_TAKEN");
    }

    const book = await prisma.book.update({
      where: { id },
      data: { isbn },
      select: BOOK_SELECT,
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

  // Permanently purge every archived (soft-deleted) book for this author --
  // "Очистити список" in the "Видалені книги" section. Hard-deletes the Book
  // row (ConversionJob cascades). Books that were ever actually sold keep
  // OrderItem/Royalty rows pointing at them (no onDelete: Cascade on those
  // relations, on purpose -- financial/order history must never disappear
  // just because the book listing was cleaned up), so the DB rejects the
  // delete with a foreign-key error; those are skipped and reported rather
  // than failing the whole batch.
  app.post("/api/books/purge-archived", { preHandler: authenticate }, async (request, reply) => {
    const archived = await prisma.book.findMany({
      where: { authorId: request.user.id, status: "ARCHIVED" },
      select: { id: true, title: true },
    });

    const purged: string[] = [];
    const skipped: { id: string; title: string }[] = [];

    for (const book of archived) {
      try {
        await prisma.book.delete({ where: { id: book.id } });
        purged.push(book.id);
      } catch {
        skipped.push({ id: book.id, title: book.title });
      }
    }

    return reply.send({ purged, skipped });
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
