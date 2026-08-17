import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { withAvatarVersion } from "../../lib/coverVersion";

export async function meRoute(app: FastifyInstance) {
  app.get("/api/users/me/auth", { preHandler: authenticate }, async (request, reply) => {
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
        updatedAt: true,
      },
    });

    if (!user) throw AppError.notFound("User");

    return reply.send({ user: withAvatarVersion(user) });
  });
}
