import { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { assignIsbn } from "../../services/isbn.service";
import { queuePublishedEmail, scheduleKdpExpiryWarning } from "../../lib/email-queue";

const KDP_SELECT_DAYS = 90;
const WARN_BEFORE_DAYS = 7;

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
  status: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!book.title?.trim()) errors.push({ field: "title", message: "Назва відсутня" });
  if (!book.coverUrl) errors.push({ field: "cover", message: "Обкладинка не завантажена" });
  if (!book.originalDocxUrl && !book.pdfUrl && !book.epubUrl) {
    errors.push({ field: "file", message: "Файл рукопису не завантажено" });
  }
  if (!book.priceEbook && !book.pricePrint) {
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
          status: true,
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const errors = validateBook(book);
      return reply.send({ valid: errors.length === 0, errors });
    }
  );

  // POST — submit for publication (T-703)
  app.post(
    "/api/books/:id/publish",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const clientIp =
        (request.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
        request.socket.remoteAddress ??
        "unknown";

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
          isbn: true,
          distributionStrategy: true,
          kdpSelectEnrolled: true,
          kdpSelectExpiry: true,
          author: { select: { id: true, email: true, name: true, contractAcceptedAt: true } },
        },
      });

      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");
      if (book.status === "PUBLISHED") {
        throw new AppError("Book is already published", 400, "ALREADY_PUBLISHED");
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

      // T-701 — assign ISBN (if not already set)
      const isbn = book.isbn ?? (await assignIsbn(id));

      // KDP Select enrollment: set expiry if enrolling now
      const now = new Date();
      const isKdpSelect = book.distributionStrategy === "KDP_SELECT";
      const kdpExpiry =
        isKdpSelect && !book.kdpSelectEnrolled
          ? new Date(now.getTime() + KDP_SELECT_DAYS * 24 * 60 * 60 * 1000)
          : book.kdpSelectExpiry;

      // T-704 — transition to PUBLISHED
      const published = await prisma.book.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          isbn,
          publishedAt: now,
          kdpSelectEnrolled: isKdpSelect ? true : book.kdpSelectEnrolled,
          kdpSelectExpiry: isKdpSelect ? kdpExpiry : book.kdpSelectExpiry,
        },
        select: { id: true, status: true, isbn: true, publishedAt: true, title: true },
      });

      // T-111 — store contractAcceptedAt + IP on first publish
      if (!book.author.contractAcceptedAt) {
        await prisma.user.update({
          where: { id: book.author.id },
          data: { contractAcceptedAt: now, contractAcceptedIp: clientIp },
        });
      }

      // T-705 — send published email
      queuePublishedEmail({
        email: book.author.email,
        name: book.author.name,
        bookTitle: book.title,
        bookId: id,
        isbn,
      }).catch((err) => console.error("[email] published notification failed:", err));

      // Schedule KDP Select expiry warning if newly enrolled
      if (isKdpSelect && !book.kdpSelectEnrolled && kdpExpiry) {
        const warnDate = new Date(kdpExpiry.getTime() - WARN_BEFORE_DAYS * 24 * 60 * 60 * 1000);
        scheduleKdpExpiryWarning(
          { email: book.author.email, name: book.author.name, bookTitle: book.title, bookId: id, expiryDate: kdpExpiry.toISOString() },
          kdpExpiry
        ).catch((err) => console.error("[email] KDP warning schedule failed:", err));
      }

      return reply.status(200).send({ book: published, isbn });
    }
  );
}
