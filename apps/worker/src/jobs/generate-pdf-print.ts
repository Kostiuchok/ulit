import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile, uploadFromFile } from "../lib/minio";
import { notifyJobStatus } from "../lib/notify";

export interface PrintPdfData {
  bookId: string;
  format: "PRINT_PDF";
  docxObjectName: string;
}

export async function generatePdfPrint(job: Job<PrintPdfData>) {
  const { bookId, docxObjectName } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-print-`));

  try {
    await notifyJobStatus(bookId, "PRINT_PDF", "PROCESSING");

    const docxPath = path.join(tmpDir, "original.docx");
    await downloadToFile(docxObjectName, docxPath);

    // Step 1: LibreOffice → PDF
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${tmpDir}" "${docxPath}"`,
      { timeout: 120_000, stdio: "pipe" }
    );

    const sourcePdf = path.join(tmpDir, "original.pdf");
    if (!fs.existsSync(sourcePdf)) throw new Error("LibreOffice did not produce a PDF");

    const stat = fs.statSync(sourcePdf);
    const outputPdf = path.join(tmpDir, "print.pdf");

    // T-414: if > 10 MB skip compression and use raw PDF
    if (stat.size > 10 * 1024 * 1024) {
      fs.copyFileSync(sourcePdf, outputPdf);
    } else {
      // Ghostscript: PDF/X-3, CMYK, 300 DPI, 3mm bleed
      execSync(
        `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 ` +
        `-dPDFSETTINGS=/prepress -dColorConversionStrategy=/CMYK ` +
        `-dProcessColorModel=/DeviceCMYK -r300 ` +
        `-dBleedOffset=8.504 ` + // 3mm in points (1pt = 0.353mm)
        `-sOutputFile="${outputPdf}" "${sourcePdf}"`,
        { timeout: 180_000, stdio: "pipe" }
      );
    }

    if (!fs.existsSync(outputPdf)) throw new Error("Ghostscript did not produce a print PDF");

    const objectName = `private/books/${bookId}/print.pdf`;
    await uploadFromFile(objectName, outputPdf, "application/pdf");

    await notifyJobStatus(bookId, "PRINT_PDF", "DONE", { outputObjectName: objectName });
  } catch (err: any) {
    await notifyJobStatus(bookId, "PRINT_PDF", "FAILED", { error: err.message });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
