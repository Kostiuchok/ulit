import {
  PAGE_MARGIN_TOP_MM,
  PAGE_MARGIN_BOTTOM_MM,
  PAGE_MARGIN_INNER_MM,
  PAGE_MARGIN_OUTER_MM,
  BODY_FONT_PT,
  PRINT_TRIM_SIZE_MM,
} from "shared-types";

// On-screen page geometry for the editor's own book-format check (the
// toolbar toggle, T-1961) -- computed from the book's REAL trim size
// (printWidthMm/printHeightMm), not a hardcoded constant, so the check
// actually reflects the book being edited (Statement/A4/ДСТУ formats
// alike) instead of always simulating A5 regardless of the book's real
// format. Reuses the exact same print-margin constants as the real print
// pipeline (printHtml.ts) for top/bottom; left/right is a single symmetric
// average of the real pipeline's inner/outer (binding/non-binding side)
// margins, since this single-page-at-a-time editor overlay isn't paginated
// into actual recto/verso leaves the way the real PDF is -- close enough
// for "does my text/image overflow" checks, not meant to predict exactly
// which page a line lands on.
const MM = 5; // px per mm on-screen (~127 DPI zoom)
const MARGIN_X_MM = (PAGE_MARGIN_INNER_MM + PAGE_MARGIN_OUTER_MM) / 2;

export interface PageGeometry {
  pageW: number;
  pageH: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  contentW: number;
  contentH: number;
  bodyFontPx: number;
}

export function computePageGeometry(widthMm: number, heightMm: number): PageGeometry {
  const pageW = Math.round(widthMm * MM);
  const pageH = Math.round(heightMm * MM);
  const marginX = Math.round(MARGIN_X_MM * MM);
  const marginTop = Math.round(PAGE_MARGIN_TOP_MM * MM);
  const marginBottom = Math.round(PAGE_MARGIN_BOTTOM_MM * MM);
  return {
    pageW,
    pageH,
    marginX,
    marginTop,
    marginBottom,
    contentW: pageW - marginX * 2,
    contentH: pageH - marginTop - marginBottom,
    bodyFontPx: Math.round(BODY_FONT_PT * ((MM * 25.4) / 72) * 10) / 10,
  };
}

// Fallback for a book with no chosen print size yet -- the platform default
// trim (PRINT_TRIM_SIZE_MM, shared-types), same fallback used everywhere
// else a book's format is resolved (resolveBookPrintFormat).
export const DEFAULT_PAGE_GEOMETRY = computePageGeometry(PRINT_TRIM_SIZE_MM.widthMm, PRINT_TRIM_SIZE_MM.heightMm);
