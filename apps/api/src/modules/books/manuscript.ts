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

interface ManuscriptStatsAcc {
  characters: number;
  words: number;
  images: number;
}

// Walks a ProseMirror doc (Tiptap's manuscriptContent JSON) counting the
// three numbers output-data's own "Рукопис" overview shows the author.
// Word count is a simple per-text-node split -- a word that happens to
// straddle two adjacent text nodes (e.g. a bold/italic mark boundary mid-
// word) can double-count at that seam, same class of approximation as
// every other character counter in this app; not worth a real tokenizer
// for an informational stat. `image` matches ResizableImage's node type
// too (shared-types/manuscript/resizableImage.ts extends Tiptap's own
// Image node via .extend(), which doesn't rename it).
function walkManuscriptStats(node: unknown, acc: ManuscriptStatsAcc): void {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text" && typeof n.text === "string") {
    acc.characters += n.text.length;
    acc.words += n.text.trim().split(/\s+/).filter(Boolean).length;
  }
  if (n.type === "image") {
    acc.images += 1;
  }
  if (Array.isArray(n.content)) {
    for (const child of n.content) walkManuscriptStats(child, acc);
  }
}

export async function bookManuscriptRoutes(app: FastifyInstance) {
  app.get(
    "/api/books/:id/manuscript-stats",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, manuscriptContent: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      if (!book.manuscriptContent) {
        return reply.send({ status: "NO_CONTENT" });
      }

      const acc: ManuscriptStatsAcc = { characters: 0, words: 0, images: 0 };
      walkManuscriptStats(book.manuscriptContent, acc);
      return reply.send({ status: "DONE", ...acc });
    }
  );


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
        const jobId = `manuscript-${id}`;
        // A re-import (POST /reimport resets manuscriptImportedAt to null)
        // reuses this same deterministic jobId. BullMQ's add() treats an
        // existing jobId as a no-op and hands back the old job instead of
        // running a new one -- so a prior completed/failed run of this exact
        // ID would otherwise silently swallow every re-import forever
        // (manuscriptImportedAt never gets set, frontend polls indefinitely).
        // Clear it out first so a fresh attempt actually gets queued; leave
        // an active/waiting job alone so we don't duplicate in-flight work.
        const existing = await bookQueue.getJob(jobId);
        if (existing) {
          const state = await existing.getState();
          if (state === "completed" || state === "failed") {
            await existing.remove();
          }
        }

        const job = await bookQueue.add(
          "MANUSCRIPT_IMPORT",
          { bookId: id, format: "MANUSCRIPT_IMPORT", docxObjectName: book.originalDocxUrl },
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
      if (result.data.styleOverrides !== undefined) {
        data.manuscriptStyleOverrides = result.data.styleOverrides;
        // page-number position (extractPageNumberPosition, generate-pdf-print.ts)
        // is the only part of styleOverrides the print PDF actually reads --
        // content changes above already bump manuscriptEditedAt, which
        // print-preview.ts's staleness check picks up on its own; a
        // styleOverrides-only save (no content change) needs its own bump of
        // printMetaUpdatedAt or it would never invalidate the cached PDF.
        data.printMetaUpdatedAt = new Date();
      }

      await prisma.book.update({ where: { id }, data, select: { id: true } });

      return reply.send({ ok: true });
    }
  );
}
