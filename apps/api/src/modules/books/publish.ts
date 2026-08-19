import { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

interface ValidationError {
  field: string;
  message: string;
}

// T-2060 п.1/п.3 -- confirmed by live Ridero test (2026-08-17), see
// docs/T-2060-publish-info-redesign-checklist.md.
const DESCRIPTION_MIN_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;

function validateBook(book: {
  title: string;
  description: string | null;
  ageRating: string | null;
  coverUrl: string | null;
  originalDocxUrl: string | null;
  pdfUrl: string | null;
  epubUrl: string | null;
  priceEbook: any;
  pricePrint: any;
  pricePrintHardcover: any;
  pricePrintBw: any;
  pricePrintHardcoverBw: any;
  desiredRoyaltyAmount: any;
  desiredRoyaltyAmountPrint: any;
  status: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!book.title?.trim()) errors.push({ field: "title", message: "Назва відсутня" });
  const descLength = book.description?.trim().length ?? 0;
  if (descLength < DESCRIPTION_MIN_LENGTH || descLength > DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: "description",
      message: `Анотація має бути від ${DESCRIPTION_MIN_LENGTH} до ${DESCRIPTION_MAX_LENGTH} символів (зараз ${descLength})`,
    });
  }
  if (!book.ageRating) errors.push({ field: "ageRating", message: "Вкажіть вікові обмеження" });
  if (!book.coverUrl) errors.push({ field: "cover", message: "Обкладинка не завантажена" });
  if (!book.originalDocxUrl && !book.pdfUrl && !book.epubUrl) {
    errors.push({ field: "file", message: "Файл рукопису не завантажено" });
  }
  // T-2060 п.9/п.11 -- either the legacy per-format prices or the new
  // desired-royalty-per-unit satisfies this. desiredRoyaltyAmount is set via
  // the per-channel royalty calculator (DistributionChannelPicker.tsx) --
  // it live-derives a suggested price for every enabled channel from its own
  // commission formula, but our schema only stores ONE price per format
  // (not one per channel), so there is no separate per-channel price value
  // to individually require here. Storing desiredRoyaltyAmount IS the
  // "price resolved on every enabled channel" state for this schema shape.
  if (
    !book.priceEbook && !book.pricePrint && !book.pricePrintHardcover &&
    !book.pricePrintBw && !book.pricePrintHardcoverBw &&
    !book.desiredRoyaltyAmount && !book.desiredRoyaltyAmountPrint
  ) {
    errors.push({ field: "price", message: "Вкажіть ціну або бажане роялті" });
  }
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
      const timeline = { ...((book.publicationTimeline as Record<string, string>) ?? {}), submitted: now.toISOString() };

      // Resubmission after a rejection must clear the old REJECTED verdict --
      // moderationStatus/moderationNote otherwise stay stuck on the rejection
      // from a previous round forever (nothing else ever resets them), so
      // the author's rejection banner (parseRejectedConcerns, keyed off
      // moderationStatus === "REJECTED") kept showing even after fixing the
      // issues and resubmitting. Unconditional reset to PENDING is correct
      // for a first-time submission too (already the schema default).
      const submitted = await prisma.book.update({
        where: { id },
        data: {
          status: "REVIEW",
          moderationStatus: "PENDING",
          moderationNote: null,
          publicationTimeline: timeline,
        },
        select: { id: true, status: true, title: true },
      });

      return reply.status(200).send({ book: submitted });
    }
  );
}
