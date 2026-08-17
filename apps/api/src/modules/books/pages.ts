import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { bookQueue } from "../../lib/queue";
import { publicUrl, getSignedUrl } from "../../services/storage.service";
import { withAvatarVersion } from "../../lib/coverVersion";

function buildPageUrls(bookId: string, pageCount: number, variant: "pages" | "pages-bw") {
  return Array.from({ length: pageCount }, (_, i) => ({
    page: i + 1,
    url: publicUrl(`public/${variant}/${bookId}/page-${String(i + 1).padStart(3, "0")}.png`),
  }));
}

export async function bookPagesRoutes(app: FastifyInstance) {
  app.get(
    "/api/books/:id/pages",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, pdfUrl: true, pagesGeneratedAt: true, pageCount: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      if (!book.pdfUrl) {
        return reply.send({ status: "NO_PDF" });
      }

      if (!book.pagesGeneratedAt) {
        // Enqueue — jobId prevents duplicate jobs
        await bookQueue.add(
          "PAGE_THUMBNAILS",
          { bookId: id, format: "PAGE_THUMBNAILS", pdfObjectName: book.pdfUrl },
          {
            jobId: `pages-${id}`,
            attempts: 2,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 10 },
          }
        );
        return reply.send({ status: "PROCESSING" });
      }

      const pages = buildPageUrls(id, book.pageCount ?? 0, "pages");
      const pagesBw = buildPageUrls(id, book.pageCount ?? 0, "pages-bw");
      const pdfUrl = await getSignedUrl(book.pdfUrl).catch(() => null);
      return reply.send({ status: "DONE", pages, pagesBw, pdfUrl });
    }
  );

  app.get(
    "/api/books/:id/back-cover-data",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          authorId: true,
          author: { select: { name: true, bio: true, avatarUrl: true, updatedAt: true } },
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      // book.author.avatarUrl is already a full URL (storage.service's
      // publicUrl() is applied once, at upload time -- users/avatar.ts) --
      // re-wrapping it in publicUrl() here double-prefixed the base URL,
      // producing a broken link whenever the author had an avatar set.
      return reply.send({
        authorName: book.author.name,
        bio: book.author.bio ?? null,
        avatarUrl: withAvatarVersion(book.author).avatarUrl,
      });
    }
  );
}
