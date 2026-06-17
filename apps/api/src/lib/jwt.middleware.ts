import { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../errors/AppError";
import { prisma } from "./prisma";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; sub: string; email: string; role: string };
    user: { id: string; sub: string; email: string; role: string };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    const err = AppError.unauthorized("Invalid or missing token");
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    if (request.user.role !== "ADMIN") {
      const err = AppError.forbidden("Admin access required");
      return reply.status(err.statusCode).send({ error: err.message, code: err.code });
    }
  } catch {
    const err = AppError.unauthorized("Invalid or missing token");
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
}

export async function attachUser(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    // optional auth — user may be null
  }
}
