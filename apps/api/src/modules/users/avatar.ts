import { FastifyInstance } from "fastify";
import { authenticate } from "../../lib/jwt.middleware";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../errors/AppError";
import { uploadFile, publicUrl } from "../../services/storage.service";
import { Readable } from "stream";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export async function usersAvatar(app: FastifyInstance) {
  app.post(
    "/api/users/me/avatar",
    { preHandler: authenticate },
    async (request, reply) => {
      const data = await request.file();
      if (!data) throw new AppError("No file uploaded", 400, "NO_FILE");

      if (!ALLOWED_MIME.includes(data.mimetype)) {
        throw new AppError("Only JPEG, PNG, and WebP images are allowed", 400, "INVALID_MIME");
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of data.file) {
        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) {
          throw new AppError("File exceeds 5 MB limit", 400, "FILE_TOO_LARGE");
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const ext = data.mimetype.split("/")[1];
      const objectName = `public/avatars/${request.user.id}.${ext}`;

      const stream = Readable.from(buffer);
      await uploadFile(objectName, stream, buffer.length, data.mimetype);

      const avatarUrl = publicUrl(objectName);
      const user = await prisma.user.update({
        where: { id: request.user.id },
        data: { avatarUrl },
        select: { id: true, avatarUrl: true },
      });

      return reply.send({ avatarUrl: user.avatarUrl });
    }
  );
}
