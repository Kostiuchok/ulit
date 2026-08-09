import { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

interface ValidationError {
  field: string;
  message: string;
}

function validateBook(book: {
  title: string;
  coverUrl: string | null;
  originalDocxUrl: string | null;
  pdfUrl: string | null;
  epubUrl: string | null;
  priceEbook: any;
  pricePrint: any;
  pricePrintHardcover: any;
  status: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!book.title?.trim()) errors.push({ field: "title", message: "Назва відсутня" });
  if (!book.coverUrl) errors.push({ field: "cover", message: "Обкладинка не завантажена" });
  if (!book.originalDocxUrl && !book.pdfUrl && !book.epubUrl) {
    errors.push({ field: "file", message: "Файл рукопису не завантажено" });
  }
  if (!book.priceEbook && !book.pricePrint && !book.pricePrintHardcover) {
    errors.push({ field: "price", message: "Вкажіть ціну (е-книга або друкована версія)" });
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
          coverUrl: true,
          originalDocxUrl: true,
          pdfUrl: true,
          epubUrl: true,
          priceEbook: true,
          pricePrint: true,
          pricePrintHardcover: true,
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
          status: true,
          authorId: true,
          coverUrl: true,
          originalDocxUrl: true,
          pdfUrl: true,
          epubUrl: true,
          priceEbook: true,
          pricePrint: true,
          pricePrintHardcover: true,
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

      const submitted = await prisma.book.update({
        where: { id },
        data: {
          status: "REVIEW",
          publicationTimeline: timeline,
        },
        select: { id: true, status: true, title: true },
      });

      return reply.status(200).send({ book: submitted });
    }
  );
}
