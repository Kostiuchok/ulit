import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const SETTINGS_ID = "singleton";

interface BulkTier {
  minQuantity: number;
  baseCostSoftcover: number;
  baseCostHardcover: number;
  costPerPage: number;
}

// Picks the highest-minQuantity tier that still qualifies at this quantity,
// falling back to the base (тираж = 1) rates when none does -- the common
// case, since most authors print one copy at a time.
function ratesForQuantity(
  settings: { baseCostSoftcover: unknown; baseCostHardcover: unknown; costPerPage: unknown; bulkTiers: unknown },
  quantity: number
) {
  const tiers = Array.isArray(settings.bulkTiers) ? (settings.bulkTiers as unknown as BulkTier[]) : [];
  const applicable = tiers.filter((t) => quantity >= t.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0];
  return applicable ?? {
    baseCostSoftcover: Number(settings.baseCostSoftcover),
    baseCostHardcover: Number(settings.baseCostHardcover),
    costPerPage: Number(settings.costPerPage),
  };
}

// Author-facing print-cost estimate, computed server-side so the raw admin
// rate config (PrintCostSettings) never ships to the client.
export async function bookPrintCostRoutes(app: FastifyInstance) {
  app.get(
    "/api/books/:id/print-cost",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const rawQuantity = Number((request.query as { quantity?: string }).quantity);
      const quantity = Number.isInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, pageCount: true, printPageCount: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const pageCount = book.printPageCount ?? book.pageCount;
      if (!pageCount) {
        return reply.send({ status: "NO_PAGE_COUNT" });
      }

      const settings = await prisma.printCostSettings.findUnique({ where: { id: SETTINGS_ID } });
      if (!settings) {
        // Distinct from NO_PAGE_COUNT -- the manuscript is fine, nobody has
        // saved rates yet at /admin/settings/print-cost.
        return reply.send({ status: "NO_SETTINGS" });
      }

      const rates = ratesForQuantity(settings, quantity);
      const softcoverCost = rates.baseCostSoftcover + pageCount * rates.costPerPage;
      const hardcoverCost = rates.baseCostHardcover + pageCount * rates.costPerPage;

      return reply.send({
        status: "DONE",
        pageCount,
        quantity,
        softcoverCost: Math.round(softcoverCost * 100) / 100,
        hardcoverCost: Math.round(hardcoverCost * 100) / 100,
      });
    }
  );
}
