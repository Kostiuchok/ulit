import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { AppError } from "./errors/AppError";
import { registerRoute } from "./modules/auth/register";
import { loginRoute } from "./modules/auth/login";
import { meRoute } from "./modules/auth/me";
import { usersMe } from "./modules/users/me";
import { usersAvatar } from "./modules/users/avatar";
import { booksRoutes } from "./modules/books/books";
import { bookRoutes } from "./modules/books/book";
import { uploadDocxRoute } from "./modules/books/upload";
import { uploadCoverRoute } from "./modules/books/cover";
import { conversionStatusRoutes } from "./modules/books/conversion-status";

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});

async function bootstrap() {
  await app.register(cors, {
    origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
  });

  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "Internal server error", code: "INTERNAL_ERROR" });
  });

  app.get("/api/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.register(meRoute);
  await app.register(usersMe);
  await app.register(usersAvatar);
  await app.register(booksRoutes);
  await app.register(bookRoutes);
  await app.register(uploadDocxRoute);
  await app.register(uploadCoverRoute);
  await app.register(conversionStatusRoutes);

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API running at http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
