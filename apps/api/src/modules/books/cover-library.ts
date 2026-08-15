import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile, publicUrl } from "../../services/storage.service";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

interface CoverImageEntry {
  url: string;
  uploadedAt: string;
  // "slot" (front illustration) or "background" (full-bleed cover
  // background) -- which upload button this came from, so the frontend's
  // "Раніше завантажені" gallery can re-apply it to the same place instead
  // of always dropping it onto the front illustration. Absent on entries
  // saved before this field existed -- the frontend treats a missing kind
  // as "slot", the only one that existed before background images got
  // their own gallery.
  kind?: "slot" | "background";
}

export async function coverLibraryRoutes(app: FastifyInstance) {
  app.post(
    "/api/books/:id/cover-images",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { kind } = request.query as { kind?: string };
      const entryKind: CoverImageEntry["kind"] = kind === "background" ? "background" : "slot";

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, coverImageLibrary: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

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
      const objectName = `public/covers-library/${id}/${randomUUID()}.${ext}`;

      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype);
      const url = publicUrl(objectName);

      const existing = Array.isArray(book.coverImageLibrary) ? (book.coverImageLibrary as unknown as CoverImageEntry[]) : [];
      const library = [...existing, { url, uploadedAt: new Date().toISOString(), kind: entryKind }];

      await prisma.book.update({
        where: { id },
        data: { coverImageLibrary: library as unknown as Prisma.InputJsonValue },
        select: { id: true },
      });

      return reply.send({ library });
    }
  );

  app.delete(
    "/api/books/:id/cover-images",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { url } = request.query as { url?: string };
      if (!url) throw new AppError("Missing url query param", 400, "MISSING_URL");

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, coverImageLibrary: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      const existing = Array.isArray(book.coverImageLibrary) ? (book.coverImageLibrary as unknown as CoverImageEntry[]) : [];
      const library = existing.filter((entry) => entry.url !== url);

      await prisma.book.update({
        where: { id },
        data: { coverImageLibrary: library as unknown as Prisma.InputJsonValue },
        select: { id: true },
      });

      return reply.send({ library });
    }
  );
}
