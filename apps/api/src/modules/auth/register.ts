import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let i = 1;
  while (await prisma.user.findUnique({ where: { slug } })) {
    slug = `${slugify(base)}-${i++}`;
  }
  return slug;
}

export async function registerRoute(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { email, password, name } = result.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw AppError.conflict("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = await uniqueSlug(name);

    const user = await prisma.user.create({
      data: { email, passwordHash, name, slug },
      select: { id: true, email: true, name: true, slug: true, role: true, createdAt: true },
    });

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });

    return reply.status(201).send({ user, token });
  });
}
