import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  styleOverrides: z.any(),
});

export async function authorStyleSetRoutes(app: FastifyInstance) {
  app.get(
    "/api/style-sets",
    { preHandler: authenticate },
    async (request, reply) => {
      const styleSets = await prisma.authorStyleSet.findMany({
        where: { authorId: request.user.id },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ styleSets });
    }
  );

  app.post(
    "/api/style-sets",
    { preHandler: authenticate },
    async (request, reply) => {
      const result = createSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const styleSet = await prisma.authorStyleSet.create({
        data: {
          authorId: request.user.id,
          name: result.data.name,
          description: result.data.description || null,
          styleOverrides: result.data.styleOverrides,
        },
      });
      return reply.send({ styleSet });
    }
  );

  app.delete(
    "/api/style-sets/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const styleSet = await prisma.authorStyleSet.findUnique({ where: { id }, select: { authorId: true } });
      if (!styleSet) throw AppError.notFound("Style set");
      if (styleSet.authorId !== request.user.id) throw AppError.forbidden("Not your style set");

      await prisma.authorStyleSet.delete({ where: { id } });
      return reply.send({ ok: true });
    }
  );
}
