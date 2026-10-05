import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile, publicUrl, IMMUTABLE_CACHE_CONTROL } from "../../services/storage.service";
import { coverLockedUntil } from "shared-types";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export async function uploadSpineCoverRoute(app: FastifyInstance) {
  app.post(
    "/api/books/:id/upload-spine",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, status: true, coverApprovedAt: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      // Same 90-day lock as upload-cover (cover.ts) -- front/back/spine are
      // one editing session in CoverDesignerCanvas, one shared lock.
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
      const objectName = isPublished ? `public/covers-spine/${id}-pending.${ext}` : `public/covers-spine/${id}.${ext}`;

      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype, {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      const spineUrl = publicUrl(objectName);

      await prisma.book.update({
        where: { id },
        data: isPublished ? { pendingSpineUrl: spineUrl } : { spineUrl, coverUpdatedAt: new Date() },
        select: { id: true },
      });
      return reply.send({ spineUrl, pending: isPublished });
    }
  );
}
