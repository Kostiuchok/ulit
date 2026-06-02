import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile, uploadFromFile } from "../lib/minio";
import { notifyJobStatus } from "../lib/notify";

export interface DocxToPdfData {
  bookId: string;
  format: "PDF";
  docxObjectName: string;
}

export async function convertDocxToPdf(job: Job<DocxToPdfData>) {
  const { bookId, docxObjectName } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-`));

  try {
    await notifyJobStatus(bookId, "PDF", "PROCESSING");

    const docxPath = path.join(tmpDir, "original.docx");
    await downloadToFile(docxObjectName, docxPath);

    // LibreOffice headless conversion
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${tmpDir}" "${docxPath}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    const rawPdf = path.join(tmpDir, "original.pdf");
    if (!fs.existsSync(rawPdf)) throw new Error("LibreOffice did not produce a PDF");

    // Compress with Ghostscript (ebook quality, good for online reading)
    const compressedPdf = path.join(tmpDir, "compressed.pdf");
    execSync(
      `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 ` +
      `-dPDFSETTINGS=/ebook -sOutputFile="${compressedPdf}" "${rawPdf}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    const finalPdf = fs.existsSync(compressedPdf) ? compressedPdf : rawPdf;
    const objectName = `private/books/${bookId}/online.pdf`;
    await uploadFromFile(objectName, finalPdf, "application/pdf");

    await notifyJobStatus(bookId, "PDF", "DONE", { outputObjectName: objectName });
  } catch (err: any) {
    await notifyJobStatus(bookId, "PDF", "FAILED", { error: err.message });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
