import { Queue } from "bullmq";

function parseRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "localhost",
      port: Number(u.port) || 6379,
      password: u.password || undefined,
      db: u.pathname ? Number(u.pathname.slice(1)) || 0 : 0,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

export const redisConfig = parseRedisUrl(process.env.REDIS_URL || "redis://localhost:6379");

export const BOOK_PROCESSING_QUEUE = "book-processing";

export const bookQueue = new Queue(BOOK_PROCESSING_QUEUE, {
  connection: { ...redisConfig, maxRetriesPerRequest: null } as any,
});

export type ConversionFormat = "PDF" | "EPUB" | "FB2" | "MOBI" | "PRINT_PDF";

export interface ConversionJobData {
  bookId: string;
  format: ConversionFormat;
  // T-2057 -- PRINT_PDF no longer converts the raw .docx; it renders
  // Book.manuscriptContent directly (apps/worker/src/jobs/generate-pdf-print.ts
  // reads it straight from Prisma), so it's the one format that doesn't need this.
  docxObjectName?: string;
}
