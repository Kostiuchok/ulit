import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";

// Author-facing royalties list — mirrors the admin view (admin/admin.ts "Royalties"
// section) but scoped to the current author and without the pay/export actions.
export async function royaltiesMeRoutes(app: FastifyInstance) {
  app.get("/api/royalties/me", { preHandler: authenticate }, async (request, reply) => {
    const royalties = await prisma.royalty.findMany({
      where: { authorId: request.user.id },
      include: { book: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });

    let earned = 0;
    let paid = 0;
    let pending = 0;
    for (const r of royalties) {
      const amount = Number(r.amount);
      earned += amount;
      if (r.status === "PAID") paid += amount;
      else pending += amount;
    }

    return reply.send({
      summary: { earned, paid, pending },
      royalties: royalties.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        source: r.source,
        status: r.status,
        paidAt: r.paidAt,
        createdAt: r.createdAt,
        book: r.book,
      })),
    });
  });
}
