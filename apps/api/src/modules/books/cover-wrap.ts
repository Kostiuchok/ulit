import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile, publicUrl, IMMUTABLE_CACHE_CONTROL } from "../../services/storage.service";
import { coverLockedUntil } from "shared-types";

// The full print wrap at 300 DPI is several times a single panel.
const MAX_SIZE = 45 * 1024 * 1024; // 45 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export async function uploadCoverWrapRoute(app: FastifyInstance) {
  app.post(
    "/api/books/:id/upload-cover-wrap",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, status: true, coverApprovedAt: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      // The cover editor's print-house export: back | spine | front with
      // real bleed around it (see Book.coverWrapUrl). Same 90-day lock and
      // the same staging as the three panels it is saved together with.
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
        if (totalSize > MAX_SIZE) throw new AppError("File exceeds 45 MB", 400, "FILE_TOO_LARGE");
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const ext = data.mimetype === "image/png" ? "png" : data.mimetype === "image/webp" ? "webp" : "jpg";
      const objectName = isPublished ? `public/covers-wrap/${id}-pending.${ext}` : `public/covers-wrap/${id}.${ext}`;

      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype, {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      const coverWrapUrl = publicUrl(objectName);

      await prisma.book.update({
        where: { id },
        data: isPublished ? { pendingCoverWrapUrl: coverWrapUrl } : { coverWrapUrl },
        select: { id: true },
      });
      return reply.send({ coverWrapUrl, pending: isPublished });
    }
  );
}
