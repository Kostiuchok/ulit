import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile, uploadFromFile } from "../lib/minio";
import { notifyJobStatus } from "../lib/notify";
import { prisma } from "../lib/prisma";

export interface EpubData {
  bookId: string;
  format: "EPUB";
  docxObjectName: string;
}

export async function generateEpub(job: Job<EpubData>) {
  const { bookId, docxObjectName } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-epub-`));

  try {
    await notifyJobStatus(bookId, "EPUB", "PROCESSING");

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true, author: { select: { name: true } } },
    });

    const docxPath = path.join(tmpDir, "original.docx");
    await downloadToFile(docxObjectName, docxPath);

    const epubPath = path.join(tmpDir, "book.epub");
    const title = book?.title ?? "Untitled";
    const author = book?.author?.name ?? "Unknown";

    execSync(
      `pandoc "${docxPath}" -o "${epubPath}" ` +
      `--metadata title="${title.replace(/"/g, '\\"')}" ` +
      `--metadata author="${author.replace(/"/g, '\\"')}" ` +
      `-f docx -t epub3`,
      { timeout: 120_000, stdio: "pipe" }
    );

    if (!fs.existsSync(epubPath)) throw new Error("Pandoc did not produce an EPUB");

    const objectName = `private/books/${bookId}/book.epub`;
    await uploadFromFile(objectName, epubPath, "application/epub+zip");

    await notifyJobStatus(bookId, "EPUB", "DONE", { outputObjectName: objectName });
  } catch (err: any) {
    await notifyJobStatus(bookId, "EPUB", "FAILED", { error: err.message });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
