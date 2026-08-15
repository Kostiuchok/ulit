import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { bookQueue } from "../../lib/queue";

const patchSchema = z.object({
  content: z.any().optional(),
  styleOverrides: z.any().optional(),
});

export async function bookManuscriptRoutes(app: FastifyInstance) {
  app.get(
    "/api/books/:id/manuscript",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          authorId: true,
          originalDocxUrl: true,
          manuscriptImportedAt: true,
          manuscriptContent: true,
          manuscriptStyleOverrides: true,
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      if (!book.originalDocxUrl) {
        return reply.send({ status: "NO_DOCX" });
      }

      if (!book.manuscriptImportedAt) {
        await bookQueue.add(
          "MANUSCRIPT_IMPORT",
          { bookId: id, format: "MANUSCRIPT_IMPORT", docxObjectName: book.originalDocxUrl },
          {
            jobId: `manuscript-${id}`,
            attempts: 2,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 10 },
          }
        );
        return reply.send({ status: "PROCESSING" });
      }

      return reply.send({
        status: "DONE",
        content: book.manuscriptContent,
        styleOverrides: book.manuscriptStyleOverrides ?? {},
      });
    }
  );

  // Explicit, author-triggered re-import from the currently staged
  // originalDocxUrl -- manuscriptContent is otherwise never touched again
  // after the first import (re-uploading a new .docx, and admin approving a
  // republish, both intentionally leave it alone so in-editor edits aren't
  // silently clobbered by a background job). The author must opt in here,
  // after being warned client-side that this replaces their current
  // manuscriptContent. Reuses the exact same "no manuscriptImportedAt yet"
  // path GET already has, so the frontend's existing PROCESSING/poll UI
  // (manuscript/page.tsx) handles this the same way it does a first import.
  app.post(
    "/api/books/:id/manuscript/reimport",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, originalDocxUrl: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");
      if (!book.originalDocxUrl) throw new AppError("No manuscript file uploaded", 400, "NO_DOCX");

      await prisma.book.update({
        where: { id },
        data: { manuscriptImportedAt: null },
        select: { id: true },
      });

      return reply.send({ ok: true });
    }
  );

  app.patch(
    "/api/books/:id/manuscript",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({ where: { id }, select: { authorId: true } });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const result = patchSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const data: Record<string, unknown> = {};
      if (result.data.content !== undefined) {
        data.manuscriptContent = result.data.content;
        data.manuscriptEditedAt = new Date();
      }
      if (result.data.styleOverrides !== undefined) data.manuscriptStyleOverrides = result.data.styleOverrides;

      await prisma.book.update({ where: { id }, data, select: { id: true } });

      return reply.send({ ok: true });
    }
  );
}
