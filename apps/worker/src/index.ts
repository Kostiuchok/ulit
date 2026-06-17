import { Worker, Job } from "bullmq";
import { convertDocxToPdf } from "./jobs/convert-docx-to-pdf";
import { generatePdfPrint } from "./jobs/generate-pdf-print";
import { generateEpub } from "./jobs/generate-epub";
import { generateFb2 } from "./jobs/generate-fb2";
import { generateMobi } from "./jobs/generate-mobi";
import { generatePageThumbnails } from "./jobs/generate-page-thumbnails";
import { prisma } from "./lib/prisma";

const QUEUE_NAME = "book-processing";

function parseRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return { host: u.hostname || "localhost", port: Number(u.port) || 6379, password: u.password || undefined };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

const connection = { ...parseRedisUrl(process.env.REDIS_URL || "redis://localhost:6379"), maxRetriesPerRequest: null } as any;

const handlers: Record<string, (job: Job) => Promise<void>> = {
  PDF: convertDocxToPdf as any,
  EPUB: generateEpub as any,
  FB2: generateFb2 as any,
  MOBI: generateMobi as any,
  PRINT_PDF: generatePdfPrint as any,
  PAGE_THUMBNAILS: generatePageThumbnails as any,
};

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const handler = handlers[job.name];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.name}`);
    }
    await handler(job);
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("completed", (job) => {
  console.log(`[worker] ✓ Job ${job.id} (${job.name}) completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] ✗ Job ${job?.id} (${job?.name}) failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] error:", err);
});

console.log(`[worker] Listening on queue "${QUEUE_NAME}" — concurrency: 2`);

process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
