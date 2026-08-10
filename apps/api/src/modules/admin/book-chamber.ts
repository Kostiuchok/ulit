import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { requireAdmin } from "../../lib/jwt.middleware";
import { validateIsbn13 } from "../../services/isbn.service";

const bookChamberSchema = z.object({
  submittedAt: z.string().datetime().nullable().optional(),
  isbn: z.string().nullable().optional(),
  udcCode: z.string().max(50).nullable().optional(),
  bbkCode: z.string().max(50).nullable().optional(),
  authorSign: z.string().max(50).nullable().optional(),
});

// No public Книжкова палата API exists — a registered publisher (Ulit) submits
// books for cataloguing outside this system, then an admin records the real
// ISBN/УДК/ББК/авторський знак here once received. See docs/TASKS.md T-1954.
export async function bookChamberRoutes(app: FastifyInstance) {
  app.patch(
    "/api/admin/books/:id/book-chamber",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = bookChamberSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.errors[0].message });
      }

      const existing = await prisma.book.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw AppError.notFound("Book");

      const { submittedAt, isbn, udcCode, bbkCode, authorSign } = result.data;

      if (isbn !== undefined && isbn !== null) {
        if (!validateIsbn13(isbn)) {
          throw new AppError("Невалідний ISBN-13", 400, "INVALID_ISBN");
        }
        const collision = await prisma.book.findFirst({ where: { isbn, NOT: { id } }, select: { id: true } });
        if (collision) throw new AppError("Цей ISBN вже присвоєно іншій книзі", 400, "ISBN_TAKEN");
      }

      const book = await prisma.book.update({
        where: { id },
        data: {
          bookChamberSubmittedAt: submittedAt === undefined ? undefined : submittedAt ? new Date(submittedAt) : null,
          isbn: isbn === undefined ? undefined : isbn,
          udcCode: udcCode === undefined ? undefined : udcCode,
          bbkCode: bbkCode === undefined ? undefined : bbkCode,
          authorSign: authorSign === undefined ? undefined : authorSign,
        },
        select: { id: true, isbn: true, udcCode: true, bbkCode: true, authorSign: true, bookChamberSubmittedAt: true },
      });

      return reply.send({ book });
    }
  );
}
