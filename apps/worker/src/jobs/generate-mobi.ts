import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile, uploadFromFile } from "../lib/minio";
import { notifyJobStatus } from "../lib/notify";

export interface MobiData {
  bookId: string;
  format: "MOBI";
  docxObjectName: string;
}

export async function generateMobi(job: Job<MobiData>) {
  const { bookId, docxObjectName } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-mobi-`));

  try {
    await notifyJobStatus(bookId, "MOBI", "PROCESSING");

    const docxPath = path.join(tmpDir, "original.docx");
    await downloadToFile(docxObjectName, docxPath);

    // DOCX → EPUB (Pandoc) → MOBI/AZW3 (Calibre)
    const epubPath = path.join(tmpDir, "book.epub");
    execSync(`pandoc "${docxPath}" -o "${epubPath}" -f docx -t epub3`, {
      timeout: 120_000,
      stdio: "pipe",
    });

    if (!fs.existsSync(epubPath)) throw new Error("Pandoc intermediate EPUB failed");

    const mobiPath = path.join(tmpDir, "book.azw3");
    execSync(`ebook-convert "${epubPath}" "${mobiPath}"`, {
      timeout: 120_000,
      stdio: "pipe",
    });

    if (!fs.existsSync(mobiPath)) throw new Error("Calibre did not produce MOBI/AZW3");

    const objectName = `private/books/${bookId}/book.azw3`;
    await uploadFromFile(objectName, mobiPath, "application/vnd.amazon.mobi8-ebook");

    await notifyJobStatus(bookId, "MOBI", "DONE", { outputObjectName: objectName });
  } catch (err: any) {
    await notifyJobStatus(bookId, "MOBI", "FAILED", { error: err.message });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
