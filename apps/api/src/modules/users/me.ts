import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { withAvatarVersion } from "../../lib/coverVersion";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(1000).nullable().optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens")
    .optional(),
  // Same fields "Змінити договір" (users/contract.ts) writes -- first-time
  // fill only, via this simple route. Once set, only that heavier
  // passport-backed flow may change them (guarded below), same
  // claim-once-then-immutable pattern as book.ts's claim-isbn.
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  patronymic: z.string().max(100).optional(),
});

export async function usersMe(app: FastifyInstance) {
  app.get("/api/users/me", { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        slug: true,
        bio: true,
        avatarUrl: true,
        role: true,
        contractAcceptedAt: true,
        taxId: true,
        bankIban: true,
        payoutDocument: true,
        payoutDetailsSubmittedAt: true,
        firstName: true,
        lastName: true,
        patronymic: true,
        birthDate: true,
        citizenship: true,
        registrationAddress: true,
        passportSeries: true,
        identityChangeReason: true,
        identityUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { books: true } },
      },
    });
    if (!user) throw AppError.notFound("User");
    return reply.send({ user: withAvatarVersion(user) });
  });

  app.patch("/api/users/me", { preHandler: authenticate }, async (request, reply) => {
    const result = patchSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { slug, firstName, lastName, patronymic, ...rest } = result.data;

    if (slug) {
      const existing = await prisma.user.findUnique({ where: { slug } });
      if (existing && existing.id !== request.user.id) {
        throw AppError.conflict("This slug is already taken");
      }
    }

    if (firstName !== undefined || lastName !== undefined || patronymic !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: request.user.id },
        select: { firstName: true, lastName: true },
      });
      if (current?.firstName || current?.lastName) {
        throw new AppError(
          "ПІБ вже заповнено — змінюйте через «Змінити договір» (потрібне підтвердження документом)",
          400,
          "NAME_ALREADY_SET"
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        ...rest,
        ...(slug ? { slug } : {}),
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(patronymic !== undefined ? { patronymic } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        slug: true,
        bio: true,
        avatarUrl: true,
        role: true,
        firstName: true,
        lastName: true,
        patronymic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.send({ user: withAvatarVersion(user) });
  });

  app.post("/api/users/me/accept-agreement", { preHandler: authenticate }, async (request, reply) => {
    const ip =
      (request.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      request.ip ||
      "unknown";

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        contractAcceptedAt: new Date(),
        contractAcceptedIp: ip,
      },
      select: { id: true, contractAcceptedAt: true },
    });

    return reply.send({ ok: true, contractAcceptedAt: user.contractAcceptedAt });
  });
}
