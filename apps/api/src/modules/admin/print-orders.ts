import { FastifyInstance } from "fastify";
import { requireAdmin } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { bookQueue } from "../../lib/queue";
import { getSignedUrl } from "../../services/storage.service";

// Every printed-copy format a buyer can actually check out with (orders.ts's
// own createOrderSchema) -- kept here rather than importing that module's
// internal const to avoid coupling an admin listing to checkout's own
// request-validation schema, which is free to grow non-print formats later.
const PRINT_FORMATS = ["PRINT_SOFTCOVER", "PRINT_HARDCOVER", "PRINT_SOFTCOVER_BW", "PRINT_HARDCOVER_BW"];

// Admin-only: which purchased books actually need a physical file sent to a
// print house, and the one-click "convert to curves" export for each --
// deliberately separate from the author-facing print-preview.ts (that one's
// printPdfUrl stays embedded-font, author-triggered, and required for the
// УДК/ISBN application regardless of whether the book ever sells a printed
// copy). This is reachable only once someone has actually bought a printed
// copy -- never generated speculatively for every book, given how much
// bigger a curves file is (~7-8x, verified against a real render).
export async function printOrdersRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/print-orders",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const items = await prisma.orderItem.findMany({
        where: { format: { in: PRINT_FORMATS } },
        select: {
          id: true,
          format: true,
          price: true,
          order: { select: { id: true, createdAt: true, status: true, user: { select: { name: true, email: true } } } },
          book: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              printPdfUrl: true,
              printPdfGeneratedAt: true,
              printCurvesUrl: true,
              printCurvesGeneratedAt: true,
              author: { select: { name: true } },
            },
          },
        },
        orderBy: { order: { createdAt: "desc" } },
      });

      return reply.send({ items });
    }
  );

  // Same lazy-generate-then-poll shape as GET /api/books/:id/print-preview
  // (author-facing), just admin-scoped and against printCurvesUrl instead of
  // printPdfUrl. Requires printPdfUrl to already exist -- the author's own
  // "Передперегляд книги" is what produces that; this only ever converts an
  // already-rendered print file, never renders the manuscript itself.
  app.get(
    "/api/admin/books/:id/print-curves",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: { printPdfUrl: true, printPdfGeneratedAt: true, printCurvesUrl: true, printCurvesGeneratedAt: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (!book.printPdfUrl) {
        return reply.send({ status: "NO_PRINT_PDF" });
      }

      const stale =
        !book.printCurvesGeneratedAt ||
        (book.printPdfGeneratedAt !== null && book.printPdfGeneratedAt > book.printCurvesGeneratedAt);

      if (stale) {
        const jobId = `print-curves-${id}`;
        // Same dedup pattern as print-preview.ts -- BullMQ's add() is a
        // no-op against an existing jobId, so a prior completed/failed run
        // under this exact ID would otherwise silently swallow every
        // subsequent regeneration attempt forever.
        const existing = await bookQueue.getJob(jobId);
        if (existing) {
          const state = await existing.getState();
          if (state === "completed" || state === "failed") {
            await existing.remove();
          } else {
            const progress = typeof existing.progress === "number" ? existing.progress : 0;
            return reply.send({ status: "PROCESSING", progress });
          }
        }

        const job = await bookQueue.add(
          "EXPORT_PRINT_CURVES",
          { bookId: id, format: "EXPORT_PRINT_CURVES" },
          {
            jobId,
            attempts: 2,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 10 },
          }
        );
        const progress = typeof job.progress === "number" ? job.progress : 0;
        return reply.send({ status: "PROCESSING", progress });
      }

      const signedUrl = await getSignedUrl(book.printCurvesUrl!);
      return reply.send({ status: "DONE", printCurvesUrl: signedUrl });
    }
  );
}
