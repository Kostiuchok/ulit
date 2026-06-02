import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { scheduleKdpExpiryWarning } from "../../lib/email-queue";

const KDP_SELECT_DAYS = 90;

const switchSchema = z.object({
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]),
});

export async function distributionRoutes(app: FastifyInstance) {
  // GET distribution status for a book
  app.get(
    "/api/books/:id/distribution",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          authorId: true,
          distributionStrategy: true,
          kdpSelectEnrolled: true,
          kdpSelectExpiry: true,
          d2dStatus: true,
          d2dSentAt: true,
          kdpStatus: true,
          kdpSentAt: true,
          googleStatus: true,
          googleSentAt: true,
          status: true,
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const now = new Date();
      const kdpActive =
        book.kdpSelectEnrolled &&
        book.kdpSelectExpiry !== null &&
        book.kdpSelectExpiry > now;

      return reply.send({
        distributionStrategy: book.distributionStrategy,
        kdpSelectEnrolled: book.kdpSelectEnrolled,
        kdpSelectExpiry: book.kdpSelectExpiry,
        kdpSelectDaysLeft: kdpActive
          ? Math.ceil((book.kdpSelectExpiry!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          : null,
        kdpSelectActive: kdpActive,
        services: {
          d2d: { status: book.d2dStatus, sentAt: book.d2dSentAt, blocked: kdpActive },
          kdp: { status: book.kdpStatus, sentAt: book.kdpSentAt, blocked: false },
          google: { status: book.googleStatus, sentAt: book.googleSentAt, blocked: kdpActive },
        },
      });
    }
  );

  // PATCH — switch strategy (only allowed when KDP Select is not active)
  app.patch(
    "/api/books/:id/distribution",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = switchSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
      }

      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          authorId: true,
          distributionStrategy: true,
          kdpSelectEnrolled: true,
          kdpSelectExpiry: true,
          author: { select: { email: true, name: true } },
          title: true,
        },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const now = new Date();
      const kdpActive = book.kdpSelectEnrolled && book.kdpSelectExpiry && book.kdpSelectExpiry > now;

      if (kdpActive && result.data.distributionStrategy === "WIDE") {
        throw new AppError(
          `Cannot switch to WIDE while KDP Select is active (expires ${book.kdpSelectExpiry!.toLocaleDateString("uk-UA")})`,
          400,
          "KDP_SELECT_ACTIVE"
        );
      }

      const { distributionStrategy } = result.data;
      const isEnrollingKdp = distributionStrategy === "KDP_SELECT" && !kdpActive;
      const expiry = isEnrollingKdp
        ? new Date(now.getTime() + KDP_SELECT_DAYS * 24 * 60 * 60 * 1000)
        : book.kdpSelectExpiry;

      const updated = await prisma.book.update({
        where: { id },
        data: {
          distributionStrategy,
          kdpSelectEnrolled: distributionStrategy === "KDP_SELECT",
          kdpSelectExpiry: isEnrollingKdp ? expiry : (distributionStrategy === "WIDE" ? null : undefined),
        },
        select: {
          distributionStrategy: true,
          kdpSelectEnrolled: true,
          kdpSelectExpiry: true,
        },
      });

      // Schedule 7-day warning email when enrolling KDP Select
      if (isEnrollingKdp && expiry) {
        await scheduleKdpExpiryWarning(
          { email: book.author.email, name: book.author.name, bookTitle: book.title, bookId: id, expiryDate: expiry.toISOString() },
          expiry
        ).catch((err) => console.error("[email] Failed to schedule KDP warning:", err));
      }

      return reply.send(updated);
    }
  );
}

// Helper used by admin publish flow (T-703, Phase 7)
export function isDistributionAllowed(
  service: "d2d" | "google" | "kdp",
  book: { distributionStrategy: string; kdpSelectEnrolled: boolean; kdpSelectExpiry: Date | null }
): boolean {
  const now = new Date();
  const kdpActive =
    book.kdpSelectEnrolled &&
    book.kdpSelectExpiry !== null &&
    book.kdpSelectExpiry > now;

  if (service === "kdp") return true;
  if (service === "d2d" || service === "google") return !kdpActive;
  return true;
}
