// Real print-book margins. Single source of truth for both the actual
// print-PDF render (printHtml.ts) and the live editor's own book-format
// page-geometry check (apps/web/components/manuscript/manuscriptLayout.ts)
// so that check can never drift from what actually prints.
// Top/bottom/outer measured directly off a real printed book (author,
// 2026-09-09) -- docs/print-file-technical-requirements.md (printto.ua) only
// ever specified inner/outer (20mm/15mm for books), no top/bottom split, and
// its own outer figure is now superseded by this direct measurement.
export const PAGE_MARGIN_TOP_MM = 15;
export const PAGE_MARGIN_BOTTOM_MM = 25;
export const PAGE_MARGIN_INNER_MM = 20; // binding/spine side (recto: left, verso: right) -- unchanged, not part of the 2026-09-09 measurement
export const PAGE_MARGIN_OUTER_MM = 20;
// Also measured off that same printed book: cap-height (top of "H"/"A" to
// baseline, the only letter-height a ruler can actually measure -- CSS
// font-size is the full em box, always taller) came out to 2mm. Liberation
// Serif's own metrics (fonttools: OS/2.sCapHeight / head.unitsPerEm, checked
// directly against the font file in the worker image) put cap-height at
// 0.6548 of the em -- 2mm / 0.6548 = 3.0544mm em = 8.66pt. Was 11pt
// (cap-height 2.54mm), a real reduction, not measurement noise.
export const BODY_FONT_PT = 8.66;
// Baseline-to-baseline spacing, also measured directly (4mm) -- set as an
// absolute length rather than derived as a unitless ratio off BODY_FONT_PT,
// so it keeps matching a re-measurement of the printed page even if the
// font size above ever changes for an unrelated reason.
export const BODY_LINE_HEIGHT_MM = 4;
