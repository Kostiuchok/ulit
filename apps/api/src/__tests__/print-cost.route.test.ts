import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/test-app";

const auth = vi.hoisted(() => ({ userId: "author-1" }));
const bookFindUnique = vi.hoisted(() => vi.fn());
const settingsFindUnique = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt.middleware", () => ({
  authenticate: async (request: { user: { id: string; sub: string; email: string; role: string } }) => {
    request.user = { id: auth.userId, sub: auth.userId, email: "e2e@render.ua", role: "AUTHOR" };
  },
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    book: { findUnique: bookFindUnique },
    printCostSettings: { findUnique: settingsFindUnique },
  },
}));

import { bookPrintCostRoutes } from "../modules/books/print-cost";

const BASE_SETTINGS = {
  id: "singleton",
  baseCostSoftcover: 80,
  baseCostHardcover: 140,
  costPerPage: 1,
  bulkTiers: [
    { minQuantity: 10, baseCostSoftcover: 70, baseCostHardcover: 120, costPerPage: 0.8 },
    { minQuantity: 100, baseCostSoftcover: 50, baseCostHardcover: 90, costPerPage: 0.5 },
  ],
};

async function getCost(query = "") {
  const app = createTestApp();
  await bookPrintCostRoutes(app);
  const res = await app.inject({ method: "GET", url: `/api/books/book-1/print-cost${query}` });
  await app.close();
  return res;
}

describe("GET /api/books/:id/print-cost", () => {
  beforeEach(() => {
    auth.userId = "author-1";
    bookFindUnique.mockReset();
    settingsFindUnique.mockReset();
    settingsFindUnique.mockResolvedValue(BASE_SETTINGS);
  });

  it("uses printPageCount (not the ebook pageCount) in the per-page formula", async () => {
    // Book 12345-5678 has printPageCount 367. The route must price THAT count.
    bookFindUnique.mockResolvedValue({ authorId: "author-1", printPageCount: 367, pageCount: 10 });
    const res = await getCost();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "DONE",
      pageCount: 367,
      quantity: 1,
      softcoverCost: 80 + 367 * 1,
      hardcoverCost: 140 + 367 * 1,
    });
  });

  it("falls back to pageCount only when printPageCount is absent", async () => {
    bookFindUnique.mockResolvedValue({ authorId: "author-1", printPageCount: null, pageCount: 12 });
    const res = await getCost();
    expect(res.json()).toMatchObject({ status: "DONE", pageCount: 12, softcoverCost: 92 });
  });

  it("does not treat a zero printPageCount as a real count", async () => {
    bookFindUnique.mockResolvedValue({ authorId: "author-1", printPageCount: 0, pageCount: 12 });
    const res = await getCost();
    expect(res.json()).toEqual({ status: "NO_PAGE_COUNT" });
  });

  it("returns NO_PAGE_COUNT and NO_SETTINGS as distinct empty states", async () => {
    bookFindUnique.mockResolvedValue({ authorId: "author-1", printPageCount: null, pageCount: null });
    expect((await getCost()).json()).toEqual({ status: "NO_PAGE_COUNT" });

    bookFindUnique.mockResolvedValue({ authorId: "author-1", printPageCount: 20, pageCount: 20 });
    settingsFindUnique.mockResolvedValue(null);
    expect((await getCost()).json()).toEqual({ status: "NO_SETTINGS" });
  });

  it("picks the highest bulk tier the quantity qualifies for, else the base rates", async () => {
    bookFindUnique.mockResolvedValue({ authorId: "author-1", printPageCount: 10, pageCount: 10 });

    expect((await getCost("?quantity=1")).json()).toMatchObject({
      quantity: 1,
      softcoverCost: 80 + 10,
      hardcoverCost: 140 + 10,
    });
    expect((await getCost("?quantity=50")).json()).toMatchObject({
      quantity: 50,
      softcoverCost: Math.round((70 + 10 * 0.8) * 100) / 100,
      hardcoverCost: Math.round((120 + 10 * 0.8) * 100) / 100,
    });
    expect((await getCost("?quantity=100")).json()).toMatchObject({
      quantity: 100,
      softcoverCost: 50 + 10 * 0.5,
    });
    // Garbage quantity falls back to a single copy, not NaN.
    expect((await getCost("?quantity=nope")).json()).toMatchObject({ quantity: 1, softcoverCost: 90 });
  });

  it("rounds money to cents", async () => {
    bookFindUnique.mockResolvedValue({ authorId: "author-1", printPageCount: 3, pageCount: 3 });
    settingsFindUnique.mockResolvedValue({
      baseCostSoftcover: 10.004,
      baseCostHardcover: 20.006,
      costPerPage: 0.001,
      bulkTiers: [],
    });
    const body = (await getCost()).json();
    expect(body.softcoverCost).toBe(10.01);
    expect(body.hardcoverCost).toBe(20.01);
  });

  it("404s a missing book and 403s someone else's book", async () => {
    bookFindUnique.mockResolvedValue(null);
    expect((await getCost()).statusCode).toBe(404);

    bookFindUnique.mockResolvedValue({ authorId: "someone-else", printPageCount: 10, pageCount: 10 });
    expect((await getCost()).statusCode).toBe(403);
  });
});
