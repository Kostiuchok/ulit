import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";

// Author-facing "Загальна статистика" (T-1951). No traffic/views analytics exist
// anywhere in the schema — this reports only real, already-tracked numbers:
// Royalty revenue grouped by source (SITE/D2D/KDP/GOOGLE) and site unit sales
// from OrderItem. No fabricated "readers"/"interested" counters.
export async function authorStatsRoutes(app: FastifyInstance) {
  app.get("/api/authors/me/stats", { preHandler: authenticate }, async (request, reply) => {
    const books = await prisma.book.findMany({
      where: { authorId: request.user.id },
      select: { id: true, title: true, coverUrl: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    const bookIds = books.map((b) => b.id);

    const royaltyGroups = bookIds.length
      ? await prisma.royalty.groupBy({
          by: ["bookId", "source"],
          where: { bookId: { in: bookIds } },
          _sum: { amount: true },
          _count: { _all: true },
        })
      : [];

    const orderItems = bookIds.length
      ? await prisma.orderItem.findMany({
          where: {
            bookId: { in: bookIds },
            order: { status: { in: ["PAID", "FULFILLED"] } },
          },
          select: { bookId: true },
        })
      : [];

    const unitsSoldByBook: Record<string, number> = {};
    for (const item of orderItems) {
      unitsSoldByBook[item.bookId] = (unitsSoldByBook[item.bookId] ?? 0) + 1;
    }

    const stats = books.map((book) => ({
      book: { id: book.id, title: book.title, coverUrl: book.coverUrl, status: book.status },
      unitsSoldSite: unitsSoldByBook[book.id] ?? 0,
      sources: royaltyGroups
        .filter((g) => g.bookId === book.id)
        .map((g) => ({
          source: g.source,
          revenue: Number(g._sum.amount ?? 0),
          count: g._count._all,
        })),
    }));

    return reply.send({ stats });
  });
}
