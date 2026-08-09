import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import { AppError } from "./errors/AppError";
import { prisma } from "./lib/prisma";
import { registerRoute } from "./modules/auth/register";
import { loginRoute } from "./modules/auth/login";
import { oauthLoginRoute } from "./modules/auth/oauth-login";
import { verifyEmailRoutes } from "./modules/auth/verify-email";
import { meRoute } from "./modules/auth/me";
import { usersMe } from "./modules/users/me";
import { usersAvatar } from "./modules/users/avatar";
import { usersContractRoutes } from "./modules/users/contract";
import { booksRoutes } from "./modules/books/books";
import { bookRoutes } from "./modules/books/book";
import { uploadDocxRoute } from "./modules/books/upload";
import { uploadCoverRoute } from "./modules/books/cover";
import { uploadBackCoverRoute } from "./modules/books/back-cover";
import { conversionStatusRoutes } from "./modules/books/conversion-status";
import { distributionRoutes } from "./modules/books/distribution";
import { publishRoute } from "./modules/books/publish";
import { republishRoute } from "./modules/books/republish";
import { authorStatsRoutes } from "./modules/books/stats";
import { bookPagesRoutes } from "./modules/books/pages";
import { bookManuscriptRoutes } from "./modules/books/manuscript";
import { authorStyleSetRoutes } from "./modules/books/style-sets";
import { storeBooksRoutes } from "./modules/store/store-books";
import { ordersRoutes } from "./modules/orders/orders";
import { royaltiesMeRoutes } from "./modules/royalties/me";
import { liqpayRoutes } from "./modules/payments/liqpay";
import { adminRoutes } from "./modules/admin/admin";
import { startEmailWorker } from "./lib/email-queue";
import { metricsRegistry } from "./lib/metrics";

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});

async function bootstrap() {
  await app.register(cors, {
    origin: process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
  });

  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(formbody);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    // API sits behind Next.js's server-side rewrite proxy, so request.ip is always
    // that proxy's docker-internal address — never the real client. Key by the
    // authenticated user instead so one noisy user/session can't exhaust the
    // shared budget for every other visitor; anonymous requests fall back to IP.
    keyGenerator: async (request) => {
      try {
        await request.jwtVerify();
        return `user:${request.user.id}`;
      } catch {
        return `ip:${request.ip}`;
      }
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code });
    }
    const err = error as Error & { statusCode?: number; code?: string };
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: err.message, code: err.code ?? "ERROR" });
    }
    app.log.error({
      err: { message: err.message, stack: err.stack, name: err.name },
      req: { method: request.method, url: request.url, id: request.id },
    }, "Unhandled error");
    return reply.status(500).send({ error: "Internal server error", code: "INTERNAL_ERROR" });
  });

  app.get("/api/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  app.get("/api/metrics", async (_request, reply) => {
    reply.header("Content-Type", metricsRegistry.contentType);
    return reply.send(await metricsRegistry.metrics());
  });

  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.register(oauthLoginRoute);
  await app.register(verifyEmailRoutes);
  await app.register(meRoute);
  await app.register(usersMe);
  await app.register(usersAvatar);
  await app.register(usersContractRoutes);
  await app.register(booksRoutes);
  await app.register(bookRoutes);
  await app.register(uploadDocxRoute);
  await app.register(uploadCoverRoute);
  await app.register(uploadBackCoverRoute);
  await app.register(conversionStatusRoutes);
  await app.register(distributionRoutes);
  await app.register(publishRoute);
  await app.register(republishRoute);
  await app.register(bookPagesRoutes);
  await app.register(bookManuscriptRoutes);
  await app.register(authorStyleSetRoutes);
  await app.register(authorStatsRoutes);
  await app.register(storeBooksRoutes);
  await app.register(ordersRoutes);
  await app.register(royaltiesMeRoutes);
  await app.register(liqpayRoutes);
  await app.register(adminRoutes);

  // Auto-promote ADMIN_EMAIL to ADMIN role (safe: only upgrades AUTHOR, never downgrades)
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const result = await prisma.user.updateMany({
      where: { email: adminEmail, role: "AUTHOR" },
      data: { role: "ADMIN", emailVerified: true },
    });
    if (result.count > 0) {
      app.log.info(`Promoted ${adminEmail} to ADMIN`);
    }
  }

  // Email worker runs in the API process
  startEmailWorker();

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API running at http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
