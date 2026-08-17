import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { bookQueue } from "../../lib/queue";
import { getSignedUrl } from "../../services/storage.service";

// T-2057 -- "Передперегляд = сама генерація друкованого PDF" (docs/T-2057-checklist.md
// section 0). This is the single trigger point for the print-PDF render: both
// the manuscript editor's "Передперегляд" button and the sidebar preview link
// call this same route, so they can never show two different files.
export async function printPreviewRoutes(app: FastifyInstance) {
  app.get(
    "/api/books/:id/print-preview",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          authorId: true,
          manuscriptContent: true,
          manuscriptEditedAt: true,
          manuscriptImportedAt: true,
          printPdfUrl: true,
          printPdfGeneratedAt: true,
          printPageCount: true,
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      if (!book.manuscriptContent) {
        return reply.send({ status: "NO_MANUSCRIPT" });
      }

      // Stale if never rendered, or if the author has edited/re-imported the
      // manuscript since the last render.
      const lastEdit = book.manuscriptEditedAt ?? book.manuscriptImportedAt;
      const stale =
        !book.printPdfGeneratedAt || (lastEdit !== null && lastEdit > book.printPdfGeneratedAt);

      if (stale) {
        const jobId = `print-pdf-${id}`;
        // Same dedup pattern as manuscript.ts's GET (T-2057 checklist item):
        // BullMQ's add() treats an existing jobId as a no-op, so a prior
        // completed/failed render under this exact ID would otherwise
        // silently swallow every subsequent regeneration attempt forever.
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
          "PRINT_PDF",
          { bookId: id, format: "PRINT_PDF" },
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

      const signedUrl = await getSignedUrl(book.printPdfUrl!);
      return reply.send({
        status: "DONE",
        printPdfUrl: signedUrl,
        printPageCount: book.printPageCount,
      });
    }
  );
}
