import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";

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

  app.get("/api/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API running at http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
