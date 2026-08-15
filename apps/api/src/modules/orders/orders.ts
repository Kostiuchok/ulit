import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { authenticate } from "../../lib/jwt.middleware";
import { generateLiqPayForm, LIQPAY_CHECKOUT_URL } from "../../services/liqpay.service";
import { getSignedUrl } from "../../services/storage.service";

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        bookId: z.string(),
        format: z.enum([
          "EBOOK",
          "PRINT_SOFTCOVER",
          "PRINT_HARDCOVER",
          "PRINT_SOFTCOVER_BW",
          "PRINT_HARDCOVER_BW",
        ]),
      })
    )
    .min(1)
    .max(10),
});

// Map order item format to book URL fields for download — all print bindings
// ship the same PDF/X-3 file for now (no separate black-and-white print-ready
// PDF pipeline exists yet in the worker), cover type/color only affects price
// and the print vendor's bindery instructions.
const FORMAT_TO_URLS: Record<string, (keyof typeof BOOK_URL_FIELDS)[]> = {
  EBOOK: ["epubUrl", "fb2Url", "mobiUrl"],
  PRINT_SOFTCOVER: ["printPdfUrl"],
  PRINT_HARDCOVER: ["printPdfUrl"],
  PRINT_SOFTCOVER_BW: ["printPdfUrl"],
  PRINT_HARDCOVER_BW: ["printPdfUrl"],
};

// Which book price field each print format is billed against.
const PRINT_FORMAT_PRICE_FIELD = {
  PRINT_SOFTCOVER: "pricePrint",
  PRINT_HARDCOVER: "pricePrintHardcover",
  PRINT_SOFTCOVER_BW: "pricePrintBw",
  PRINT_HARDCOVER_BW: "pricePrintHardcoverBw",
} as const;

const BOOK_URL_FIELDS = {
  epubUrl: true,
  fb2Url: true,
  mobiUrl: true,
  printPdfUrl: true,
} as const;

type OrderItemBook = {
  epubUrl: string | null;
  fb2Url: string | null;
  mobiUrl: string | null;
  printPdfUrl: string | null;
};

// Shared by GET /api/orders/:id and GET /api/orders (list mine) — builds
// {bookId: [{label, url}]} signed-download-link maps for an order's items.
async function buildDownloadLinks(
  items: { bookId: string; format: string; book: OrderItemBook }[]
): Promise<Record<string, { label: string; url: string }[]>> {
  const downloads: Record<string, { label: string; url: string }[]> = {};

  for (const item of items) {
    const links: { label: string; url: string }[] = [];
    const urlFields = FORMAT_TO_URLS[item.format] ?? [];

    for (const field of urlFields) {
      const objectName = item.book[field as keyof typeof item.book] as string | null;
      if (!objectName) continue;

      const label =
        field === "epubUrl" ? "EPUB" :
        field === "fb2Url" ? "FB2" :
        field === "mobiUrl" ? "MOBI" : "PDF (друк)";

      try {
        const url = await getSignedUrl(objectName);
        links.push({ label, url });
      } catch {
        // signed URL generation failed — skip
      }
    }

    downloads[item.bookId] = links;
  }

  return downloads;
}

