import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";

// ── Mock prisma before importing the route ──────────────────────────────────
vi.mock("../lib/prisma", () => ({
  prisma: {
    book: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma";
import { booksRoutes, profileBookAuthor } from "../modules/books/books";
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

  await app.register(booksRoutes);
  await app.ready();
  return app;
}

const AUTHOR_ID = "author-1";
const ANNOTATION = "а".repeat(130);

// The "Створити книжку" dialog sends the title and nothing else (the
// creation wizard is gone, 2026-10-06) -- the server supplies the rest.
describe("POST /api/books -- a book is created from its title alone", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let token: string;

  function post(payload: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: "/api/books",
      headers: { Authorization: `Bearer ${token}` },
      payload,
    });
  }
  const createdData = () => vi.mocked(prisma.book.create).mock.calls[0][0].data as Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    token = app.jwt.sign({ id: AUTHOR_ID, sub: AUTHOR_ID, email: "a@b.com", role: "AUTHOR" });
    // uniqueBookSlug: the slug is free.
    vi.mocked(prisma.book.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.book.create).mockImplementation((async ({ data }: any) => ({ id: "book-1", ...data })) as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Тарас",
      lastName: "Шевченко",
      patronymic: "Григорович",
      avatarUrl: "https://ulit.render.ua/storage/avatars/a.jpg",
    } as any);
  });

  it("title only -> 201, draft with the default size and the author from the profile", async () => {
    const response = await post({ title: "Кобзар" });

    expect(response.statusCode).toBe(201);
    const data = createdData();
    expect(data.title).toBe("Кобзар");
    expect(data.status).toBe("DRAFT");
    expect(data.authorId).toBe(AUTHOR_ID);
    expect(data.description).toBeUndefined();
    expect(data.printFormatKey).toBe("standard");
    expect(data.printWidthMm).toBe(130);
    expect(data.printHeightMm).toBe(200);
    expect(data.bookAuthors).toEqual([
      {
        lastName: "Шевченко",
        firstName: "Тарас",
        middleName: "Григорович",
        photoUrl: "https://ulit.render.ua/storage/avatars/a.jpg",
      },
    ]);
  });

  it("a profile without a name leaves the book's authors empty instead of failing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: null,
      lastName: null,
      patronymic: null,
      avatarUrl: null,
    } as any);

    const response = await post({ title: "Без імені" });

    expect(response.statusCode).toBe(201);
    expect(createdData().bookAuthors).toBeUndefined();
  });

  it("no title -> 400, nothing created", async () => {
    for (const payload of [{}, { title: "" }]) {
      const response = await post(payload);
      expect(response.statusCode).toBe(400);
    }
    expect(prisma.book.create).not.toHaveBeenCalled();
  });

  it("an annotation is optional, but a too-short one is still rejected", async () => {
    const short = await post({ title: "Книга", description: "коротко" });
    expect(short.statusCode).toBe(400);
    expect(prisma.book.create).not.toHaveBeenCalled();

    const ok = await post({ title: "Книга", description: ANNOTATION });
    expect(ok.statusCode).toBe(201);
    expect(createdData().description).toBe(ANNOTATION);
  });

  it("an explicit size and explicit authors win over the defaults", async () => {
    const response = await post({
      title: "Книга",
      printFormatKey: "a4",
      bookAuthors: [{ lastName: "Українка", firstName: "Леся" }],
    });

    expect(response.statusCode).toBe(201);
    const data = createdData();
    expect(data.printFormatKey).toBe("a4");
    expect(data.bookAuthors).toEqual([{ lastName: "Українка", firstName: "Леся" }]);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("profileBookAuthor", () => {
  it("drops a photo address that is not a URL but keeps the author", () => {
    expect(profileBookAuthor({ firstName: "Іван", lastName: "Франко", avatarUrl: "/storage/a.jpg" })).toEqual({
      lastName: "Франко",
      firstName: "Іван",
    });
  });

  it("returns null without a first or last name", () => {
    expect(profileBookAuthor(null)).toBeNull();
    expect(profileBookAuthor({ firstName: "Іван", lastName: "  " })).toBeNull();
  });
});
