import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { enqueueConversionJobs } from "../../services/publishing.service";

// "Опублікувати із змінами" — the author re-uploaded a new .docx for an
// already-PUBLISHED book (see upload.ts, which stages the file without
// converting). This is the explicit confirmation that actually regenerates
// EPUB/PDF/FB2/MOBI from the new file and swaps them in, while the book
// stays PUBLISHED the whole time (no re-moderation — it already passed once).
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

      await enqueueConversionJobs(id, book.originalDocxUrl, { setProcessing: false });

      const updated = await prisma.book.update({
        where: { id },
        data: { publishedAt: new Date() },
        select: { id: true, status: true, publishedAt: true },
      });

      return reply.send({ book: updated });
    }
  );
}
