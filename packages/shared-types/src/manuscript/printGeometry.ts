// Real print-book margins. Single source of truth for both the actual
// print-PDF render (printHtml.ts) and the live editor's own book-format
// page-geometry check (apps/web/components/manuscript/manuscriptLayout.ts)
// so that check can never drift from what actually prints.
// Top/bottom/outer measured directly off a real printed book (author,
// 2026-09-09) -- docs/print-file-technical-requirements.md (printto.ua) only
// ever specified inner/outer (20mm/15mm for books), no top/bottom split, and
// its own outer figure is now superseded by this direct measurement.
export const PAGE_MARGIN_TOP_MM = 15;
export const PAGE_MARGIN_BOTTOM_MM = 20; // was 25mm -- author call, 2026-09-09
export const PAGE_MARGIN_INNER_MM = 20; // binding/spine side (recto: left, verso: right) -- unchanged, not part of the 2026-09-09 measurement
export const PAGE_MARGIN_OUTER_MM = 20;
// Distance from the physical bottom edge of the page to the page-number
// baseline (author call, 2026-09-09) -- independent of PAGE_MARGIN_BOTTOM_MM
// itself, since the number sits inside that margin area rather than
// defining it. printHtml.ts positions the number's margin box with
// vertical-align:bottom + padding-bottom of this value so it lands exactly
// here regardless of how tall the bottom margin area is.
export const PAGE_NUMBER_BOTTOM_OFFSET_MM = 10;
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
export const BODY_LINE_HEIGHT_EM = 1.4;

// Title-page vertical rhythm (author spec, 2026-09-10), measured as distance
// from the physical page edge to each line's BASELINE, against the
// platform's standard trim size (130x200mm, PRINT_TRIM_SIZE_MM -- not
// imported directly here to avoid a circular import, since index.ts
// re-exports this whole module). printHtml.ts scales every one of these by
// (book's real heightMm / this reference) before turning it into an actual
// margin-top -- a fixed mm push looks right at 200mm tall but crowds a
// shorter trim and leaves the bottom block floating on a taller one, so the
// PROPORTION of page height is what's kept constant across formats, not the
// absolute mm figure below.
export const TITLE_PAGE_REFERENCE_HEIGHT_MM = 200;
export const TITLE_PAGE_PEN_NAME_TOP_MM = 30; // top edge -> pen name baseline
export const TITLE_PAGE_TITLE_TOP_MM = 75; // top edge -> title baseline
export const TITLE_PAGE_SUBTITLE_GAP_MM = 15; // title baseline -> subtitle baseline
export const TITLE_PAGE_IMPRINT_BOTTOM_MM = 30; // bottom edge -> imprint block's LAST line ("Українська літера") baseline
export const TITLE_PAGE_YEAR_BOTTOM_MM = 20; // bottom edge -> year line baseline

// Font sizes are absolute typographic sizes (pt), not scaled by trim size --
// only the vertical rhythm above is made proportional per author instruction.
export const TITLE_PAGE_PEN_NAME_FONT_PT = 16;
export const TITLE_PAGE_TITLE_FONT_PT = 24;
export const TITLE_PAGE_SUBTITLE_FONT_PT = 20;
export const TITLE_PAGE_IMPRINT_FONT_PT = 16;
export const TITLE_PAGE_YEAR_FONT_PT = 14;
// Explicit (not browser/WeasyPrint "normal") line-height for the two-line
// imprint block -- the baseline math below needs to know exactly how far
// apart "ULIT" and "Українська літера" sit, which an implicit default can't
// give reliably across renderers.
export const TITLE_PAGE_IMPRINT_LINE_HEIGHT_EM = 1.2;
