import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  design: z.any(),
});

export async function coverTemplateRoutes(app: FastifyInstance) {
  app.get(
    "/api/cover-templates",
    { preHandler: authenticate },
    async (request, reply) => {
      const templates = await prisma.coverTemplate.findMany({
        where: { authorId: request.user.id },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ templates });
    }
  );

  app.post(
    "/api/cover-templates",
    { preHandler: authenticate },
    async (request, reply) => {
      const result = createSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const template = await prisma.coverTemplate.create({
        data: {
          authorId: request.user.id,
          name: result.data.name,
          design: result.data.design,
        },
      });
      return reply.send({ template });
    }
  );

  app.delete(
    "/api/cover-templates/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const template = await prisma.coverTemplate.findUnique({ where: { id }, select: { authorId: true } });
      if (!template) throw AppError.notFound("Cover template");
      if (template.authorId !== request.user.id) throw AppError.forbidden("Not your template");

      await prisma.coverTemplate.delete({ where: { id } });
      return reply.send({ ok: true });
    }
  );
}
