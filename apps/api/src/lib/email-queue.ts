import { Queue, Worker } from "bullmq";
import { redisConfig } from "./queue";
import { sendKdpExpiryWarning, sendPublishedNotification, sendOrderDownloadLinks } from "../services/email.service";

export const EMAIL_QUEUE = "email";

const connection = { ...redisConfig, maxRetriesPerRequest: null } as any;

export const emailQueue = new Queue(EMAIL_QUEUE, { connection });

export type EmailJobName = "kdp-expiry-warning" | "book-published" | "order-paid";

export interface KdpExpiryWarningData {
  email: string;
  name: string;
  bookTitle: string;
  bookId: string;
  expiryDate: string; // ISO string
}

export interface BookPublishedData {
  email: string;
  name: string;
  bookTitle: string;
  bookId: string;
  isbn?: string | null;
}

export interface OrderPaidData {
  email: string;
  name: string;
  orderId: string;
  total: number;
  downloads: Array<{
    bookTitle: string;
    coverUrl: string | null;
    links: Array<{ label: string; url: string }>;
  }>;
}

export async function scheduleKdpExpiryWarning(data: KdpExpiryWarningData, expiryDate: Date) {
  const warnAt = new Date(expiryDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const delay = Math.max(0, warnAt.getTime() - Date.now());
  await emailQueue.add("kdp-expiry-warning", data, {
    delay,
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { count: 100 },
  });
}

export async function queueOrderPaidEmail(data: OrderPaidData) {
  await emailQueue.add("order-paid", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 100 },
  });
}

export async function queuePublishedEmail(data: BookPublishedData) {
  await emailQueue.add("book-published", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 100 },
  });
}

// Worker runs in the API process (email doesn't need LibreOffice etc.)
export function startEmailWorker() {
  const worker = new Worker(
    EMAIL_QUEUE,
    async (job) => {
      if (job.name === "kdp-expiry-warning") {
        const d = job.data as KdpExpiryWarningData;
        await sendKdpExpiryWarning({ ...d, expiryDate: new Date(d.expiryDate) });
      } else if (job.name === "book-published") {
        const d = job.data as BookPublishedData;
        await sendPublishedNotification(d);
      } else if (job.name === "order-paid") {
        const d = job.data as OrderPaidData;
        await sendOrderDownloadLinks(d);
      }
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[email-worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  return worker;
}
