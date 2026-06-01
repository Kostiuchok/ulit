import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { verifyLiqPaySignature, parseLiqPayData } from "../../services/liqpay.service";
import { getSignedUrl } from "../../services/storage.service";
import { queueOrderPaidEmail } from "../../lib/email-queue";
import { createSiteRoyalties } from "../admin/admin";

const FORMAT_TO_FIELDS: Record<string, string[]> = {
  EBOOK: ["epubUrl", "fb2Url", "mobiUrl"],
  PRINT: ["printPdfUrl"],
};

const FIELD_LABELS: Record<string, string> = {
  epubUrl: "EPUB",
  fb2Url: "FB2",
  mobiUrl: "MOBI",
  printPdfUrl: "PDF (друк)",
};

export async function liqpayRoutes(app: FastifyInstance) {
  // POST /api/payments/liqpay/callback — called by LiqPay server
  app.post("/api/payments/liqpay/callback", async (request, reply) => {
    const body = request.body as Record<string, string>;
    const { data, signature } = body;

    if (!data || !signature) {
      return reply.status(400).send({ error: "Missing data or signature" });
    }

    if (!verifyLiqPaySignature(data, signature)) {
      app.log.warn("LiqPay callback: invalid signature");
      return reply.status(400).send({ error: "Invalid signature" });
    }

    const payload = parseLiqPayData(data);
    const orderId = payload["order_id"] as string;
    const status = payload["status"] as string;
    const paymentId = String(payload["payment_id"] ?? "");

    app.log.info({ orderId, status }, "LiqPay callback received");

    // Accept both real success and sandbox success
    if (status !== "success" && status !== "sandbox") {
      return reply.send({ ok: true });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        items: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                coverUrl: true,
                epubUrl: true,
                fb2Url: true,
                mobiUrl: true,
                printPdfUrl: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      app.log.error({ orderId }, "LiqPay callback: order not found");
      return reply.send({ ok: true });
    }

    if (order.status === "PAID" || order.status === "FULFILLED") {
      return reply.send({ ok: true }); // idempotent
    }

    // Mark order as paid
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID", paymentId },
    });

    // Build download links (48h signed URLs) for email
    const downloadsByBook: Array<{
      bookTitle: string;
      coverUrl: string | null;
      links: Array<{ label: string; url: string }>;
    }> = [];

    for (const item of order.items) {
      const fields = FORMAT_TO_FIELDS[item.format] ?? [];
      const links: Array<{ label: string; url: string }> = [];

      for (const field of fields) {
        const objectName = item.book[field as keyof typeof item.book] as string | null;
        if (!objectName) continue;
        try {
          const url = await getSignedUrl(objectName);
          links.push({ label: FIELD_LABELS[field] ?? field, url });
        } catch {
          // ignore individual failures
        }
      }

      if (links.length > 0) {
        downloadsByBook.push({
          bookTitle: item.book.title,
          coverUrl: item.book.coverUrl,
          links,
        });
      }
    }

    // Create royalty records (70% to author)
    await createSiteRoyalties(orderId);

    // Queue confirmation email with download links
    await queueOrderPaidEmail({
      email: order.user.email,
      name: order.user.name,
      orderId: order.id,
      total: Number(order.total),
      downloads: downloadsByBook,
    });

    return reply.send({ ok: true });
  });
}
