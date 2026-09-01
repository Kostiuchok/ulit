// Real print-book margins, per the printer's own technical requirements for
// books (docs/print-file-technical-requirements.md, printto.ua). Single
// source of truth for both the actual print-PDF render (printHtml.ts) and
// the live editor's own book-format page-geometry check (apps/web/
// components/manuscript/manuscriptLayout.ts) so that check can never drift
// from what actually prints.
export const PAGE_MARGIN_TOP_MM = 18;
export const PAGE_MARGIN_BOTTOM_MM = 20;
export const PAGE_MARGIN_INNER_MM = 20; // binding/spine side (recto: left, verso: right)
export const PAGE_MARGIN_OUTER_MM = 15;
export const BODY_FONT_PT = 11;
