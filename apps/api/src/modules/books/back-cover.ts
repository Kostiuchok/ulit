import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile, publicUrl, IMMUTABLE_CACHE_CONTROL } from "../../services/storage.service";
import { coverLockedUntil } from "shared-types";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export async function uploadBackCoverRoute(app: FastifyInstance) {
  app.post(
    "/api/books/:id/upload-back-cover",
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
      // Staged for a PUBLISHED book -- same "-pending" object-path trick as
      // upload-cover (cover.ts): the live file stays untouched until approval.
      const objectName = isPublished ? `public/covers-back/${id}-pending.${ext}` : `public/covers-back/${id}.${ext}`;

      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype, {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      const backCoverUrl = publicUrl(objectName);

      // The back cover is NOT part of print.pdf (it is printed separately, the
      // PDF is the interior block only) -- so no printMetaUpdatedAt bump.
      // coverUpdatedAt IS bumped (live case only) -- withCoverVersion
      // (coverVersion.ts) keys backCoverUrl's own cache-busting ?v= off this
      // same field; a staged change doesn't touch the live file, so nothing
      // to bust yet.
      await prisma.book.update({
        where: { id },
        data: isPublished
          ? { pendingBackCoverUrl: backCoverUrl }
          : { backCoverUrl, coverUpdatedAt: new Date() },
        select: { id: true },
      });
      return reply.send({ backCoverUrl, pending: isPublished });
    }
  );
}
