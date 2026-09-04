import { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { PUBLISH_FIELD_CHECKS, DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH, type PublishStepBook } from "shared-types";

interface ValidationError {
  field: string;
  message: string;
}

// Per-field error message -- the ONE thing that stays backend-only (the
// author-facing output-data page has its own section labels/headings, not
// per-field prose). The actual "is this field ok" checks live in
// PUBLISH_FIELD_CHECKS (shared-types) -- this is the real pre-publish gate,
// and output-data/page.tsx's per-section checkbox reads the exact same
// checks (isPublishStepComplete), so the two can never disagree about what
// counts as done.
const FIELD_MESSAGES: Record<string, (book: PublishStepBook) => string> = {
  title: () => "Назва відсутня",
  description: (b) => {
    const len = (b.description ?? "").trim().length;
    return `Анотація має бути від ${DESCRIPTION_MIN_LENGTH} до ${DESCRIPTION_MAX_LENGTH} символів (зараз ${len})`;
  },
  ageRating: () => "Вкажіть вікові обмеження",
  bookAuthors: () => "Додайте принаймні одного автора книги (прізвище та ім'я) в розділі «Автори книги»",
  cover: () => "Обкладинка не завантажена",
  file: () => "Файл рукопису не завантажено",
  price: () => "Вкажіть ціну або бажане роялті",
};

function validateBook(book: PublishStepBook & { status: string }): ValidationError[] {
  const errors: ValidationError[] = PUBLISH_FIELD_CHECKS.filter((c) => !c.isComplete(book)).map((c) => ({
    field: c.key,
    message: FIELD_MESSAGES[c.key](book),
  }));

  if (book.status === "PROCESSING") {
    errors.push({ field: "status", message: "Дочекайтесь завершення конвертації файлів" });
  }

  return errors;
}

export async function publishRoute(app: FastifyInstance) {
  // GET — pre-publish validation check (author can call before submitting)
  app.get(
    "/api/books/:id/publish/validate",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          authorId: true,
          title: true,
          description: true,
          ageRating: true,
          coverUrl: true,
          originalDocxUrl: true,
          pdfUrl: true,
          epubUrl: true,
          priceEbook: true,
          pricePrint: true,
          pricePrintHardcover: true,
          pricePrintBw: true,
          pricePrintHardcoverBw: true,
          desiredRoyaltyAmount: true,
          desiredRoyaltyAmountPrint: true,
          bookAuthors: true,
          status: true,
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const errors = validateBook(book);
      return reply.send({ valid: errors.length === 0, errors });
    }
  );

  // POST — submit for moderation (T-2010). This does NOT publish the book —
  // it validates required fields, marks the book REVIEW, and records
  // publicationTimeline.submitted so the author's dashboard checklist turns
  // green immediately. Actual publish (ISBN + status=PUBLISHED) only happens
  // when an admin approves via PATCH /api/admin/books/:id/approve.
  app.post(
    "/api/books/:id/publish",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          ageRating: true,
          status: true,
          authorId: true,
          coverUrl: true,
          originalDocxUrl: true,
          pdfUrl: true,
          epubUrl: true,
          priceEbook: true,
          pricePrint: true,
          pricePrintHardcover: true,
          pricePrintBw: true,
          pricePrintHardcoverBw: true,
          desiredRoyaltyAmount: true,
          desiredRoyaltyAmountPrint: true,
          bookAuthors: true,
          publicationTimeline: true,
          author: { select: { id: true, contractAcceptedAt: true } },
        },
      });

      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");
      if (book.status === "PUBLISHED") {
        throw new AppError("Book is already published", 400, "ALREADY_PUBLISHED");
      }
      if (book.status === "REVIEW") {
        throw new AppError("Book is already submitted and awaiting review", 400, "ALREADY_SUBMITTED");
      }

      // T-702 — validate
      const errors = validateBook(book);

      // T-2060 п.10 -- separate explicit checkbox ("Мене влаштовує вигляд
      // книги"), not persisted, re-confirmed on every submission attempt.
      const body = (request.body ?? {}) as { appearanceConfirmed?: boolean };
      if (!body.appearanceConfirmed) {
        errors.push({ field: "appearanceConfirmed", message: "Підтвердіть, що вас влаштовує вигляд книги" });
      }

      if (errors.length > 0) {
        return reply.status(422).send({
          error: "Validation failed",
          code: "PUBLISH_VALIDATION_FAILED",
          errors,
        });
      }

      // T-1951 — the platform contract is now signed explicitly, once, by the
      // author (see /dashboard/settings/contract, POST /api/users/me/contract/sign)
      // instead of being silently auto-stamped on first submission. Require it
      // up front so consent is a real checkbox action, not an implicit side effect.
      if (!book.author.contractAcceptedAt) {
        throw new AppError(
          "Спочатку підпишіть договір з платформою в профілі автора",
          400,
          "CONTRACT_NOT_SIGNED"
        );
      }

      const now = new Date();
      const prevTimeline = (book.publicationTimeline as Record<string, string>) ?? {};
      const timeline = {
        ...prevTimeline,
        // "submitted" is the FIRST-ever submission -- never overwritten once
        // set, so admin/books can show "коли автор вперше надіслав" even
        // after several rounds of rejection+resubmit. "lastSubmitted" always
        // reflects the most recent one (including the first, where the two
        // are identical) -- the pair together shows how actively an author
        // is engaging with a rejected book, not just that they touched it once.
        submitted: prevTimeline.submitted ?? now.toISOString(),
        lastSubmitted: now.toISOString(),
      };

      // Resubmission after a rejection must clear the old REJECTED verdict --
      // moderationStatus/moderationNote otherwise stay stuck on the rejection
      // from a previous round forever (nothing else ever resets them), so
      // the author's rejection banner (getAllRejectionLines, keyed off
      // moderationStatus === "REJECTED") kept showing even after fixing the
      // issues and resubmitting. Unconditional reset to PENDING is correct
      // for a first-time submission too (already the schema default).
      // moderationReasons/moderationCustomNote/moderationFieldSnapshot reset
      // for the same reason -- moderationStatus short-circuits them to unused
      // the moment it's PENDING, but leaving stale values around is still
      // worth clearing so a future `SELECT * FROM "Book"` doesn't show a
      // "rejection" that no longer means anything.
      const submitted = await prisma.book.update({
        where: { id },
        data: {
          status: "REVIEW",
          moderationStatus: "PENDING",
          moderationNote: null,
          moderationReasons: [],
          moderationCustomNote: null,
          moderationFieldSnapshot: Prisma.JsonNull,
          publicationTimeline: timeline,
        },
        select: { id: true, status: true, title: true },
      });

      return reply.status(200).send({ book: submitted });
    }
  );
}
