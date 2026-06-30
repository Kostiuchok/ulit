import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { sendEmailVerification } from "../../services/email.service";

export async function verifyEmailRoutes(app: FastifyInstance) {
  app.get("/api/users/verify-email", async (request, reply) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      return reply.status(400).send({ error: "Token required", code: "MISSING_TOKEN" });
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
      select: { id: true, emailVerified: true, emailVerificationTokenExpiry: true },
    });

    if (!user) {
      return reply.status(400).send({ error: "Invalid or already used token", code: "INVALID_TOKEN" });
    }

    if (user.emailVerified) {
      return reply.send({ success: true, alreadyVerified: true });
    }

    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
      return reply.status(400).send({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });

    return reply.send({ success: true });
  });

  const resendSchema = z.object({ email: z.string().email() });

  app.post("/api/users/resend-verification", async (request, reply) => {
    const result = resendSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { email } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) {
      return reply.send({ sent: true });
    }

    const verificationToken = crypto.randomUUID();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiry: tokenExpiry,
      },
    });

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    try {
      await sendEmailVerification({ email, name: user.name, verificationUrl });
    } catch (err) {
      app.log.error({ err }, "Failed to resend verification email");
    }

    return reply.send({ sent: true });
  });
}
