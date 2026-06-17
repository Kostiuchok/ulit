import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";

// ── Mock prisma before importing routes ──────────────────────────────────────
vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma";
import { registerRoute } from "../modules/auth/register";
import { loginRoute } from "../modules/auth/login";
import { AppError } from "../errors/AppError";

// ── Test app factory ─────────────────────────────────────────────────────────
async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(jwt, { secret: "test-secret" });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code });
    }
    return reply.status(500).send({ error: "Internal server error" });
  });

  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.ready();
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/users/register", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 201 with user + token for valid input", async () => {
    const mockUser = {
      id: "user-1",
      email: "author@example.com",
      name: "Test Author",
      slug: "test-author",
      role: "AUTHOR",
      createdAt: new Date(),
    };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/register",
      payload: { email: "author@example.com", password: "secret123", name: "Test Author" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user.email).toBe("author@example.com");
    expect(body.token).toBeTruthy();
  });

  it("returns 400 for invalid email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/users/register",
      payload: { email: "not-an-email", password: "secret123", name: "Author" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for short password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/users/register",
      payload: { email: "a@b.com", password: "short", name: "Author" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("8 characters");
  });

  it("returns 409 when email already registered", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as any);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/register",
      payload: { email: "taken@example.com", password: "secret123", name: "Author" },
    });

    expect(response.statusCode).toBe(409);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/users/register",
      payload: { email: "a@b.com" },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /api/users/login", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("returns 200 with token for valid credentials", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "a@b.com",
      name: "Author",
      slug: "author",
      role: "AUTHOR",
      avatarUrl: null,
      passwordHash: hash,
    } as any);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/login",
      payload: { email: "a@b.com", password: "correct-password" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("a@b.com");
  });

  it("returns 401 for wrong password", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      passwordHash: hash,
    } as any);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/login",
      payload: { email: "a@b.com", password: "wrong-password" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 401 for non-existent email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/login",
      payload: { email: "unknown@example.com", password: "any-password" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 for missing password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/users/login",
      payload: { email: "a@b.com" },
    });

    expect(response.statusCode).toBe(400);
  });
});
