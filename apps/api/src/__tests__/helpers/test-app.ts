import Fastify, { FastifyInstance } from "fastify";
import { AppError } from "../../errors/AppError";

// Mirrors the AppError branch of apps/api/src/index.ts so route tests see the
// same status codes the production server sends, without booting Sentry,
// Prisma, or Redis.
export function createTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code });
    }
    const err = error as Error & { statusCode?: number; code?: string };
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: err.message, code: err.code ?? "ERROR" });
    }
    return reply.status(500).send({ error: err.message || "Internal server error" });
  });
  return app;
}
