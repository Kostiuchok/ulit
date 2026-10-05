import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/test-app";

const PRIVATE = "sandbox_private_key_test";
const PUBLIC = "sandbox_public_key_test";

const orderFindUnique = vi.hoisted(() => vi.fn());
const orderUpdate = vi.hoisted(() => vi.fn());
const getSignedUrl = vi.hoisted(() => vi.fn(async (name: string) => `https://ulit.render.ua/storage/${name}?X-Amz-Expires=172800`));
const queueOrderPaidEmail = vi.hoisted(() => vi.fn(async () => undefined));
const createSiteRoyalties = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: orderFindUnique,
      update: orderUpdate,
    },
  },
}));

vi.mock("../services/storage.service", () => ({
  getSignedUrl,
}));

vi.mock("../lib/email-queue", () => ({
  queueOrderPaidEmail,
}));

vi.mock("../modules/admin/admin", () => ({
  createSiteRoyalties,
}));

import { generateLiqPayForm, parseLiqPayData, verifyLiqPaySignature } from "../services/liqpay.service";
import { liqpayRoutes } from "../modules/payments/liqpay";

function pendingOrder() {
  return {
    id: "order-1",
    status: "PENDING",
    total: 200,
    user: { email: "buyer@example.com", name: "Покупець" },
    items: [
      {
        format: "EBOOK",
        book: {
          id: "book-1",
          title: "E2E Книга",
          coverUrl: null,
          epubUrl: "private/books/book-1.epub",
          fb2Url: null,
          mobiUrl: null,
          printPdfUrl: null,
        },
      },
    ],
  };
}

describe("LiqPay signature", () => {
  beforeEach(() => {
    process.env.LIQPAY_PUBLIC_KEY = PUBLIC;
    process.env.LIQPAY_PRIVATE_KEY = PRIVATE;
  });

  afterEach(() => {
    delete process.env.LIQPAY_PUBLIC_KEY;
    delete process.env.LIQPAY_PRIVATE_KEY;
  });

  it("signs the checkout payload and round-trips amount, currency, and order id", () => {
    const { data, signature } = generateLiqPayForm({
      orderId: "order-1",
      amount: 200.5,
      description: "Замовлення E2E",
    });

    expect(verifyLiqPaySignature(data, signature)).toBe(true);
    const payload = parseLiqPayData(data);
    expect(payload.amount).toBe(200.5);
    expect(payload.currency).toBe("UAH");
    expect(payload.order_id).toBe("order-1");
    expect(payload.public_key).toBe(PUBLIC);
    expect(payload.action).toBe("pay");
    expect(payload.language).toBe("uk");
  });

  it("rejects a payload whose amount was changed after signing", () => {
    const { data, signature } = generateLiqPayForm({
      orderId: "order-1",
      amount: 200,
      description: "Замовлення",
    });
    const tampered = parseLiqPayData(data);
    tampered.amount = 1;
    const tamperedData = Buffer.from(JSON.stringify(tampered)).toString("base64");

    expect(verifyLiqPaySignature(tamperedData, signature)).toBe(false);
    expect(verifyLiqPaySignature(data, signature + "x")).toBe(false);
  });
});

describe("LiqPay callback", () => {
  beforeEach(() => {
    process.env.LIQPAY_PUBLIC_KEY = PUBLIC;
    process.env.LIQPAY_PRIVATE_KEY = PRIVATE;
    orderFindUnique.mockReset();
    orderUpdate.mockReset();
    getSignedUrl.mockClear();
    queueOrderPaidEmail.mockClear();
    createSiteRoyalties.mockClear();
    orderUpdate.mockResolvedValue({});
  });

  async function postCallback(body: Record<string, string>) {
    const app = createTestApp();
    await liqpayRoutes(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/payments/liqpay/callback",
      payload: body,
    });
    await app.close();
    return res;
  }

  function signed(payload: Record<string, unknown>) {
    const data = Buffer.from(JSON.stringify(payload)).toString("base64");
    const signature = crypto.createHash("sha1").update(PRIVATE + data + PRIVATE).digest("base64");
    return { data, signature };
  }

  it("returns 400 when data or signature is missing", async () => {
    const res = await postCallback({ data: "abc" });
    expect(res.statusCode).toBe(400);
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when the signature does not match the payload", async () => {
    const { data } = signed({ order_id: "order-1", status: "success", amount: 200, payment_id: 9 });
    const res = await postCallback({ data, signature: "not-the-signature" });
    expect(res.statusCode).toBe(400);
    expect(orderFindUnique).not.toHaveBeenCalled();
  });

  it("marks a successful callback paid and emails a 48h signed download link", async () => {
    orderFindUnique.mockResolvedValue(pendingOrder());
    const body = signed({ order_id: "order-1", status: "success", amount: 200, payment_id: 42 });
    const res = await postCallback(body);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "PAID", paymentId: "42" },
    });
    expect(getSignedUrl).toHaveBeenCalledWith("private/books/book-1.epub");
    expect(createSiteRoyalties).toHaveBeenCalledWith("order-1");
    expect(queueOrderPaidEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "buyer@example.com",
        orderId: "order-1",
        downloads: [
          expect.objectContaining({
            bookTitle: "E2E Книга",
            links: [expect.objectContaining({ label: "EPUB", url: expect.stringContaining("X-Amz-Expires=172800") })],
          }),
        ],
      })
    );
  });

  it("accepts the sandbox success status the same way as a live success", async () => {
    orderFindUnique.mockResolvedValue(pendingOrder());
    const res = await postCallback(signed({ order_id: "order-1", status: "sandbox", amount: 200, payment_id: 7 }));
    expect(res.statusCode).toBe(200);
    expect(orderUpdate).toHaveBeenCalled();
  });

  it("does not mark the order paid when LiqPay reports a non-success status", async () => {
    const res = await postCallback(signed({ order_id: "order-1", status: "failure", amount: 200, payment_id: 1 }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(orderFindUnique).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it("is idempotent when the order is already paid", async () => {
    orderFindUnique.mockResolvedValue({ ...pendingOrder(), status: "PAID" });
    const res = await postCallback(signed({ order_id: "order-1", status: "success", amount: 200, payment_id: 1 }));
    expect(res.statusCode).toBe(200);
    expect(orderUpdate).not.toHaveBeenCalled();
    expect(queueOrderPaidEmail).not.toHaveBeenCalled();
  });

  it("rejects a callback whose signed amount was swapped for a different one", async () => {
    const honest = signed({ order_id: "order-1", status: "success", amount: 200, payment_id: 1 });
    const swapped = signed({ order_id: "order-1", status: "success", amount: 1, payment_id: 1 });
    const res = await postCallback({ data: swapped.data, signature: honest.signature });
    expect(res.statusCode).toBe(400);
    expect(orderUpdate).not.toHaveBeenCalled();
  });
});
