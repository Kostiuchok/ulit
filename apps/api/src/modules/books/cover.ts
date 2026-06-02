import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile, publicUrl } from "../../services/storage.service";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export async function uploadCoverRoute(app: FastifyInstance) {
  app.post(
    "/api/books/:id/upload-cover",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({ where: { id }, select: { authorId: true } });
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
      const objectName = `public/covers/${id}.${ext}`;

      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype);
      const coverUrl = publicUrl(objectName);

      await prisma.book.update({ where: { id }, data: { coverUrl } });
      return reply.send({ coverUrl });
    }
  );
}
