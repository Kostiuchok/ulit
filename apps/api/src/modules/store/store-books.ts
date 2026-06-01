import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { getSignedUrl } from "../../services/storage.service";

const querySchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  format: z.enum(["EPUB", "FB2", "MOBI", "PRINT"]).optional(),
  cursor: z.string().optional(), // last seen book id
  take: z.coerce.number().int().min(1).max(50).default(12),
});

const BOOK_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  coverUrl: true,
  priceEbook: true,
  pricePrint: true,
  genre: true,
  language: true,
  isbn: true,
  pageCount: true,
  publishedAt: true,
  epubUrl: true,
  fb2Url: true,
  mobiUrl: true,
  printPdfUrl: true,
  distributionStrategy: true,
  author: { select: { id: true, name: true, slug: true, avatarUrl: true } },
};

export async function storeBooksRoutes(app: FastifyInstance) {
  // T-801 — catalog with filters + full-text search + cursor pagination
  app.get("/api/store/books", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }
    const { q, genre, language, format, cursor, take } = parsed.data;

    // Build format filter (book has the corresponding URL field)
    const formatFilter: Record<string, object> = {
      EPUB: { epubUrl: { not: null } },
      FB2: { fb2Url: { not: null } },
      MOBI: { mobiUrl: { not: null } },
      PRINT: { printPdfUrl: { not: null } },
    };

    // T-808 — full-text search via PostgreSQL tsvector
    let bookIds: string[] | undefined;
    if (q?.trim()) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Book"
        WHERE status = 'PUBLISHED'
          AND to_tsvector('simple', title || ' ' || COALESCE(description, ''))
              @@ plainto_tsquery('simple', ${q.trim()})
        LIMIT 200
      `;
      bookIds = rows.map((r) => r.id);
      if (bookIds.length === 0) {
        return reply.send({ books: [], nextCursor: null });
      }
    }

    const books = await prisma.book.findMany({
      where: {
        status: "PUBLISHED",
        ...(bookIds ? { id: { in: bookIds } } : {}),
        ...(genre ? { genre } : {}),
        ...(language ? { language } : {}),
        ...(format ? formatFilter[format] : {}),
      },
      select: BOOK_SELECT,
      orderBy: { publishedAt: "desc" },
      take: take + 1,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    });

    const hasMore = books.length > take;
    const page = hasMore ? books.slice(0, take) : books;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return reply.send({ books: page, nextCursor });
  });

  // T-802 — single book by slug
  app.get("/api/store/books/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const book = await prisma.book.findUnique({
      where: { slug },
      select: {
        ...BOOK_SELECT,
        status: true,
        moderationStatus: true,
        pdfUrl: true,
        previewStart: true,
        previewEnd: true,
        kdpSelectEnrolled: true,
        kdpSelectExpiry: true,
        createdAt: true,
      },
    });
    if (!book || book.status !== "PUBLISHED") throw AppError.notFound("Book");
    return reply.send({ book });
  });

  // T-803 — author public profile by slug
  app.get("/api/store/authors/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const author = await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        books: {
          where: { status: "PUBLISHED" },
          select: BOOK_SELECT,
          orderBy: { publishedAt: "desc" },
        },
      },
    });
    if (!author) throw AppError.notFound("Author");
    return reply.send({ author });
  });

  // T-1003 — public EPUB preview config for a book
  app.get("/api/store/books/:slug/preview", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const book = await prisma.book.findUnique({
      where: { slug },
      select: {
        status: true,
        epubUrl: true,
        previewStart: true,
        previewEnd: true,
        pageCount: true,
      },
    });

    if (!book || book.status !== "PUBLISHED") throw AppError.notFound("Book");
    if (!book.epubUrl) {
      return reply.status(404).send({ error: "No EPUB available for preview" });
    }

    const previewUrl = await getSignedUrl(book.epubUrl);

    return reply.send({
      previewUrl,
      previewStart: book.previewStart,
      previewEnd: book.previewEnd,
      pageCount: book.pageCount,
    });
  });

  // Genres list (for filter UI)
  app.get("/api/store/genres", async (_request, reply) => {
    const genres = await prisma.book.findMany({
      where: { status: "PUBLISHED", genre: { not: null } },
      select: { genre: true },
      distinct: ["genre"],
      orderBy: { genre: "asc" },
    });
    return reply.send({ genres: genres.map((g) => g.genre).filter(Boolean) });
  });
}
