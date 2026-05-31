import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

export async function meRoute(app: FastifyInstance) {
  app.get("/api/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        slug: true,
        role: true,
        avatarUrl: true,
        bio: true,
        contractAcceptedAt: true,
        createdAt: true,
      },
    });

    if (!user) throw AppError.notFound("User");

    return reply.send({ user });
  });
}
