import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const oauthLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
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

// Called server-side only, by NextAuth's jwt callback when a user signs in
// via an OAuth provider (Google, Apple, ...). Guarded by a shared secret so
// it can't be used to mint tokens for arbitrary emails from the public internet.
export async function oauthLoginRoute(app: FastifyInstance) {
  app.post("/api/users/oauth-login", async (request, reply) => {
    const secret = request.headers["x-internal-secret"];
    if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
      throw AppError.unauthorized("Invalid internal secret");
    }

    const result = oauthLoginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { email, name, avatarUrl } = result.data;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const slug = await uniqueSlug(name);
      user = await prisma.user.create({
        data: { email, name, slug, avatarUrl, emailVerified: true },
      });
    }

    const token = app.jwt.sign({ id: user.id, sub: user.id, email: user.email, role: user.role });

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
