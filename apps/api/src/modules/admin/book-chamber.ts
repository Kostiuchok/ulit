import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { requireAdmin } from "../../lib/jwt.middleware";
import { validateIsbn13 } from "../../services/isbn.service";
import { getSignedUrl } from "../../services/storage.service";

// T-2078 -- same annotation-length cap as output-data/page.tsx's
// IsbnReadinessChecklist (ISBN_ANNOTATION_HALF_PAGE_CHARS), kept in sync
// manually since there's no shared-types entry for it yet.
const ISBN_ANNOTATION_HALF_PAGE_CHARS = 1000;

interface BookAuthorEntry {
  lastName?: string;
  firstName?: string;
  middleName?: string;
}

function formatAuthorFullName(bookAuthors: unknown): string | null {
  const authors = Array.isArray(bookAuthors) ? (bookAuthors as BookAuthorEntry[]) : [];
  const a = authors.find((x) => x?.lastName?.trim() && x?.firstName?.trim());
  if (!a) return null;
  return [a.lastName, a.firstName, a.middleName].filter((p) => p?.trim()).join(" ");
}

// A book is "ready" for the ISBN queue once every piece of information the
// Книжкова палата submission checklist requires (docs/isbn-udc-requirements.md)
// is actually present -- this mirrors IsbnReadinessChecklist's checks
// (output-data/page.tsx) but server-side, since that's what gates which
// books show up in /api/admin/isbn-queue, not just what nudges the author.
export function isIsbnReady(book: {
  description: string | null;
  bookAuthors: unknown;
  coverUrl: string | null;
  printPdfUrl: string | null;
}): boolean {
  const descLength = book.description?.trim().length ?? 0;
  const annotationOk = descLength > 0 && descLength <= ISBN_ANNOTATION_HALF_PAGE_CHARS;
  return annotationOk && !!formatAuthorFullName(book.bookAuthors) && !!book.coverUrl && !!book.printPdfUrl;
}

const bookChamberSchema = z.object({
  submittedAt: z.string().datetime().nullable().optional(),
  isbn: z.string().nullable().optional(),
  udcCode: z.string().max(50).nullable().optional(),
  bbkCode: z.string().max(50).nullable().optional(),
  authorSign: z.string().max(50).nullable().optional(),
});

// No public Книжкова палата API exists — a registered publisher (Ulit) submits
// books for cataloguing outside this system, then an admin records the real
// ISBN/УДК/ББК/авторський знак here once received. See docs/TASKS.md T-1954.
export async function bookChamberRoutes(app: FastifyInstance) {
  app.patch(
    "/api/admin/books/:id/book-chamber",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = bookChamberSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const existing = await prisma.book.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw AppError.notFound("Book");

      const { submittedAt, isbn, udcCode, bbkCode, authorSign } = result.data;

      if (isbn !== undefined && isbn !== null) {
        if (!validateIsbn13(isbn)) {
          throw new AppError("Невалідний ISBN-13", 400, "INVALID_ISBN");
        }
        const collision = await prisma.book.findFirst({ where: { isbn, NOT: { id } }, select: { id: true } });
        if (collision) throw new AppError("Цей ISBN вже присвоєно іншій книзі", 400, "ISBN_TAKEN");
      }

      const book = await prisma.book.update({
        where: { id },
        data: {
          bookChamberSubmittedAt: submittedAt === undefined ? undefined : submittedAt ? new Date(submittedAt) : null,
          isbn: isbn === undefined ? undefined : isbn,
          udcCode: udcCode === undefined ? undefined : udcCode,
          bbkCode: bbkCode === undefined ? undefined : bbkCode,
          authorSign: authorSign === undefined ? undefined : authorSign,
        },
        select: { id: true, isbn: true, udcCode: true, bbkCode: true, authorSign: true, bookChamberSubmittedAt: true },
      });

      return reply.send({ book });
    }
  );

  // ─── ISBN registration queue ─────────────────────────────────────────────
  // Books that have cleared moderation, aren't submitted to Книжкова палата
  // yet, and already have every piece of info the submission checklist
  // requires (isIsbnReady) -- i.e. nothing left for the admin to chase the
  // author for, only to hand off externally. Mirrors the shape of
  // /api/admin/distribution/queue.
  app.get("/api/admin/isbn-queue", { preHandler: requireAdmin }, async (_request, reply) => {
    const candidates = await prisma.book.findMany({
      where: { moderationStatus: "APPROVED", bookChamberSubmittedAt: null, isbn: null },
      select: {
        id: true,
        title: true,
        coverUrl: true,
        description: true,
        bookAuthors: true,
        printPdfUrl: true,
        printPageCount: true,
        publishedAt: true,
        author: { select: { name: true } },
      },
      orderBy: { publishedAt: "asc" },
    });

    const books = candidates
      .filter(isIsbnReady)
      .map((b) => ({
        id: b.id,
        title: b.title,
        coverUrl: b.coverUrl,
        authorName: b.author.name,
        authorFullName: formatAuthorFullName(b.bookAuthors),
        printPageCount: b.printPageCount,
        publishedAt: b.publishedAt,
      }));

    return reply.send({ books });
  });

  // ─── ISBN submission package -- links only, nothing generated/stored ────
  // File 1 (annotation + author's full name) is composed on the fly by the
  // .txt route below. File 2 (manuscript) reuses printPdfUrl as-is -- it
  // already carries our own УДК/ББК/ISBN colophon on page 2 (T-1962), which
  // covers the "technical page" a submission needs; no separate blank-page-2
  // render exists or is planned. File 3 is the cover, already a public file.
  app.get(
    "/api/admin/books/:id/isbn-package",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: {
          title: true,
          coverUrl: true,
          description: true,
          bookAuthors: true,
          printPdfUrl: true,
          author: { select: { name: true } },
        },
      });
      if (!book) throw AppError.notFound("Book");

      const authorFullName = formatAuthorFullName(book.bookAuthors);
      if (!isIsbnReady(book)) {
        throw new AppError(
          "Дані книги ще не готові для пакету ISBN (анотація/ПІБ автора/обкладинка/файл рукопису)",
          400,
          "NOT_ISBN_READY"
        );
      }

      const manuscriptPdfUrl = await getSignedUrl(book.printPdfUrl!);

      return reply.send({
        title: book.title,
        authorFullName,
        annotationTxtUrl: `/api/admin/books/${id}/isbn-package/annotation.txt`,
        manuscriptPdfUrl,
        coverUrl: book.coverUrl,
      });
    }
  );

  app.get(
    "/api/admin/books/:id/isbn-package/annotation.txt",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({
        where: { id },
        select: { title: true, description: true, bookAuthors: true },
      });
      if (!book) throw AppError.notFound("Book");

      const authorFullName = formatAuthorFullName(book.bookAuthors) ?? "—";
      const text =
        `Назва книги: ${book.title}\r\n` +
        `Автор (ПІБ): ${authorFullName}\r\n\r\n` +
        `Анотація:\r\n${book.description ?? ""}\r\n`;

      reply.header("Content-Type", "text/plain; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="annotation.txt"`);
      return reply.send(text);
    }
  );
}
