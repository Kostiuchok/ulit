import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { getConversionStatus } from "../../services/publishing.service";

const updateStatusSchema = z.object({
  format: z.string(),
  status: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]),
  error: z.string().optional(),
  outputObjectName: z.string().optional(),
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
      return reply.send({ bookStatus: book.status, jobs });
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

      const { format, status, error, outputObjectName } = result.data;

      await prisma.conversionJob.update({
        where: { bookId_format: { bookId: id, format } },
        data: { status, error: error ?? null },
      });

      if (status === "DONE" && outputObjectName) {
        const field = FORMAT_URL_FIELD[format];
        if (field) {
          await prisma.book.update({
            where: { id },
            data: { [field]: outputObjectName },
            select: { id: true },
          });
        }
      }

      // If all jobs done → move book to REVIEW
      const allJobs = await prisma.conversionJob.findMany({ where: { bookId: id } });
      const allDone = allJobs.every((j) => j.status === "DONE" || j.status === "FAILED");
      const anyFailed = allJobs.some((j) => j.status === "FAILED");

      if (allDone) {
        await prisma.book.update({
          where: { id },
          data: { status: anyFailed ? "DRAFT" : "REVIEW" },
          select: { id: true },
        });
      }

      return reply.send({ ok: true });
    }
  );
}
