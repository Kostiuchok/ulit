import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import fs from "fs";
import os from "os";
import path from "path";
import { PRINT_TRIM_SIZE_MM } from "shared-types";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile } from "../../services/storage.service";
import { enqueueConversionJobs } from "../../services/publishing.service";
import { validateDocxPageSize } from "../../lib/docxPageSize";

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

      const book = await prisma.book.findUnique({
        where: { id },
        select: { authorId: true, status: true, printWidthMm: true, printHeightMm: true },
      });
      if (!book) throw AppError.notFound("Book");
      if (book.authorId !== request.user.id) throw AppError.forbidden("Not your book");

      // Per-book trim (auto-derived from genre, GENRE_TO_PRINT_FORMAT) if set,
      // else the platform default (ДСТУ "Стандартний", 130x200mm).
      const expectedSize =
        book.printWidthMm && book.printHeightMm
          ? { widthMm: book.printWidthMm, heightMm: book.printHeightMm }
          : PRINT_TRIM_SIZE_MM;

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

      // Reject before persisting anything if the document's own page setup
      // doesn't match the platform's fixed print trim -- the print pipeline
      // converts the author's .docx as-is (no reflow, see T-2057), so a
      // mismatched page size here means a mismatched printed book later.
      const tmpPath = path.join(os.tmpdir(), `upload-pgsz-${id}-${Date.now()}.docx`);
      try {
        fs.writeFileSync(tmpPath, buffer);
        const sizeCheck = validateDocxPageSize(tmpPath, expectedSize);
        if (!sizeCheck.valid) {
          throw new AppError(sizeCheck.message!, 422, "PAGE_SIZE_MISMATCH");
        }
      } finally {
        fs.rmSync(tmpPath, { force: true });
      }

      const objectName = `private/books/${id}/original.docx`;
      await uploadFile(objectName, Readable.from(buffer), buffer.length, data.mimetype);

      await prisma.book.update({
        where: { id },
        data: { originalDocxUrl: objectName, docxUpdatedAt: new Date() },
        select: { id: true },
      });

      // A PUBLISHED book's live files must not change until the author
      // explicitly confirms via POST /api/books/:id/republish ("Опублікувати
      // із змінами") — stage the new .docx without touching status or
      // re-running conversion yet.
      if (book.status === "PUBLISHED") {
        return reply.send({
          message: "Файл оновлено. Натисніть «Опублікувати із змінами», щоб застосувати.",
          staged: true,
          docxPath: objectName,
        });
      }

      const jobs = await enqueueConversionJobs(id, objectName);

      return reply.send({
        message: "Upload successful, conversion started",
        jobCount: jobs.length,
        docxPath: objectName,
      });
    }
  );
}
