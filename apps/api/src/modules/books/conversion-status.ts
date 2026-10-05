import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { getConversionStatus } from "../../services/publishing.service";
import { bookQueue } from "../../lib/queue";
import { buildIsbnEditionSnapshot, isbnStillValidForEdition, formatAuthorFullName, type IsbnEditionSnapshot } from "shared-types";

const updateStatusSchema = z.object({
  format: z.string(),
  status: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]),
  error: z.string().optional(),
  outputObjectName: z.string().optional(),
  printPageCount: z.number().int().positive().optional(),
});

const FORMAT_URL_FIELD: Record<string, string> = {
  PDF: "pdfUrl",
  EPUB: "epubUrl",
  FB2: "fb2Url",
  MOBI: "mobiUrl",
  PRINT_PDF: "printPdfUrl",
};

export async function conversionStatusRoutes(app: FastifyInstance) {
  // GET — polling endpoint for the frontend
  app.get(
    "/api/books/:id/conversion-status",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, status: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const jobs = await getConversionStatus(id);
      const jobsWithProgress = await Promise.all(
        jobs.map(async ({ bullJobId, ...j }) => {
          if ((j.status === "PENDING" || j.status === "PROCESSING") && bullJobId) {
            const bullJob = await bookQueue.getJob(bullJobId);
            const progress = typeof bullJob?.progress === "number" ? bullJob.progress : undefined;
            return { ...j, progress };
          }
          return j;
        })
      );
      return reply.send({ bookStatus: book.status, jobs: jobsWithProgress });
    }
  );

  // POST — called by the worker to update job status (internal)
  app.post(
    "/api/books/:id/job-status",
    async (request, reply) => {
      // Worker uses a shared internal secret rather than user JWT
      const secret = request.headers["x-worker-secret"];
      if (secret !== (process.env.WORKER_SECRET || "worker-secret-dev")) {
        throw AppError.unauthorized("Invalid worker secret");
      }

      const { id } = request.params as { id: string };
      const result = updateStatusSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const { format, status, error, outputObjectName, printPageCount } = result.data;

      await prisma.conversionJob.update({
        where: { bookId_format: { bookId: id, format } },
        data: { status, error: error ?? null },
      });

      if (status === "DONE" && outputObjectName) {
        const field = FORMAT_URL_FIELD[format];
        if (field) {
          await prisma.book.update({
            where: { id },
            data: {
              [field]: outputObjectName,
              ...(format === "PRINT_PDF" && printPageCount ? { printPageCount } : {}),
            },
            select: { id: true },
          });
        }

        // Phase 3 "ISBN-правило" (WF-SPEC.md) -- a docx re-conversion
        // (republish approved admin.ts-side) only reveals the NEW page
        // count here, once the worker's print-PDF render actually
        // finishes; admin.ts's own republish-approve check explicitly
        // skips this case for that reason. Re-checked here, right when the
        // fresh printPageCount lands, against whatever edition was
        // snapshotted when the ISBN was last assigned (book-chamber.ts).
        if (format === "PRINT_PDF" && printPageCount) {
          const book = await prisma.book.findUnique({
            where: { id },
            select: {
              isbn: true,
              isbnEditionSnapshot: true,
              title: true,
              bookAuthors: true,
              printFormatKey: true,
              printWidthMm: true,
              printHeightMm: true,
            },
          });
          if (book?.isbn && book.isbnEditionSnapshot) {
            const current: IsbnEditionSnapshot = buildIsbnEditionSnapshot({
              printFormatKey: book.printFormatKey,
              printWidthMm: book.printWidthMm,
              printHeightMm: book.printHeightMm,
              title: book.title,
              primaryAuthor: formatAuthorFullName(book.bookAuthors),
              pageCount: printPageCount,
            });
            const stillValid = isbnStillValidForEdition(book.isbnEditionSnapshot as unknown as IsbnEditionSnapshot, current);
            if (!stillValid) {
              await prisma.book.update({
                where: { id },
                data: { isbn: null, udcCode: null, authorSign: null, bookChamberSubmittedAt: null, isbnEditionSnapshot: Prisma.JsonNull },
                select: { id: true },
              });
            }
          }
        }
      }

      // If all jobs done → conversion finished, back to DRAFT so the author
      // can review readiness (cover/price/etc.) and explicitly submit via
      // POST /api/books/:id/publish. REVIEW is reserved for that deliberate
      // submission — conversion alone must not put a book in the admin's
      // moderation queue. Only demote when the book was actually PROCESSING
      // (the original creation flow) — a republish of an already-PUBLISHED
      // book (see /api/books/:id/republish) regenerates files in place and
      // must stay PUBLISHED throughout.
      const allJobs = await prisma.conversionJob.findMany({ where: { bookId: id } });
      const allDone = allJobs.every((j) => j.status === "DONE" || j.status === "FAILED");

      if (allDone) {
        const current = await prisma.book.findUnique({ where: { id }, select: { status: true } });
        if (current?.status === "PROCESSING") {
          await prisma.book.update({
            where: { id },
            data: { status: "DRAFT" },
            select: { id: true },
          });
        }
      }

      return reply.send({ ok: true });
    }
  );
}
