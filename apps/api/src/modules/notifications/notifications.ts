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

  // T-2079 -- opening a book (from the sidebar, the book list, or a direct
  // link) is itself the author "looking at" whatever the moderator said
  // about it -- no reason to make them separately open the bell dropdown
  // and click each notification one by one. BookDashboard.tsx calls this on
  // mount; the bell's own count/list picks it up via the existing
  // `ulit:books-changed` refresh (same event apps/web already dispatches
  // for every other cross-component "something changed" signal).
  app.patch("/api/notifications/book/:bookId/read", { preHandler: authenticate }, async (request, reply) => {
    const { bookId } = request.params as { bookId: string };
    await prisma.notification.updateMany({
      where: { userId: request.user.id, bookId, read: false },
      data: { read: true },
    });
    return reply.send({ ok: true });
  });

  // T-2080 -- "прочитати всі" (above) only changes status; this actually
  // empties the list, same "Clear all" a standard notification center
  // offers alongside "mark all read" as two distinct actions.
  app.delete("/api/notifications", { preHandler: authenticate }, async (request, reply) => {
    await prisma.notification.deleteMany({ where: { userId: request.user.id } });
    return reply.send({ ok: true });
  });
}
