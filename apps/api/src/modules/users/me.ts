import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(1000).nullable().optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens")
    .optional(),
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
        createdAt: true,
        _count: { select: { books: true } },
      },
    });
    if (!user) throw AppError.notFound("User");
    return reply.send({ user });
  });

  app.patch("/api/users/me", { preHandler: authenticate }, async (request, reply) => {
    const result = patchSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { slug, ...rest } = result.data;

    if (slug) {
      const existing = await prisma.user.findUnique({ where: { slug } });
      if (existing && existing.id !== request.user.id) {
        throw AppError.conflict("This slug is already taken");
      }
    }

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: { ...rest, ...(slug ? { slug } : {}) },
      select: {
        id: true,
        email: true,
        name: true,
        slug: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    return reply.send({ user });
  });
}
