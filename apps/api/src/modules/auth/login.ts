import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginRoute(app: FastifyInstance) {
  app.post("/api/users/login", async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        slug: user.slug,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  });
}
