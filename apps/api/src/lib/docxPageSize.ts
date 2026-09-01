import { execSync } from "child_process";

// A .docx is a zip container; the page size Word actually used lives in
// word/document.xml's <w:sectPr>. Read via `unzip -p` (same technique as
// apps/worker/src/lib/docxImageAlignment.ts) rather than adding a zip-parsing
// npm dependency for a single file read. Requires `unzip` in this image
// (apps/api/Dockerfile).
function readDocumentXml(docxPath: string): string | null {
  try {
    return execSync(`unzip -p "${docxPath}" word/document.xml`, {
      timeout: 15_000,
      maxBuffer: 50 * 1024 * 1024,
    }).toString("utf-8");
  } catch {
    return null; // malformed/password-protected docx, or "unzip" missing
  }
}

// Word stores page dimensions in twentieths of a point ("twips").
// 1440 twips = 1 inch = 25.4mm.
const TWIPS_PER_MM = 1440 / 25.4;

const PGSZ_RE = /<w:pgSz\b[^>]*\bw:w="(\d+)"[^>]*\bw:h="(\d+)"[^>]*\/?>/;
// w:w/w:h attribute order isn't guaranteed by the spec -- try the reverse order too.
const PGSZ_RE_REVERSED = /<w:pgSz\b[^>]*\bw:h="(\d+)"[^>]*\bw:w="(\d+)"[^>]*\/?>/;

export interface DocxPageSize {
  widthMm: number;
  heightMm: number;
}

/**
 * Reads the page size Word used for the document (first <w:pgSz> found in
 * document order -- the overwhelmingly common single-section case for a
 * self-published manuscript). Multi-section documents with different page
 * setups per section are a known unhandled edge case.
 */
export function extractDocxPageSize(docxPath: string): DocxPageSize | null {
  const xml = readDocumentXml(docxPath);
  if (!xml) return null;

  const match = xml.match(PGSZ_RE) ?? xml.match(PGSZ_RE_REVERSED);
  if (!match) return null;

  const wTwips = parseInt(match[1], 10);
  const hTwips = parseInt(match[2], 10);
  if (!Number.isFinite(wTwips) || !Number.isFinite(hTwips)) return null;

  return {
    widthMm: wTwips / TWIPS_PER_MM,
    heightMm: hTwips / TWIPS_PER_MM,
  };
}

export interface PageSizeValidationResult {
  valid: boolean;
  detected: DocxPageSize | null;
  message?: string;
}

/**
 * Compares the docx's actual page size against the platform's print trim
 * size (PRINT_TRIM_SIZE_MM, shared-types). `toleranceMm` absorbs rounding
 * noise from twips<->mm conversion and minor inconsistency between what
 * different Word versions write for the "same" page setup -- not meant to
 * allow genuinely different sizes through.
 *
 * Purely informational for the caller (apps/api/src/modules/books/upload.ts
 * never blocks on this) -- the actual print PDF is fully reflowed by the
 * platform's own WeasyPrint pipeline regardless of the source page size, so
 * a mismatch here only means the author's on-screen pagination in Word/
 * Google Docs won't visually match the eventual printed book.
 */
export function validateDocxPageSize(
  docxPath: string,
  expected: DocxPageSize,
  toleranceMm = 2
): PageSizeValidationResult {
  const detected = extractDocxPageSize(docxPath);

  if (!detected) {
    return {
      valid: false,
      detected: null,
      message:
        "Не вдалося визначити розмір сторінки документа. Переконайтесь, що файл — коректний .docx (не пошкоджений, не захищений паролем).",
    };
  }

  const widthOk = Math.abs(detected.widthMm - expected.widthMm) <= toleranceMm;
  const heightOk = Math.abs(detected.heightMm - expected.heightMm) <= toleranceMm;

  if (widthOk && heightOk) {
    return { valid: true, detected };
  }

  return {
    valid: false,
    detected,
    message:
      `Розмір сторінки документа (${detected.widthMm.toFixed(0)}×${detected.heightMm.toFixed(0)}мм) ` +
      `відрізняється від обраного розміру книги (${expected.widthMm.toFixed(0)}×${expected.heightMm.toFixed(0)}мм). ` +
      `Це не завадить завантаженню — платформа сама переверстає текст під розмір книги — ` +
      `але щоб розбивка на сторінки в Word виглядала ближче до майбутньої книги, можете виставити ` +
      `власний розмір сторінки ${expected.widthMm.toFixed(0)}×${expected.heightMm.toFixed(0)}мм ` +
      `(${(expected.widthMm / 25.4).toFixed(1)}×${(expected.heightMm / 25.4).toFixed(1)}″) у Word: Макет → Розмір.`,
  };
}
