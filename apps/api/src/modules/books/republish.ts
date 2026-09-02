import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

// "Опублікувати із змінами" — the author staged a change to an already-
// PUBLISHED book (a new .docx via upload.ts, and/or a sensitive metadata
// edit -- Назва/Анотація/Жанр -- via book.ts's PATCH, both of which write to
// pending*/docxUpdatedAt without touching the live fields) and wants it
// live. Per the Ridero reference (docs/TECHNICAL-DECISIONS.md "Референс:
// республікація змін на Рідеро"), this submits the change for admin
// re-moderation rather than publishing instantly — the live book/files are
// untouched until an admin approves via PATCH /api/admin/books/:id/republish
// (admin.ts), which is also where pending* actually gets applied.
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
          pendingTitle: true,
          pendingDescription: true,
          pendingGenre: true,
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
      const hasDocxChanges = book.docxUpdatedAt && (!book.publishedAt || book.docxUpdatedAt > book.publishedAt);
      const hasPendingMetadata = book.pendingTitle != null || book.pendingDescription != null || book.pendingGenre != null;
      if (!hasDocxChanges && !hasPendingMetadata) {
        throw new AppError("Немає нових змін для публікації", 400, "NO_CHANGES");
      }
      // republishRequestedAt is always cleared back to null by the admin's
      // approve/reject (admin.ts) -- its mere presence means a request is
      // already in flight, no timestamp comparison needed.
      if (book.republishRequestedAt) {
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
