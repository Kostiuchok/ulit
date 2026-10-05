import { PRINT_TRIM_SIZE_MM, COVER_BLEED_MM, spineThicknessMm } from "shared-types";

// Kept in its own module, deliberately separate from CoverDesignerCanvas.tsx
// -- that file imports `fabric` (which pulls in the native `canvas` package
// as a dependency), so anything importing FROM it drags that whole
// dependency graph into whatever bundle the importer ends up in. Found live
// in prod: CoverPrintSpread.tsx (a static preview rendered on
// output-data/cover/page.tsx, a server-rendered route) imported
// computeCoverLayout from CoverDesignerCanvas -- that pulled `canvas`'s
// native binding into the page's SSR bundle, which isn't compiled for the
// web image's alpine/musl runtime ("Cannot find module
// '../build/Release/canvas.node'"), producing a 500 on every request to
// that route. This module has zero dependency on fabric, so it's safe to
// import from anywhere, server or client -- CoverDesignerCanvas.tsx itself
// now imports its own copy of this logic from here too, so there's exactly
// one implementation, not two that could drift.
const DISPLAY_W = 350;
const DEFAULT_PAGE_COUNT = 150;

export type CoverFormat = "ebook" | "softcover" | "hardcover";

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CoverLayout {
  format: CoverFormat;
  totalW: number;
  totalH: number;
  // Print bleed ("вильот") in display px, outside every outer edge of the
  // wrap. Panel coordinates above stay TRIM coordinates -- (0,0) is the
  // trim corner, the bleed zone is the negative/overflow area around it --
  // so designs saved before bleed existed keep their exact positions.
  // 0 for the e-book cover, which is never trimmed.
  bleed: number;
  front: PanelRect;
  spine?: PanelRect;
  back?: PanelRect;
}

function deriveDisplayGeometry(trimMm: { widthMm: number; heightMm: number }) {
  const displayH = Math.round(DISPLAY_W * (trimMm.heightMm / trimMm.widthMm));
  // DISPLAY_W represents trimMm.widthMm -- used to convert a real-world
  // spine thickness (mm) into display px.
  const pxPerMm = DISPLAY_W / trimMm.widthMm;
  return { displayH, pxPerMm };
}

function computeSpineWidthPx(format: CoverFormat, pageCount: number | null | undefined, pxPerMm: number): number {
  const pages = pageCount && pageCount > 0 ? pageCount : DEFAULT_PAGE_COUNT;
  const spineMm = spineThicknessMm(pages, format === "hardcover");
  return Math.max(6, Math.round(spineMm * pxPerMm));
}

export function computeCoverLayout(
  format: CoverFormat,
  pageCount?: number | null,
  trimMm: { widthMm: number; heightMm: number } = PRINT_TRIM_SIZE_MM
): CoverLayout {
  const { displayH: DISPLAY_H, pxPerMm } = deriveDisplayGeometry(trimMm);
  if (format === "ebook") {
    return { format, totalW: DISPLAY_W, totalH: DISPLAY_H, bleed: 0, front: { x: 0, y: 0, w: DISPLAY_W, h: DISPLAY_H } };
  }
  const spineW = computeSpineWidthPx(format, pageCount, pxPerMm);
  return {
    format,
    totalW: DISPLAY_W * 2 + spineW,
    totalH: DISPLAY_H,
    bleed: COVER_BLEED_MM * pxPerMm,
    back: { x: 0, y: 0, w: DISPLAY_W, h: DISPLAY_H },
    spine: { x: DISPLAY_W, y: 0, w: spineW, h: DISPLAY_H },
    front: { x: DISPLAY_W + spineW, y: 0, w: DISPLAY_W, h: DISPLAY_H },
  };
}
