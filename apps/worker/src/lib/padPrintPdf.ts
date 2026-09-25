import { execFileSync } from "child_process";
import path from "path";
import { padPrintPageCount } from "shared-types";

export function countPdfPages(pdfPath: string): number | undefined {
  try {
    const pageCountOutput = execFileSync(
      "gs",
      ["-q", "-dNODISPLAY", "-dNOSAFER", "-c", `(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit`],
      { timeout: 30_000 }
    )
      .toString()
      .trim();
    const parsed = parseInt(pageCountOutput, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {
    // Non-fatal -- caller falls back to leaving the file unpadded.
  }
  return undefined;
}

// T-2065 -- append blank pages so the print PDF is even (perfect binding).
// Blank page uses the same trim as the book so Ghostscript does not mix sizes.
export function padPdfToEvenPages(
  inputPdf: string,
  tmpDir: string,
  widthMm: number,
  heightMm: number
): string {
  const count = countPdfPages(inputPdf);
  if (count == null) return inputPdf;
  const target = padPrintPageCount(count);
  if (target === count) return inputPdf;

  const wPt = ((widthMm * 72) / 25.4).toFixed(3);
  const hPt = ((heightMm * 72) / 25.4).toFixed(3);
  const blanksNeeded = target - count;
  const blankPdf = path.join(tmpDir, "blank-pad.pdf");
  const paddedPdf = path.join(tmpDir, "manuscript-padded.pdf");

  execFileSync(
    "gs",
    [
      "-q",
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=pdfwrite",
      `-sOutputFile=${blankPdf}`,
      "-c",
      `<< /PageSize [${wPt} ${hPt}] >> setpagedevice ${"showpage ".repeat(blanksNeeded)}`,
    ],
    { timeout: 30_000 }
  );
  execFileSync(
    "gs",
    ["-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite", `-sOutputFile=${paddedPdf}`, inputPdf, blankPdf],
    { timeout: 60_000 }
  );
  return paddedPdf;
}
