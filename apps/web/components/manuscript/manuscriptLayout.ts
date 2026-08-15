// A5 trim (148 x 210mm) print-page geometry, shared by the paginated preview
// (ManuscriptPagePreview.tsx) and the editor's "A5" check-toggle
// (ManuscriptEditor.tsx / T-1961) so both measure and render at the exact
// same content box -- a mismatch here is what used to make the live editor's
// line wraps disagree with the paginated preview.
const MM = 5; // px per mm on-screen (~127 DPI zoom)
export const PAGE_W = Math.round(148 * MM);
export const PAGE_H = Math.round(210 * MM);
export const MARGIN_X = Math.round(16 * MM);
export const MARGIN_TOP = Math.round(18 * MM);
export const MARGIN_BOTTOM = Math.round(20 * MM);
export const CONTENT_W = PAGE_W - MARGIN_X * 2;
export const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

// Standard print-book body text is ~10-11pt at A5 trim; derive the on-screen
// px equivalent from the same mm->px zoom used for the page itself.
const PRINT_BODY_PT = 11;
export const PRINT_BODY_PX = Math.round(PRINT_BODY_PT * (MM * 25.4 / 72) * 10) / 10;
