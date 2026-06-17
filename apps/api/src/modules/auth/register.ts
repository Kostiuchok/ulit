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

const UK_TRANSLIT: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",
  и:"y",і:"i",ї:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",
  р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",
  щ:"shch",ь:"",ю:"iu",я:"ia",ъ:"",ы:"y",э:"e",ё:"yo",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((ch) => UK_TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || `author-${Date.now()}`;
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
  app.post("/api/users/register", async (request, reply) => {
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

    const token = app.jwt.sign({ id: user.id, sub: user.id, email: user.email, role: user.role });

    return reply.status(201).send({ user, token });
  });
}
