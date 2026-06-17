import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile } from "../../services/storage.service";
import { enqueueConversionJobs } from "../../services/publishing.service";

const MAX_DOCX_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_DOCX_MIME = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export async function uploadDocxRoute(app: FastifyInstance) {
  app.post(
    "/api/books/:id/upload-docx",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const book = await prisma.book.findUnique({ where: { id }, select: { authorId: true, status: true } });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");
      if (book.status === "PUBLISHED") {
        throw new AppError("Published books cannot be re-uploaded", 400, "BOOK_PUBLISHED");
      }

      const data = await request.file();
      if (!data) throw new AppError("No file uploaded", 400, "NO_FILE");

      if (!ALLOWED_DOCX_MIME.includes(data.mimetype) && !data.filename.endsWith(".docx")) {
        throw new AppError("Only .docx files are accepted", 400, "INVALID_FILE_TYPE");
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of data.file) {
        totalSize += chunk.length;
        if (totalSize > MAX_DOCX_SIZE) {
          throw new AppError("File exceeds 50 MB limit", 400, "FILE_TOO_LARGE");
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const objectName = `private/books/${id}/original.docx`;
      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype);

      await prisma.book.update({
        where: { id },
        data: { originalDocxUrl: objectName },
        select: { id: true },
      });

      const jobs = await enqueueConversionJobs(id, objectName);

      return reply.send({
        message: "Upload successful, conversion started",
        jobCount: jobs.length,
        docxPath: objectName,
      });
    }
  );
}
