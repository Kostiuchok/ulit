import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { sendPasswordReset } from "../../services/email.service";

const forgotPasswordSchema = z.object({ email: z.string().email() });

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function passwordResetRoutes(app: FastifyInstance) {
  app.post("/api/users/forgot-password", async (request, reply) => {
    const result = forgotPasswordSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { email } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return reply.send({ sent: true });
    }

    const resetToken = crypto.randomUUID();
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiry: tokenExpiry,
      },
    });

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    try {
      await sendPasswordReset({ email, name: user.name, resetUrl });
    } catch (err) {
      app.log.error({ err }, "Failed to send password reset email");
    }

    return reply.send({ sent: true });
  });

  app.post("/api/users/reset-password", async (request, reply) => {
    const result = resetPasswordSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { token, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
      select: { id: true, passwordResetTokenExpiry: true },
    });

    if (!user) {
      return reply.status(400).send({ error: "Invalid or already used token", code: "INVALID_TOKEN" });
    }

    if (user.passwordResetTokenExpiry && user.passwordResetTokenExpiry < new Date()) {
      return reply.status(400).send({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    return reply.send({ success: true });
  });
}
