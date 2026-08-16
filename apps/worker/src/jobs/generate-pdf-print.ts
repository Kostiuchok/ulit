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
    await job.updateProgress(5);

    const docxPath = path.join(tmpDir, "original.docx");
    await downloadToFile(docxObjectName, docxPath);
    await job.updateProgress(15);

    // Step 1: LibreOffice → PDF
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${tmpDir}" "${docxPath}"`,
      { timeout: 120_000, stdio: "pipe" }
    );
    await job.updateProgress(55);

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
    await job.updateProgress(85);

    if (!fs.existsSync(outputPdf)) throw new Error("Ghostscript did not produce a print PDF");

    // Real print-trim page count (differs from the online-viewer pageCount,
    // which is derived from the plain LibreOffice PDF at Word's own page
    // size) -- used for print-cost estimates.
    let printPageCount: number | undefined;
    try {
      const pageCountOutput = execSync(
        `gs -q -dNODISPLAY -dNOSAFER -c "(${outputPdf}) (r) file runpdfbegin pdfpagecount = quit"`,
        { timeout: 30_000, stdio: "pipe" }
      ).toString().trim();
      const parsed = parseInt(pageCountOutput, 10);
      if (Number.isFinite(parsed) && parsed > 0) printPageCount = parsed;
    } catch {
      // Non-fatal -- cost estimate falls back to the online pageCount.
    }
    await job.updateProgress(95);

    const objectName = `private/books/${bookId}/print.pdf`;
    await uploadFromFile(objectName, outputPdf, "application/pdf");
    await job.updateProgress(100);

    await notifyJobStatus(bookId, "PRINT_PDF", "DONE", { outputObjectName: objectName, printPageCount });
  } catch (err: any) {
    await notifyJobStatus(bookId, "PRINT_PDF", "FAILED", { error: err.message });
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
