import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  genre: z.string().max(100).optional(),
  language: z.string().length(2).default("uk"),
  priceEbook: z.number().positive().optional(),
  pricePrint: z.number().positive().optional(),
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).default("WIDE"),
});

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function uniqueBookSlug(base: string): Promise<string> {
  const slug = slugifyTitle(base) || `book-${Date.now()}`;
  let candidate = slug;
  let i = 1;
  while (await prisma.book.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}

export async function booksRoutes(app: FastifyInstance) {
  // List author's books
  app.get("/api/books", { preHandler: authenticate }, async (request, reply) => {
    const books = await prisma.book.findMany({
      where: { authorId: request.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        moderationStatus: true,
        coverUrl: true,
        priceEbook: true,
        pricePrint: true,
        genre: true,
        language: true,
        pageCount: true,
        isbn: true,
        distributionStrategy: true,
        d2dStatus: true,
        kdpStatus: true,
        googleStatus: true,
        createdAt: true,
        publishedAt: true,
      },
    });
    return reply.send({ books });
  });

  // Create draft book
  app.post("/api/books", { preHandler: authenticate }, async (request, reply) => {
    const result = createSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const { title, description, genre, language, priceEbook, pricePrint, distributionStrategy } = result.data;
    const slug = await uniqueBookSlug(title);

    const book = await prisma.book.create({
      data: {
        slug,
        title,
        description,
        genre,
        language,
        priceEbook: priceEbook ? priceEbook : undefined,
        pricePrint: pricePrint ? pricePrint : undefined,
        distributionStrategy,
        authorId: request.user.id,
        status: "DRAFT",
      },
    });

    return reply.status(201).send({ book });
  });
}
