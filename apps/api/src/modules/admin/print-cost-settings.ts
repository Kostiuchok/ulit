import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/jwt.middleware";

const SETTINGS_ID = "singleton";

const patchSchema = z.object({
  baseCostSoftcover: z.coerce.number().nonnegative(),
  baseCostHardcover: z.coerce.number().nonnegative(),
  costPerPage: z.coerce.number().nonnegative(),
});

// Single platform-wide row -- print trim size is fixed for every book, so one
// cost formula applies to all of them. See PrintCostSettings in schema.prisma.
export async function printCostSettingsRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/print-cost-settings",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const settings = await prisma.printCostSettings.findUnique({ where: { id: SETTINGS_ID } });
      return reply.send({ settings });
    }
  );

  app.patch(
    "/api/admin/print-cost-settings",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const result = patchSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
      }

      const { baseCostSoftcover, baseCostHardcover, costPerPage } = result.data;

      const settings = await prisma.printCostSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, baseCostSoftcover, baseCostHardcover, costPerPage },
        update: { baseCostSoftcover, baseCostHardcover, costPerPage },
      });

      return reply.send({ settings });
    }
  );
}
