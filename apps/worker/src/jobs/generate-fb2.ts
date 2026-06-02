import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile, uploadFromFile } from "../lib/minio";
import { notifyJobStatus } from "../lib/notify";

export interface Fb2Data {
  bookId: string;
  format: "FB2";
  docxObjectName: string;
}

export async function generateFb2(job: Job<Fb2Data>) {
  const { bookId, docxObjectName } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-fb2-`));

  try {
    await notifyJobStatus(bookId, "FB2", "PROCESSING");

    const docxPath = path.join(tmpDir, "original.docx");
    await downloadToFile(docxObjectName, docxPath);

    // First convert DOCX → EPUB (Pandoc), then EPUB → FB2 (Calibre)
    const epubPath = path.join(tmpDir, "book.epub");
    execSync(`pandoc "${docxPath}" -o "${epubPath}" -f docx -t epub3`, {
      timeout: 120_000,
      stdio: "pipe",
    });

    if (!fs.existsSync(epubPath)) throw new Error("Pandoc intermediate EPUB failed");

    const fb2Path = path.join(tmpDir, "book.fb2");
    execSync(`ebook-convert "${epubPath}" "${fb2Path}"`, {
      timeout: 120_000,
      stdio: "pipe",
    });

    if (!fs.existsSync(fb2Path)) throw new Error("Calibre did not produce FB2");

    const objectName = `private/books/${bookId}/book.fb2`;
    await uploadFromFile(objectName, fb2Path, "application/x-fictionbook+xml");

    await notifyJobStatus(bookId, "FB2", "DONE", { outputObjectName: objectName });
  } catch (err: any) {
    await notifyJobStatus(bookId, "FB2", "FAILED", { error: err.message });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