export async function ordersRoutes(app: FastifyInstance) {
  // POST /api/orders — create order and return LiqPay form data
  app.post(
    "/api/orders",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = createOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0].message });
      }
      const { items } = parsed.data;

      // Load and validate each requested book
      const bookIds = [...new Set(items.map((i) => i.bookId))];
      const books = await prisma.book.findMany({
        where: { id: { in: bookIds }, status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          priceEbook: true,
          pricePrint: true,
          pricePrintHardcover: true,
          pricePrintBw: true,
          pricePrintHardcoverBw: true,
          epubUrl: true,
          fb2Url: true,
          mobiUrl: true,
          printPdfUrl: true,
        },
      });

      const bookMap = new Map(books.map((b) => [b.id, b]));

      // Build order items with pricing
      type OrderItemInput = { bookId: string; format: string; price: number };
      const orderItems: OrderItemInput[] = [];

      for (const item of items) {
        const book = bookMap.get(item.bookId);
        if (!book) throw AppError.notFound(`Book ${item.bookId}`);

        if (item.format === "EBOOK") {
          if (!book.priceEbook) {
            return reply.status(400).send({ error: `Book "${book.title}" has no ebook price` });
          }
          // Check at least one ebook format is available
          if (!book.epubUrl && !book.fb2Url && !book.mobiUrl) {
            return reply.status(400).send({ error: `Book "${book.title}" has no ebook files yet` });
          }
          orderItems.push({ bookId: item.bookId, format: "EBOOK", price: Number(book.priceEbook) });
        } else {
          const priceField = PRINT_FORMAT_PRICE_FIELD[item.format as keyof typeof PRINT_FORMAT_PRICE_FIELD];
          const price = book[priceField];
          if (!price) {
            return reply.status(400).send({ error: `Book "${book.title}" has no print price` });
          }
          if (!book.printPdfUrl) {
            return reply.status(400).send({ error: `Book "${book.title}" has no print file yet` });
          }
          orderItems.push({ bookId: item.bookId, format: item.format, price: Number(price) });
        }
      }

      const total = orderItems.reduce((s, i) => s + i.price, 0);

      // Create order in DB
      const order = await prisma.order.create({
        data: {
          userId: request.user.id,
          total,
          status: "PENDING",
          items: {
            create: orderItems.map((i) => ({
              bookId: i.bookId,
              format: i.format,
              price: i.price,
            })),
          },
        },
        include: {
          items: { include: { book: { select: { title: true } } } },
        },
      });

      // Build LiqPay payment form
      const description = order.items.map((i) => i.book.title).join(", ");
      const webUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const apiUrl = process.env.API_URL || "http://localhost:3001";

      const liqpay = generateLiqPayForm({
        orderId: order.id,
        amount: total,
        description: `Knyha: ${description}`,
        resultUrl: `${webUrl}/orders/${order.id}`,
        serverUrl: `${apiUrl}/api/payments/liqpay/callback`,
      });

      return reply.status(201).send({
        order: {
          id: order.id,
          total: order.total,
          status: order.status,
          items: order.items.map((i) => ({ bookId: i.bookId, format: i.format, price: i.price })),
        },
        liqpay: {
          data: liqpay.data,
          signature: liqpay.signature,
          action_url: LIQPAY_CHECKOUT_URL,
        },
      });
    }
  );

  // GET /api/orders/:id — order status + download links if paid
  app.get(
    "/api/orders/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
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

      if (!order) throw AppError.notFound("Order");
      if (order.userId !== request.user.id) throw AppError.forbidden("Not your order");

      // Build download links for paid orders
      const downloads =
        order.status === "PAID" || order.status === "FULFILLED"
          ? await buildDownloadLinks(order.items)
          : {};

      return reply.send({
        order: {
          id: order.id,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
          items: order.items.map((i) => ({
            bookId: i.bookId,
            format: i.format,
            price: i.price,
            book: {
              title: i.book.title,
              slug: i.book.slug,
              coverUrl: i.book.coverUrl,
            },
          })),
        },
        downloads,
      });
    }
  );

  // GET /api/orders — list the current user's orders ("Мої покупки")
  app.get(
    "/api/orders",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const orders = await prisma.order.findMany({
        where: { userId: request.user.id },
        include: {
          items: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
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
        orderBy: { createdAt: "desc" },
      });

      const paidOrFulfilled = orders.filter((o) => o.status === "PAID" || o.status === "FULFILLED");
      const downloads = await buildDownloadLinks(paidOrFulfilled.flatMap((o) => o.items));

      return reply.send({
        orders: orders.map((o) => ({
          id: o.id,
          total: o.total,
          status: o.status,
          createdAt: o.createdAt,
          items: o.items.map((i) => ({
            bookId: i.bookId,
            format: i.format,
            price: i.price,
            book: { title: i.book.title, slug: i.book.slug, coverUrl: i.book.coverUrl },
          })),
        })),
        downloads,
      });
    }
  );
}
