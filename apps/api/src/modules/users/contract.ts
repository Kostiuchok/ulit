import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Readable } from "stream";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile } from "../../services/storage.service";

const signSchema = z.object({
  taxId: z.string().min(1).max(32),
  payoutDocument: z.string().min(1).max(255),
  bankIban: z.string().min(1).max(64),
});

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB per file
const ALLOWED_MIME = ["image/jpeg", "image/png", "application/pdf"];

const changeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  patronymic: z.string().max(100).optional(),
  birthDate: z.string().min(1),
  citizenship: z.string().min(1).max(100),
  changeReason: z.string().min(1).max(200),
  passportSeries: z.string().min(1).max(64),
  registrationAddress: z.string().min(1).max(500),
});

// Author-level contract (T-1951 follow-up to T-1932/T-111). The platform
// oferta is accepted ONCE per author and covers every book — see
// docs/TECHNICAL-DECISIONS.md "Юридика". This replaces the old per-book
// POST /api/books/:id/contract/sign, which silently overwrote the author's
// global payout fields on every single book. The admin-controlled per-book
// publicationTimeline.contract_pending/contract_signed steps are unrelated
// go-live checkpoints and are untouched by this module.
export async function usersContractRoutes(app: FastifyInstance) {
  app.post("/api/users/me/contract/sign", { preHandler: authenticate }, async (request, reply) => {
    const result = signSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }
    const clientIp =
      (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      request.socket.remoteAddress ??
      "unknown";

    const existing = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { contractAcceptedAt: true },
    });
    if (!existing) throw AppError.notFound("User");

    const now = new Date();
    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        taxId: result.data.taxId,
        payoutDocument: result.data.payoutDocument,
        bankIban: result.data.bankIban,
        payoutDetailsSubmittedAt: now,
        ...(existing.contractAcceptedAt ? {} : { contractAcceptedAt: now, contractAcceptedIp: clientIp }),
      },
      select: {
        id: true,
        contractAcceptedAt: true,
        taxId: true,
        payoutDocument: true,
        bankIban: true,
        payoutDetailsSubmittedAt: true,
      },
    });

    return reply.send({ user });
  });

  // "Змінити договір" — structured identity/payout update + passport scan upload.
  app.patch("/api/users/me/contract", { preHandler: authenticate }, async (request, reply) => {
    const fields: Record<string, string> = {};
    const uploadedObjectNames: string[] = [];

    for await (const part of request.parts()) {
      if (part.type === "file") {
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
        const objectName = `private/identity/${request.user.id}/${Date.now()}-${uploadedObjectNames.length}.${ext}`;
        await uploadFile(objectName, Readable.from(buffer), buffer.length, part.mimetype);
        uploadedObjectNames.push(objectName);
      } else if (typeof part.value === "string") {
        fields[part.fieldname] = part.value;
      }
    }

    const result = changeSchema.safeParse(fields);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.errors[0].message, code: "VALIDATION_ERROR" });
    }

    const birthDate = new Date(result.data.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      return reply.status(400).send({ error: "Невірна дата народження", code: "VALIDATION_ERROR" });
    }

    const existing = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { identityDocumentUrls: true },
    });
    if (!existing) throw AppError.notFound("User");

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        patronymic: result.data.patronymic || null,
        birthDate,
        citizenship: result.data.citizenship,
        identityChangeReason: result.data.changeReason,
        passportSeries: result.data.passportSeries,
        registrationAddress: result.data.registrationAddress,
        identityDocumentUrls:
          uploadedObjectNames.length > 0
            ? [...existing.identityDocumentUrls, ...uploadedObjectNames]
            : existing.identityDocumentUrls,
        identityUpdatedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        patronymic: true,
        birthDate: true,
        citizenship: true,
        identityChangeReason: true,
        passportSeries: true,
        registrationAddress: true,
        identityUpdatedAt: true,
      },
    });

    return reply.send({ user });
  });
}
