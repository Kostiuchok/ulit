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
// missingIsbnReadyFields() names exactly which check(s) fail, in Ukrainian,
// so an admin looking at one specific book's error (not the queue, which
// just silently omits not-ready books) sees why -- printPdfUrl in
// particular is easy to miss, since it's the PRINT-format PDF, not the
// EPUB the admin/books list's own checklist column shows as "EPUB ✓".
export function missingIsbnReadyFields(book: {
  description: string | null;
  bookAuthors: unknown;
  coverUrl: string | null;
  printPdfUrl: string | null;
}): string[] {
  const missing: string[] = [];
  const descLength = book.description?.trim().length ?? 0;
  if (descLength === 0) {
    missing.push("анотація відсутня");
  } else if (descLength > ISBN_ANNOTATION_HALF_PAGE_CHARS) {
    missing.push(`анотація задовга (${descLength} символів, максимум ${ISBN_ANNOTATION_HALF_PAGE_CHARS})`);
  }
  if (!formatAuthorFullName(book.bookAuthors)) missing.push("не вказано повне ПІБ автора");
  if (!book.coverUrl) missing.push("не завантажена обкладинка");
  if (!book.printPdfUrl) missing.push("не згенеровано друкований PDF рукопису (формат друку)");
  return missing;
}

export function isIsbnReady(book: {
  description: string | null;
  bookAuthors: unknown;
  coverUrl: string | null;
  printPdfUrl: string | null;
}): boolean {
  return missingIsbnReadyFields(book).length === 0;
}

const bookChamberSchema = z.object({
  submittedAt: z.string().datetime().nullable().optional(),
  isbn: z.string().nullable().optional(),
  udcCode: z.string().max(50).nullable().optional(),
  authorSign: z.string().max(50).nullable().optional(),
});

// No public Книжкова палата API exists — ISBN is self-service (Ulit
// registers once as a publisher, gets a block of numbers, self-assigns them
// to books -- no per-book submission needed at all). УДК + авторський знак
// ("шифр зберігання") is the opposite: a real per-book request to the
// Palata (e-mail), which is what this whole module's "queue"/"package"
// machinery exists for. See docs/TASKS.md T-1954.
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

      const { submittedAt, isbn, udcCode, authorSign } = result.data;

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
          authorSign: authorSign === undefined ? undefined : authorSign,
        },
        select: { id: true, isbn: true, udcCode: true, authorSign: true, bookChamberSubmittedAt: true },
      });

      return reply.send({ book });
    }
  );

  // ─── УДК registration queue ──────────────────────────────────────────────
  // Books that have cleared moderation, aren't submitted for cataloguing
  // yet, and already have every piece of info the submission checklist
  // requires (isIsbnReady) -- i.e. nothing left for the admin to chase the
  // author for, only to hand off externally. Gated on udcCode, not isbn --
  // ISBN doesn't need this workflow at all (self-service, see module
  // comment above); a book missing only its ISBN wouldn't belong here.
  // Mirrors the shape of /api/admin/distribution/queue.
  app.get("/api/admin/isbn-queue", { preHandler: requireAdmin }, async (_request, reply) => {
    const candidates = await prisma.book.findMany({
      where: { moderationStatus: "APPROVED", bookChamberSubmittedAt: null, udcCode: null },
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

  // ─── УДК submission package ──────────────────────────────────────────────
  // Everything needed to hand a book off to Книжкова палата for УДК +
  // авторський знак ("шифр зберігання", ukrbook.net/UDC_poslugy.html) --
  // ISBN needs none of this (self-service, see module comment above), so
  // this package is purely for the УДК e-mail request. File 1 (заявка.txt:
  // metadata + annotation) is composed on the fly. File 2 (manuscript)
  // reuses printPdfUrl as-is -- it already carries our own УДК/ISBN colophon
  // on page 2 (T-1962), which covers the "technical page" a submission
  // needs; no separate blank-page-2 render exists or is planned. Files 3/4
  // are the front/back cover, already public files.
  //
  // Deliberately NOT a single .zip download -- a prior attempt at zipping
  // files for admin download (distribution bulk-export, admin.ts) turned out
  // unreliable in production. Instead this stays a set of direct links the
  // admin opens/downloads individually, same pattern as before, just with
  // more of them (back cover + all the assigned codes) surfaced in one click.
  const isbnPackageSelect = {
    title: true,
    coverUrl: true,
    backCoverUrl: true,
    description: true,
    bookAuthors: true,
    printPdfUrl: true,
    printPageCount: true,
    genre: true,
    language: true,
    isbn: true,
    udcCode: true,
    authorSign: true,
    author: { select: { name: true } },
  } as const;

  function buildApplicationText(book: {
    title: string;
    description: string | null;
    bookAuthors: unknown;
    genre: string | null;
    language: string;
    printPageCount: number | null;
    isbn: string | null;
    udcCode: string | null;
    authorSign: string | null;
  }) {
    const authorFullName = formatAuthorFullName(book.bookAuthors) ?? "—";
    const lines = [
      `Назва книги: ${book.title}`,
      `Автор (ПІБ): ${authorFullName}`,
      `Мова видання: ${book.language}`,
      `Жанр: ${book.genre ?? "—"}`,
      `Кількість сторінок: ${book.printPageCount ?? "—"}`,
      "",
      `ISBN: ${book.isbn ?? "ще не присвоєно"}`,
      `УДК: ${book.udcCode ?? "ще не присвоєно"}`,
      `Авторський знак: ${book.authorSign ?? "ще не присвоєно"}`,
      "",
      "Анотація:",
      book.description ?? "",
    ];
    return lines.join("\r\n") + "\r\n";
  }

  app.get(
    "/api/admin/books/:id/isbn-package",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({ where: { id }, select: isbnPackageSelect });
      if (!book) throw AppError.notFound("Book");

      const authorFullName = formatAuthorFullName(book.bookAuthors);
      const missing = missingIsbnReadyFields(book);
      if (missing.length > 0) {
        throw new AppError(`Дані книги ще не готові для пакету УДК: ${missing.join("; ")}`, 400, "NOT_ISBN_READY");
      }

      const manuscriptPdfUrl = await getSignedUrl(book.printPdfUrl!);

      return reply.send({
        title: book.title,
        authorFullName,
        annotationTxtUrl: `/api/admin/books/${id}/isbn-package/annotation.txt`,
        manuscriptPdfUrl,
        coverUrl: book.coverUrl,
        backCoverUrl: book.backCoverUrl,
        genre: book.genre,
        language: book.language,
        printPageCount: book.printPageCount,
        isbn: book.isbn,
        udcCode: book.udcCode,
        authorSign: book.authorSign,
      });
    }
  );

  app.get(
    "/api/admin/books/:id/isbn-package/annotation.txt",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const book = await prisma.book.findUnique({ where: { id }, select: isbnPackageSelect });
      if (!book) throw AppError.notFound("Book");

      const text = buildApplicationText(book);

      reply.header("Content-Type", "text/plain; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="zayavka.txt"`);
      return reply.send(text);
    }
  );
}
