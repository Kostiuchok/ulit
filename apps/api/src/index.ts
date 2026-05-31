import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { AppError } from "./errors/AppError";
import { registerRoute } from "./modules/auth/register";
import { loginRoute } from "./modules/auth/login";
import { meRoute } from "./modules/auth/me";

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

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API running at http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
