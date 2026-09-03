import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { requireAdmin } from "../../lib/jwt.middleware";
import { getSignedUrl, uploadFile } from "../../services/storage.service";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB, same limit as identity docs (users/contract.ts)
const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];

// Publisher-level (ULIT itself) documents needed to register for a block of
// ISBN numbers and to submit УДК requests to Книжкова палата
// (docs/instr_isbn.pdf §2.1, ukrbook.net/UDC_poslugy.html) -- not tied to
// any one book or author. Fixed set, no admin-defined custom types.
export const PUBLISHER_DOCUMENT_KEYS = [
  "guarantee_letter",
  "registry_certificate",
  "vat_certificate",
  "annual_output_letter",
] as const;
type PublisherDocumentKey = (typeof PUBLISHER_DOCUMENT_KEYS)[number];

function isPublisherDocumentKey(key: string): key is PublisherDocumentKey {
  return (PUBLISHER_DOCUMENT_KEYS as readonly string[]).includes(key);
}

export async function publisherDocumentsRoutes(app: FastifyInstance) {
  app.get("/api/admin/publisher-documents", { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await prisma.publisherDocument.findMany({
      where: { key: { in: [...PUBLISHER_DOCUMENT_KEYS] } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const documents = await Promise.all(
      PUBLISHER_DOCUMENT_KEYS.map(async (key) => {
        const row = byKey.get(key);
        return {
          key,
          url: row?.url ? await getSignedUrl(row.url) : null,
          uploadedAt: row?.uploadedAt ?? null,
        };
      })
    );

    return reply.send({ documents });
  });

  app.post(
    "/api/admin/publisher-documents/:key",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      if (!isPublisherDocumentKey(key)) {
        throw new AppError("Невідомий тип документа", 400, "UNKNOWN_DOCUMENT_KEY");
      }

      const part = await request.file();
      if (!part) throw new AppError("Файл не додано", 400, "NO_FILE");
      if (!ALLOWED_MIME.includes(part.mimetype)) {
        throw new AppError("Дозволені формати: jpeg/png/pdf", 400, "INVALID_MIME");
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of part.file) {
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE) {
          throw new AppError("Файл перевищує 15 MB", 400, "FILE_TOO_LARGE");
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const ext = part.mimetype === "application/pdf" ? "pdf" : part.mimetype === "image/png" ? "png" : "jpg";
      const objectName = `private/publisher-documents/${key}/${Date.now()}.${ext}`;
      await uploadFile(objectName, Readable.from(buffer), buffer.length, part.mimetype);

      const now = new Date();
      await prisma.publisherDocument.upsert({
        where: { key },
        create: { key, url: objectName, uploadedAt: now },
        update: { url: objectName, uploadedAt: now },
      });

      return reply.send({
        key,
        url: await getSignedUrl(objectName),
        uploadedAt: now,
      });
    }
  );
}
