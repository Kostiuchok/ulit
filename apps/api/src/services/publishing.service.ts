import { prisma } from "../lib/prisma";
import { bookQueue, ConversionFormat, ConversionJobData } from "../lib/queue";

const FORMATS: ConversionFormat[] = ["PDF", "EPUB", "FB2", "MOBI", "PRINT_PDF"];

export async function enqueueConversionJobs(bookId: string, docxObjectName: string) {
  await prisma.book.update({ where: { id: bookId }, data: { status: "PROCESSING" }, select: { id: true } });

  const jobs = await Promise.all(
    FORMATS.map(async (format) => {
      const jobData: ConversionJobData = { bookId, format, docxObjectName };

      const job = await bookQueue.add(format, jobData, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      });

      await prisma.conversionJob.upsert({
        where: { bookId_format: { bookId, format } },
        update: { status: "PENDING", error: null, bullJobId: job.id },
        create: { bookId, format, status: "PENDING", bullJobId: job.id },
      });

      return job;
    })
  );

  return jobs;
}

export async function getConversionStatus(bookId: string) {
  return prisma.conversionJob.findMany({
    where: { bookId },
    select: { format: true, status: true, error: true, updatedAt: true },
    orderBy: { format: "asc" },
  });
}
