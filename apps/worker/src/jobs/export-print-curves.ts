import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile, uploadFromFile } from "../lib/minio";
import { prisma } from "../lib/prisma";

export interface ExportPrintCurvesData {
  bookId: string;
  format: "EXPORT_PRINT_CURVES";
}

// Admin-only, on-demand export of printPdfUrl with every glyph converted to
// vector outlines (Ghostscript -dNoOutputFonts) -- some print houses require
// this instead of embedded fonts (the printPdfUrl default), even though
// embedded+subsetted fonts (already the case, see generate-pdf-print.ts) are
// what PDF/X actually mandates. Never triggered by an author; only from
// admin/print-orders, and only once a real printed-copy order exists for the
// book -- verified against a real 540-page render this can turn a ~15MB file
// into ~118MB (curves don't compress anywhere near as well as reusable font
// glyph references), so it's deliberately never run as part of the normal
// printPdfUrl pipeline.
export async function exportPrintCurves(job: Job<ExportPrintCurvesData>) {
  const { bookId } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-curves-`));

  try {
    await job.updateProgress(5);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { printPdfUrl: true },
    });
    if (!book) throw new Error(`Book ${bookId} not found`);
    if (!book.printPdfUrl) throw new Error(`Book ${bookId} has no printPdfUrl to convert`);

    const sourcePdf = path.join(tmpDir, "source.pdf");
    await downloadToFile(book.printPdfUrl, sourcePdf);
    await job.updateProgress(25);

    // Same CMYK/prepress flags as generate-pdf-print.ts's own Ghostscript
    // step, reapplied here regardless of whether printPdfUrl already went
    // through it (T-414's >10MB skip means it might not have) -- a file
    // actually headed to a print house needs to be prepress-ready
    // regardless of how big the source render was. No size-skip here: unlike
    // the interior-preview file, this is only ever generated on explicit
    // admin request for a real order, not on every author edit, so the
    // extra time is worth it every time.
    const outputPdf = path.join(tmpDir, "curves.pdf");
    execSync(
      `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 ` +
      `-dPDFSETTINGS=/prepress -dColorConversionStrategy=/CMYK ` +
      `-dProcessColorModel=/DeviceCMYK -dNoOutputFonts=true -r300 ` +
      `-dBleedOffset=8.504 ` + // 3mm in points (1pt = 0.353mm)
      `-sOutputFile="${outputPdf}" "${sourcePdf}"`,
      { timeout: 600_000, stdio: "pipe" }
    );
    await job.updateProgress(85);

    if (!fs.existsSync(outputPdf)) throw new Error("Ghostscript did not produce a curves PDF");

    const objectName = `private/books/${bookId}/print-curves.pdf`;
    await uploadFromFile(objectName, outputPdf, "application/pdf");
    await job.updateProgress(95);

    await prisma.book.update({
      where: { id: bookId },
      data: {
        printCurvesUrl: objectName,
        printCurvesGeneratedAt: new Date(),
      },
      select: { id: true },
    });
    await job.updateProgress(100);

    console.log(`[worker] EXPORT_PRINT_CURVES for ${bookId}: done`);
  } catch (err: any) {
    console.error(`[worker] EXPORT_PRINT_CURVES failed for ${bookId}:`, err.message);
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
