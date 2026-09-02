import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { PRINT_TRIM_SIZE_MM, extractPageNumberPosition, type FrontMatterMeta } from "shared-types";
import { uploadFromFile } from "../lib/minio";
import { prisma } from "../lib/prisma";
import { renderManuscriptPdf } from "../lib/renderManuscriptPdf";

export interface PrintPdfData {
  bookId: string;
  format: "PRINT_PDF";
}

interface BookAuthorEntry {
  lastName?: string;
  firstName?: string;
  middleName?: string;
}

// Two name orderings for the title page ("Ім'я Прізвище") vs the colophon
// ("Прізвище Ім'я", bibliographic convention) -- same small duplication as
// apps/api/src/modules/admin/book-chamber.ts's formatAuthorFullName, kept
// separate rather than shared since it's a 5-line helper in a different
// codebase (worker vs api). Falls back to the account's own display name
// when Book.bookAuthors has no complete entry -- can't reorder a flat
// string reliably, so both orderings just become the same value then.
function formatAuthorNames(
  bookAuthors: unknown,
  accountName: string | null
): { display: string | null; catalog: string | null } {
  const authors = Array.isArray(bookAuthors) ? (bookAuthors as BookAuthorEntry[]) : [];
  const a = authors.find((x) => x?.lastName?.trim() && x?.firstName?.trim());
  if (!a) return { display: accountName, catalog: accountName };
  const middle = a.middleName?.trim();
  return {
    display: [a.firstName, a.lastName].filter(Boolean).join(" "),
    catalog: [a.lastName, a.firstName, middle].filter(Boolean).join(" "),
  };
}

// T-2057 -- renders the print PDF straight from Book.manuscriptContent via
// WeasyPrint (renderManuscriptPdf), replacing the old
// LibreOffice-straight-off-the-uploaded-.docx pipeline. Deliberately does
// NOT go through notifyJobStatus()/conversion-status.ts's ConversionJob-row
// mechanism (that machinery assumes a job upserted at initial docx-upload
// time, see publishing.service.ts) -- this job is triggered on demand, by
// whoever calls the print-preview route (apps/api, GET
// /api/books/:id/print-preview), same "no pre-existing row" situation
// PAGE_THUMBNAILS is already in, and it already writes straight to the Book
// row via Prisma instead. Same pattern here.
export async function generatePdfPrint(job: Job<PrintPdfData>) {
  const { bookId } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-print-`));

  try {
    await job.updateProgress(5);

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        manuscriptContent: true,
        manuscriptStyleOverrides: true,
        printWidthMm: true,
        printHeightMm: true,
        backCoverUrl: true,
        title: true,
        subtitle: true,
        description: true,
        bookAuthors: true,
        ageRating: true,
        isbn: true,
        udcCode: true,
        bbkCode: true,
        authorSign: true,
        printPageCount: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
    if (!book) throw new Error(`Book ${bookId} not found`);
    if (!book.manuscriptContent) throw new Error(`Book ${bookId} has no manuscriptContent to render`);

    const widthMm = book.printWidthMm ?? PRINT_TRIM_SIZE_MM.widthMm;
    const heightMm = book.printHeightMm ?? PRINT_TRIM_SIZE_MM.heightMm;
    const pageNumberPosition = extractPageNumberPosition(
      (book.manuscriptStyleOverrides as Record<string, unknown> | null) ?? undefined
    );
    const authorNames = formatAuthorNames(book.bookAuthors, book.author.name);
    const frontMatterMeta: FrontMatterMeta = {
      title: book.title,
      subtitle: book.subtitle,
      authorNameDisplay: authorNames.display,
      authorNameCatalog: authorNames.catalog,
      description: book.description,
      ageRating: book.ageRating,
      isbn: book.isbn,
      udcCode: book.udcCode,
      bbkCode: book.bbkCode,
      authorSign: book.authorSign,
      pageCount: book.printPageCount,
      createdAt: book.createdAt.toISOString(),
    };

    const rawPdf = path.join(tmpDir, "manuscript-raw.pdf");
    renderManuscriptPdf({
      content: book.manuscriptContent,
      widthMm,
      heightMm,
      pageNumberPosition,
      frontMatterMeta,
      backCoverUrl: book.backCoverUrl,
      tmpDir,
      outputPdfPath: rawPdf,
    });
    await job.updateProgress(55);

    if (!fs.existsSync(rawPdf)) throw new Error("WeasyPrint did not produce a PDF");

    const stat = fs.statSync(rawPdf);
    const outputPdf = path.join(tmpDir, "print.pdf");

    // T-414: if > 10 MB skip compression and use raw PDF
    if (stat.size > 10 * 1024 * 1024) {
      fs.copyFileSync(rawPdf, outputPdf);
    } else {
      // Ghostscript: PDF/X-3, CMYK, 300 DPI, 3mm bleed -- unchanged from the
      // old pipeline, just now runs over WeasyPrint's output instead of
      // LibreOffice's (docs/T-2057-checklist.md checklist item).
      execSync(
        `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 ` +
        `-dPDFSETTINGS=/prepress -dColorConversionStrategy=/CMYK ` +
        `-dProcessColorModel=/DeviceCMYK -r300 ` +
        `-dBleedOffset=8.504 ` + // 3mm in points (1pt = 0.353mm)
        `-sOutputFile="${outputPdf}" "${rawPdf}"`,
        { timeout: 180_000, stdio: "pipe" }
      );
    }
    await job.updateProgress(85);

    if (!fs.existsSync(outputPdf)) throw new Error("Ghostscript did not produce a print PDF");

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

    await prisma.book.update({
      where: { id: bookId },
      data: {
        printPdfUrl: objectName,
        // +5s, not just new Date() -- this same update also bumps the row's
        // own @updatedAt (print-preview.ts's staleness check now compares
        // printPdfGeneratedAt against updatedAt too, so front matter picks
        // up later Вихідні дані edits). Both timestamps are independently
        // computed "now" within this one query; without the margin,
        // updatedAt could land a few ms after printPdfGeneratedAt purely by
        // evaluation-order luck, making the PDF register as stale again
        // immediately after every single render.
        printPdfGeneratedAt: new Date(Date.now() + 5000),
        ...(printPageCount ? { printPageCount } : {}),
      },
      select: { id: true },
    });
    await job.updateProgress(100);

    console.log(`[worker] PRINT_PDF for ${bookId}: ${printPageCount ?? "?"} pages rendered`);
  } catch (err: any) {
    console.error(`[worker] PRINT_PDF failed for ${bookId}:`, err.message);
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
