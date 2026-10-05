import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile, publicUrl, IMMUTABLE_CACHE_CONTROL } from "../../services/storage.service";
import { toCoverThumbnail } from "../../lib/coverThumbnail";
import { coverLockedUntil } from "shared-types";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export async function uploadCoverRoute(app: FastifyInstance) {
  app.post(
    "/api/books/:id/upload-cover",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, status: true, coverApprovedAt: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const isPublished = book.status === "PUBLISHED";
      if (isPublished) {
        const lockedUntil = coverLockedUntil(book.coverApprovedAt);
        if (lockedUntil) {
          throw new AppError(
            `Обкладинку опублікованої книги можна змінювати раз на 90 днів. Наступна зміна можлива з ${lockedUntil.toISOString().slice(0, 10)}.`,
            400,
            "COVER_LOCKED"
          );
        }
      }

      const data = await request.file();
      if (!data) throw new AppError("No file uploaded", 400, "NO_FILE");

      if (!ALLOWED_MIME.includes(data.mimetype)) {
        throw new AppError("Only PNG, JPEG, or WebP images accepted", 400, "INVALID_MIME");
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of data.file) {
        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) throw new AppError("File exceeds 20 MB", 400, "FILE_TOO_LARGE");
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const ext = data.mimetype === "image/png" ? "png" : data.mimetype === "image/webp" ? "webp" : "jpg";
      // Staged for a PUBLISHED book: write to a DIFFERENT object path so the
      // live file at the plain path (what readers' already-cached pages and
      // the storefront keep pointing at) is never touched until admin
      // approval applies pendingCoverUrl -> coverUrl (admin.ts). No rename
      // needed at that point -- the "-pending" URL just becomes permanent.
      const objectName = isPublished ? `public/covers/${id}-pending.${ext}` : `public/covers/${id}.${ext}`;

      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype, {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      const coverUrl = publicUrl(objectName);

      // Small WebP sidecar for AuthorBooksSidebar/MyBooksList -- the full
      // export above stays untouched (same bytes/resolution as before, so
      // nothing that relies on it -- cover print spread, admin's per-book
      // cover download for distribution, the store page -- changes).
      const thumbBuffer = await toCoverThumbnail(buffer);
      const thumbObjectName = isPublished ? `public/covers-thumb/${id}-pending.webp` : `public/covers-thumb/${id}.webp`;
      await uploadFile(thumbObjectName, Readable.from(thumbBuffer), thumbBuffer.length, "image/webp", {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      const coverThumbUrl = publicUrl(thumbObjectName);

      // The cover editor uploads with ?source=editor and stores its design
      // (Book.coverDesign) right after. Every other caller -- auto-cover,
      // "Замінити файлом" -- replaces the cover with something the stored
      // design no longer describes, so that design is dropped; otherwise the
      // editor would reopen on an old layout unrelated to the real cover.
      const fromEditor = (request.query as { source?: string } | undefined)?.source === "editor";
      const dropDesign = fromEditor ? {} : { coverDesign: Prisma.JsonNull };

      await prisma.book.update({
        where: { id },
        data: isPublished
          ? // A new front cover invalidates any earlier print wrap; the
            // editor re-uploads its own right after (upload-cover-wrap).
            { pendingCoverUrl: coverUrl, pendingCoverThumbUrl: coverThumbUrl, pendingCoverWrapUrl: null, ...dropDesign }
          : { coverUrl, coverThumbUrl, coverUpdatedAt: new Date(), coverWrapUrl: null, ...dropDesign },
        select: { id: true },
      });
      return reply.send({ coverUrl, coverThumbUrl, pending: isPublished });
    }
  );
}
