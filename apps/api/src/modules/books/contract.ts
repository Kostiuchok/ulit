import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const signSchema = z.object({
  taxId: z.string().min(1).max(32),
  payoutDocument: z.string().min(1).max(255),
  bankIban: z.string().min(1).max(64),
});

// Author-side contract signing (T-1932 follow-up). The "Укладіть договір" step
// (publicationTimeline.contract_pending) used to be admin-only — this lets the
// author complete it themselves once the admin has approved the book (review_done),
// by stamping contract_pending. Payout/identity details (taxId, passport-or-FOP,
// IBAN) are captured here too — the platform is a tax agent for royalty payouts
// (see contract text §4.4), and "Повторна перевірка документів" (review_2) is the
// admin verifying exactly these details. contract_signed stays admin-only: that's
// the real go-live trigger (ISBN + external distribution) — see
// docs/TECHNICAL-DECISIONS.md "Флоу модерації".
export async function bookContractRoutes(app: FastifyInstance) {
  app.post(
    "/api/books/:id/contract/sign",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const clientIp =
        (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        request.socket.remoteAddress ??
        "unknown";

      const result = signSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
      }

      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          publicationTimeline: true,
          author: { select: { id: true, contractAcceptedAt: true } },
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const timeline = { ...((book.publicationTimeline as Record<string, string>) ?? {}) };
      if (!timeline.review_done) {
        throw new AppError("Книга ще не пройшла перевірку адміністратором", 400, "REVIEW_NOT_DONE");
      }
      if (timeline.contract_pending) {
        throw new AppError("Договір вже підписано", 400, "ALREADY_SIGNED");
      }

      const now = new Date();
      timeline.contract_pending = now.toISOString();

      const updated = await prisma.book.update({
        where: { id },
        data: { publicationTimeline: timeline },
        select: { id: true, publicationTimeline: true },
      });

      await prisma.user.update({
        where: { id: book.author.id },
        data: {
          taxId: result.data.taxId,
          payoutDocument: result.data.payoutDocument,
          bankIban: result.data.bankIban,
          payoutDetailsSubmittedAt: now,
          ...(book.author.contractAcceptedAt ? {} : { contractAcceptedAt: now, contractAcceptedIp: clientIp }),
        },
      });

      return reply.send({ book: updated });
    }
  );
}
