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
// Body text size -- author-specified 2026-09-09, superseding the earlier
// cap-height-ruler-derived value (8.66pt, itself derived from a 2mm
// cap-height reading against a real printed book) that read too small at
// this trim size (130x200mm) despite matching that one physical measurement.
export const BODY_FONT_PT = 10;
// Line-height as a ratio of font-size, not an absolute mm length -- also
// author-specified 2026-09-09, replacing the earlier independent
// baseline-to-baseline mm measurement (4mm, tied to the old 8.66pt) so the
// two move together automatically whenever BODY_FONT_PT changes, instead of
// needing a second physical re-measurement every time.
export const BODY_LINE_HEIGHT_EM = 1.3;
