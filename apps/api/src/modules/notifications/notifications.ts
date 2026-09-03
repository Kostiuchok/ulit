import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

// In-app counterpart to the admin approve/reject emails (email-queue.ts) --
// created in admin.ts alongside queuePublishedEmail/queueRejectedEmail so the
// author's bell + book badges have something to query for unread state.
export async function notificationsRoutes(app: FastifyInstance) {
  app.get("/api/notifications", { preHandler: authenticate }, async (request, reply) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: request.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { book: { select: { id: true, title: true } } },
      }),
      prisma.notification.count({ where: { userId: request.user.id, read: false } }),
    ]);

    return reply.send({ notifications, unreadCount });
  });

  app.patch("/api/notifications/:id/read", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== request.user.id) throw AppError.notFound("Notification");

    const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
    return reply.send({ notification: updated });
  });

  app.patch("/api/notifications/read-all", { preHandler: authenticate }, async (request, reply) => {
    await prisma.notification.updateMany({
      where: { userId: request.user.id, read: false },
      data: { read: true },
    });
    return reply.send({ ok: true });
  });
}
