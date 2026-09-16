import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import bcrypt from "bcryptjs";

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../services/email.service", () => ({
  sendPasswordReset: vi.fn(),
}));

import { prisma } from "../lib/prisma";
import { sendPasswordReset } from "../services/email.service";
import { passwordResetRoutes } from "../modules/auth/password-reset";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(passwordResetRoutes);
  await app.ready();
  return app;
}

describe("POST /api/users/forgot-password", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("sends a reset email and returns sent:true for an existing user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Author",
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/forgot-password",
      payload: { email: "author@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sent: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetTokenExpiry: expect.any(Date),
        }),
      })
    );
    expect(sendPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ email: "author@example.com", name: "Author" })
    );
  });

  it("returns sent:true without sending an email for an unknown address (no enumeration)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/forgot-password",
      payload: { email: "unknown@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sent: true });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/users/forgot-password",
      payload: { email: "not-an-email" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/users/reset-password", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("updates the password hash and clears the token for a valid token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      passwordResetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/reset-password",
      payload: { token: "valid-token", password: "new-password-123" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });

    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(updateCall.where).toEqual({ id: "user-1" });
    expect(updateCall.data.passwordResetToken).toBeNull();
    expect(updateCall.data.passwordResetTokenExpiry).toBeNull();
    expect(await bcrypt.compare("new-password-123", updateCall.data.passwordHash)).toBe(true);
  });

  it("returns 400 INVALID_TOKEN for an unknown token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/reset-password",
      payload: { token: "bogus", password: "new-password-123" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("INVALID_TOKEN");
  });

  it("returns 400 TOKEN_EXPIRED for an expired token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      passwordResetTokenExpiry: new Date(Date.now() - 1000),
    } as any);

    const response = await app.inject({
      method: "POST",
      url: "/api/users/reset-password",
      payload: { token: "expired-token", password: "new-password-123" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("TOKEN_EXPIRED");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 for a short password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/users/reset-password",
      payload: { token: "some-token", password: "short" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });
});
