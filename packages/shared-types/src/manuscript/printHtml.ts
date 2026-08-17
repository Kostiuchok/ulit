import { MANUSCRIPT_PROSE_CSS } from "./proseStyles";
import { manuscriptContentToHtml } from "./extensions";
import { splitFrontMatter } from "./splitFrontMatter";
import { DEFAULT_PAGE_NUMBER_POSITION, type PageNumberPosition } from "./pageNumberPosition";

// T-2057 -- print-only CSS on top of the shared MANUSCRIPT_PROSE_CSS (which
// stays purely presentational, no pagination semantics, since it's also used
// by the live scrolling editor). Everything here is CSS Paged Media
// (https://www.w3.org/TR/css-gcpm-3/) -- WeasyPrint was picked specifically
// because it supports `break-before/after: recto/verso` natively
// (docs/T-2057-checklist.md section 3); Chromium/Puppeteer does not.
//
// Margins: 20mm inner (binding side) / 15mm outer, per the printer's own
// technical requirements for books (docs/print-file-technical-requirements.md,
// printto.ua) -- not the client editor's approximate 16mm A5-toggle numbers
// (apps/web/components/manuscript/manuscriptLayout.ts), which are stale
// (hardcoded to the old 148x210mm trim, pre-dates the genre-driven format
// system) and only drive an in-editor visual approximation, not the real
// print file.
const PAGE_MARGIN_TOP_MM = 18;
const PAGE_MARGIN_BOTTOM_MM = 20;
const PAGE_MARGIN_INNER_MM = 20;
const PAGE_MARGIN_OUTER_MM = 15;
const BODY_FONT_PT = 11;

function pageNumberMarginBox(position: PageNumberPosition): string {
  switch (position) {
    case "bottom-left":
      return "@bottom-left";
    case "bottom-right":
      return "@bottom-right";
    default:
      return "@bottom-center";
  }
}

function printCss(widthMm: number, heightMm: number, pageNumberPosition: PageNumberPosition): string {
  const pageNumberBox = pageNumberMarginBox(pageNumberPosition);
  return `
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin-top: ${PAGE_MARGIN_TOP_MM}mm;
      margin-bottom: ${PAGE_MARGIN_BOTTOM_MM}mm;
      ${pageNumberBox} { content: counter(page); font-size: 9pt; color: #333; }
      @top-center { content: string(chapter-title); font-size: 8pt; color: #666; }
    }
    @page :right {
      margin-left: ${PAGE_MARGIN_INNER_MM}mm;
      margin-right: ${PAGE_MARGIN_OUTER_MM}mm;
    }
    @page :left {
      margin-left: ${PAGE_MARGIN_OUTER_MM}mm;
      margin-right: ${PAGE_MARGIN_INNER_MM}mm;
    }
    @page :first {
      @top-center { content: none; }
    }
    body { font-size: ${BODY_FONT_PT}pt; }

    /* T-2057 розділ 2 -- front matter always opens on recto (WeasyPrint
       inserts the blank verso "форзац" automatically to satisfy this), and
       the colophon (right after the manual page-break the front-matter
       generator already inserts, frontMatter.ts) always lands on verso. */
    .front-matter { break-before: recto; }
    .front-matter div[data-type="page-break"] { break-after: verso; }

    /* Body always opens recto too -- redundant with the chapter rule below
       when the first body block is itself a chapter heading (the normal
       case), but a safety net when it isn't. */
    .manuscript-body { break-before: recto; }

    /* Розділ (chapter) always starts a fresh recto page; section/heading/
       subheading intentionally force no break (natural flow). */
    .manuscript-prose p[data-style="chapter"] {
      break-before: recto;
      string-set: chapter-title content();
    }

    /* Епіграф always alone on its own page, both sides. */
    .manuscript-prose p[data-style="epigraph"] {
      break-before: page;
      break-after: page;
    }

    /* Author-inserted manual page break -- real break, no visible marker
       (the dashed line + "Розрив сторінки" label from MANUSCRIPT_PROSE_CSS
       is an editor-only affordance, meaningless in the final print file). */
    .manuscript-prose div[data-type="page-break"] {
      break-before: page;
      height: 0;
      margin: 0;
      border: none;
    }
    .manuscript-prose div[data-type="page-break"]::after {
      content: none;
    }
  `;
}

export interface BuildManuscriptPrintHtmlInput {
  content: any;
  widthMm: number;
  heightMm: number;
  pageNumberPosition?: PageNumberPosition;
}

// Full standalone HTML document for WeasyPrint to render straight to PDF.
// This is the ONLY place print-specific pagination CSS (break-before/after:
// recto/verso/page, @page geometry) is defined -- MANUSCRIPT_PROSE_CSS stays
// free of it so the live scrolling editor never accidentally inherits a
// print-only page-break rule.
export function buildManuscriptPrintHtml({
  content,
  widthMm,
  heightMm,
  pageNumberPosition = DEFAULT_PAGE_NUMBER_POSITION,
}: BuildManuscriptPrintHtmlInput): string {
  const doc = content ?? { type: "doc", content: [] };
  const allContent: any[] = doc.content ?? [];
  const { front, body } = splitFrontMatter(allContent);

  const frontHtml = front.length > 0 ? manuscriptContentToHtml({ type: "doc", content: front }) : "";
  const bodyHtml = manuscriptContentToHtml({ type: "doc", content: body });

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<style>${MANUSCRIPT_PROSE_CSS}</style>
<style>${printCss(widthMm, heightMm, pageNumberPosition)}</style>
</head>
<body>
<div class="manuscript-prose">
${frontHtml ? `<div class="front-matter">${frontHtml}</div>` : ""}
<div class="manuscript-body">${bodyHtml}</div>
</div>
</body>
</html>`;
}
