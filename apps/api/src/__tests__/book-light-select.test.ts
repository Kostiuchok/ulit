import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";

// ── Mock prisma before importing the route ──────────────────────────────────
vi.mock("../lib/prisma", () => ({
  prisma: {
    book: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma";
import { bookRoutes } from "../modules/books/book";
import { AppError } from "../errors/AppError";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: "test-secret" });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code });
    }
    return reply.status(500).send({ error: "Internal server error" });
  });

  await app.register(bookRoutes);
  await app.ready();
  return app;
}

const AUTHOR_ID = "author-1";

// GET /api/books/:id always runs assertOwnership first, which does its OWN
// prisma.book.findUnique (a small ownership-only select) -- so the mock's
// FIRST resolved call is always that, and the SECOND is the handler's real
// select (BOOK_SELECT or BOOK_SELECT_LIGHT, depending on ?fields=light).
function mockOwnershipThenBook(book: Record<string, unknown>) {
  vi.mocked(prisma.book.findUnique)
    .mockResolvedValueOnce({ authorId: AUTHOR_ID, status: "DRAFT" } as any)
    .mockResolvedValueOnce(book as any);
}

describe("GET /api/books/:id -- light select (T-? perf: dashboard overview)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    token = app.jwt.sign({ id: AUTHOR_ID, sub: AUTHOR_ID, email: "a@b.com", role: "AUTHOR" });
  });

  it("without ?fields=light, the select includes coverDesign and coverImageLibrary", async () => {
    mockOwnershipThenBook({ id: "book-1", title: "Book", coverDesign: { front: [] }, coverImageLibrary: [] });

    const response = await app.inject({
      method: "GET",
      url: "/api/books/book-1",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const secondCall = vi.mocked(prisma.book.findUnique).mock.calls[1][0] as any;
    expect(secondCall.select.coverDesign).toBe(true);
    expect(secondCall.select.coverImageLibrary).toBe(true);
  });

  it("with ?fields=light, the select omits coverDesign and coverImageLibrary", async () => {
    mockOwnershipThenBook({ id: "book-1", title: "Book" });

    const response = await app.inject({
      method: "GET",
      url: "/api/books/book-1?fields=light",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const secondCall = vi.mocked(prisma.book.findUnique).mock.calls[1][0] as any;
    expect(secondCall.select.coverDesign).toBeUndefined();
    expect(secondCall.select.coverImageLibrary).toBeUndefined();
    // Everything else BOOK_SELECT carries (incl. the cover image URLs the
    // dashboard DOES render) must still be there -- light drops exactly
    // those two heavy fields, nothing more.
    expect(secondCall.select.coverUrl).toBe(true);
    expect(secondCall.select.title).toBe(true);
  });

  it("an unknown ?fields value falls back to the full select (only \"light\" is special-cased)", async () => {
    mockOwnershipThenBook({ id: "book-1", title: "Book" });

    await app.inject({
      method: "GET",
      url: "/api/books/book-1?fields=anything-else",
      headers: { Authorization: `Bearer ${token}` },
    });

    const secondCall = vi.mocked(prisma.book.findUnique).mock.calls[1][0] as any;
    expect(secondCall.select.coverDesign).toBe(true);
  });
});
