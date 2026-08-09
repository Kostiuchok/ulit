import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

// "Опублікувати із змінами" — the author re-uploaded a new .docx for an
// already-PUBLISHED book (see upload.ts, which stages the file without
// converting) and wants it live. Per the Ridero reference (docs/
// TECHNICAL-DECISIONS.md "Референс: республікація змін на Рідеро"), this
// submits the change for admin re-moderation rather than publishing
// instantly — the live book/files are untouched until an admin approves
// via PATCH /api/admin/books/:id/republish (admin.ts).
export async function republishRoute(app: FastifyInstance) {
  app.post(
    "/api/books/:id/republish",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          status: true,
          originalDocxUrl: true,
          docxUpdatedAt: true,
          publishedAt: true,
          republishRequestedAt: true,
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");
      if (book.status !== "PUBLISHED") {
        throw new AppError("Ця дія доступна лише для опублікованих книг", 400, "NOT_PUBLISHED");
      }
      if (!book.originalDocxUrl) {
        throw new AppError("Немає файлу рукопису", 400, "NO_DOCX");
      }
      const hasChanges =
        book.docxUpdatedAt && (!book.publishedAt || book.docxUpdatedAt > book.publishedAt);
      if (!hasChanges) {
        throw new AppError("Немає нових змін для публікації", 400, "NO_CHANGES");
      }
      const alreadyPending =
        book.republishRequestedAt && book.docxUpdatedAt && book.republishRequestedAt >= book.docxUpdatedAt;
      if (alreadyPending) {
        throw new AppError("Зміни вже надіслано на модерацію", 400, "ALREADY_PENDING");
      }

      const updated = await prisma.book.update({
        where: { id },
        data: { republishRequestedAt: new Date() },
        select: { id: true, status: true, republishRequestedAt: true },
      });

      return reply.send({ book: updated });
    }
  );
}
