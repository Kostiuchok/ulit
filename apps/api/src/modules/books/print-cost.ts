import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const SETTINGS_ID = "singleton";

// Author-facing print-cost estimate, computed server-side so the raw admin
// rate config (PrintCostSettings) never ships to the client.
export async function bookPrintCostRoutes(app: FastifyInstance) {
  app.get(
    "/api/books/:id/print-cost",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

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

      const softcoverCost = Number(settings.baseCostSoftcover) + pageCount * Number(settings.costPerPage);
      const hardcoverCost = Number(settings.baseCostHardcover) + pageCount * Number(settings.costPerPage);

      return reply.send({
        status: "DONE",
        pageCount,
        softcoverCost: Math.round(softcoverCost * 100) / 100,
        hardcoverCost: Math.round(hardcoverCost * 100) / 100,
      });
    }
  );
}
