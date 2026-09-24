import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { cancelExpiredPendingOrders } from "../orders/orders";

const listQuerySchema = z.object({
  status: z.enum(["PENDING", "PAID", "FULFILLED", "CANCELLED"]).optional(),
});

const orderSelect = {
  id: true,
  total: true,
  status: true,
  paymentId: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  items: {
    select: {
      id: true,
      format: true,
      formats: true,
      price: true,
      book: { select: { id: true, title: true, slug: true, coverUrl: true } },
    },
  },
} as const;

export async function adminOrdersRoutes(app: FastifyInstance) {
  app.get("/api/admin/orders", { preHandler: requireAdmin }, async (request, reply) => {
    await cancelExpiredPendingOrders();
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { status } = parsed.data;

    const orders = await prisma.order.findMany({
      where: status ? { status } : {},
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return reply.send({
      orders: orders.map(serializeOrder),
    });
  });

  app.get("/api/admin/orders/:id", { preHandler: requireAdmin }, async (request, reply) => {
    await cancelExpiredPendingOrders();
    const { id } = request.params as { id: string };
    const order = await prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });
    if (!order) throw AppError.notFound("Order");
    return reply.send({ order: serializeOrder(order) });
  });
}

function serializeOrder(order: {
  id: string;
  total: { toString(): string } | number;
  status: string;
  paymentId: string | null;
  createdAt: Date;
  user: { id: string; name: string; email: string };
  items: {
    id: string;
    format: string;
    formats: string[];
    price: { toString(): string } | number;
    book: { id: string; title: string; slug: string; coverUrl: string | null };
  }[];
}) {
  return {
    id: order.id,
    total: Number(order.total),
    status: order.status,
    paymentId: order.paymentId,
    createdAt: order.createdAt,
    user: order.user,
    items: order.items.map((item) => ({
      id: item.id,
      format: item.format,
      formats: item.formats,
      price: Number(item.price),
      book: item.book,
    })),
  };
}
