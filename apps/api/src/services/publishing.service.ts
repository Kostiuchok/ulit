import { prisma } from "../lib/prisma";
import { bookQueue, ConversionFormat, ConversionJobData } from "../lib/queue";

// T-2057 -- PRINT_PDF is deliberately NOT in this batch anymore. It used to
// convert the raw .docx via LibreOffice, same as the other four, and could
// fire the moment a book is uploaded. It now renders Book.manuscriptContent
// (WeasyPrint, apps/worker/src/jobs/generate-pdf-print.ts) -- which doesn't
// exist yet at upload time (manuscript import is lazy, only happens once the
// author opens the online editor, see apps/api/src/modules/books/manuscript.ts).
// It's triggered on demand instead, by GET /api/books/:id/print-preview
// (print-preview.ts) -- the "Передперегляд" button in the manuscript editor,
// mirroring manuscript.ts's own "import on first GET" dedup pattern.
const FORMATS: ConversionFormat[] = ["PDF", "EPUB", "FB2", "MOBI"];

export async function enqueueConversionJobs(
  bookId: string,
  docxObjectName: string,
  opts?: { setProcessing?: boolean }
) {
  if (opts?.setProcessing !== false) {
    await prisma.book.update({ where: { id: bookId }, data: { status: "PROCESSING" }, select: { id: true } });
  }

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
    select: { format: true, status: true, error: true, updatedAt: true, bullJobId: true },
    orderBy: { format: "asc" },
  });
}
