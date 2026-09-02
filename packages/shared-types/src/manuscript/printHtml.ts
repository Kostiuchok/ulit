import { MANUSCRIPT_PROSE_CSS } from "./proseStyles";
import { manuscriptContentToHtml } from "./extensions";
import { splitFrontMatter } from "./splitFrontMatter";
import { DEFAULT_PAGE_NUMBER_POSITION, type PageNumberPosition } from "./pageNumberPosition";
import { extractOutline } from "./outline";
import {
  PAGE_MARGIN_TOP_MM,
  PAGE_MARGIN_BOTTOM_MM,
  PAGE_MARGIN_INNER_MM,
  PAGE_MARGIN_OUTER_MM,
  BODY_FONT_PT,
} from "./printGeometry";

// T-2057 -- print-only CSS on top of the shared MANUSCRIPT_PROSE_CSS (which
// stays purely presentational, no pagination semantics, since it's also used
// by the live scrolling editor). Everything here is CSS Paged Media
// (https://www.w3.org/TR/css-gcpm-3/) -- WeasyPrint was picked specifically
// because it supports `break-before/after: recto/verso` natively
// (docs/T-2057-checklist.md section 3); Chromium/Puppeteer does not.
//
// Margins (printGeometry.ts): 20mm inner (binding side) / 15mm outer, per
// the printer's own technical requirements for books
// (docs/print-file-technical-requirements.md, printto.ua) -- the live
// editor's own book-format check (apps/web/components/manuscript/
// manuscriptLayout.ts) now reads the exact same constants, so the two can
// no longer drift on margins the way they used to when the editor hardcoded
// its own approximate numbers.

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
    /* Back cover -- its own named page, zero margin, so the image fills the
       full physical page (not inset by the interior pages' text margins). */
    @page back-cover {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0;
      ${pageNumberBox} { content: none; }
      @top-center { content: none; }
    }
    .back-cover-page {
      page: back-cover;
      break-before: page;
    }
    .back-cover-page img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    body { font-size: ${BODY_FONT_PT}pt; }

    /* T-2057 розділ 2 -- front matter always opens on recto (WeasyPrint
       inserts the blank verso "форзац" automatically to satisfy this), and
       the colophon (right after the manual page-break the front-matter
       generator already inserts, frontMatter.ts) always lands on verso. */
    .front-matter { break-before: recto; }
    .front-matter div[data-type="page-break"] { break-after: verso; }

    /* NOTE: no blanket ".manuscript-body { break-before: recto }" here
       (removed) -- when Зміст (.toc, also break-before:recto below) happens
       to fill exactly to a recto page, forcing the body onto ANOTHER recto
       right after inserted an unwanted blank verso page in between (verified
       against a real render, author-reported). The per-chapter rule below
       already forces a fresh recto for an actual "Розділ" heading; a body
       that doesn't open with one is now free to flow directly after Зміст. */

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

    /* Strip the editor-only visual marker (dashed line + "Розрив сторінки"
       label from MANUSCRIPT_PROSE_CSS) everywhere in print -- both the
       front-matter's structural title/colophon separator and any
       author-inserted manual break in the body use this same div. */
    .manuscript-prose div[data-type="page-break"] {
      height: 0;
      margin: 0;
      border: none;
    }
    .manuscript-prose div[data-type="page-break"]::after {
      content: none;
    }
    /* Author-inserted manual page break -- real forced break, scoped to the
       BODY only. The front-matter's own page-break div (title -> colophon)
       must NOT get break-before:page here: it already forces positioning via
       .front-matter div[data-type="page-break"] { break-after: verso } above,
       and stacking break-before:page on top double-breaks it -- verified
       against a real WeasyPrint render, this combination produced two
       consecutive blank pages before the colophon instead of the intended
       single verso-aligned page (break-before:page forces the empty div onto
       its own new page, which already happens to be verso; break-after:verso
       then evaluates the page AFTER that one -- recto -- and inserts a
       second blank to reach the next verso). Dropping break-before:page here
       leaves the div flowing inline (zero height, no break) right after the
       title content, so break-after:verso alone decides the colophon's page. */
    .manuscript-body div[data-type="page-break"] {
      break-before: page;
    }

    /* Auto-generated Зміст (see outline.ts): always starts on a fresh recto
       page, same as front-matter/chapters. The page-number span is an
       "a href=#..." targeting the matching heading's own id (styledParagraph
       renderHTML now emits a real element id, not just data-id) --
       target-counter() asks WeasyPrint itself, at real layout time, what
       page that element landed on, so this can never drift from the actual
       printed pagination the way a pre-computed number could. */
    .toc { break-before: recto; }
    .toc-entry-page {
      text-decoration: none;
      color: inherit;
    }
    .toc-entry-page::after {
      content: target-counter(attr(href), page);
    }
    /* WeasyPrint (verified empirically, v69) can't evaluate the shared
       MANUSCRIPT_PROSE_CSS's calc(var(--ms-font-size, 1rem) + 2pt) --
       mixing a custom-property fallback with unit math -- and silently
       drops it ("Invalid math function"), which nobody noticed before since
       the print pipeline never rendered a Зміст at all until now. Override
       with a literal print-safe size here rather than touching the shared
       rule, which renders fine in real browsers (live editor + preview). */
    .manuscript-prose p[data-variant="toc-title"],
    .manuscript-prose div[data-type="toc-entry"] {
      font-size: ${BODY_FONT_PT + 2}pt;
    }
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Builds the "Зміст" block from the body's own Розділ/Глава/Заголовок/
// Підзаголовок headings (extractOutline, shared-types) -- never authored by
// hand, never persisted, rebuilt fresh from whatever the manuscript's
// current structure is every time the print PDF is rendered. Reuses the
// exact markup shape (data-type="toc-entry"/data-tier, .toc-entry-text/
// .toc-entry-page) that MANUSCRIPT_PROSE_CSS already styles for the
// browser-side TocEntry preview node, so the two look the same -- only the
// page-number mechanism differs (target-counter here vs. a pre-computed
// number there).
function buildTocHtml(body: any[]): string {
  const outline = extractOutline(body);
  if (outline.length === 0) return "";
  const entries = outline
    .map(
      (item) =>
        `<div data-type="toc-entry" data-tier="${item.tier}">` +
        `<span class="toc-entry-text">${escapeHtml(item.text)}</span>` +
        `<a class="toc-entry-page" href="#${escapeHtml(item.id)}"></a>` +
        `</div>`
    )
    .join("\n");
  return `<div class="toc"><p data-style="normal" data-variant="toc-title">Зміст</p>${entries}</div>`;
}

export interface BuildManuscriptPrintHtmlInput {
  content: any;
  widthMm: number;
  heightMm: number;
  pageNumberPosition?: PageNumberPosition;
  // Rendered as the PDF's final page, full-bleed (its own zero-margin named
  // @page, unlike every interior page) -- so a print-preview download shows
  // the whole physical object (interior + back cover), not just the text.
  // A public URL (storage.service.ts's publicUrl()) -- WeasyPrint fetches it
  // like a browser would, same as the on-site cover images already are.
  backCoverUrl?: string | null;
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
  backCoverUrl,
}: BuildManuscriptPrintHtmlInput): string {
  const doc = content ?? { type: "doc", content: [] };
  const allContent: any[] = doc.content ?? [];
  const { front, body } = splitFrontMatter(allContent);

  const frontHtml = front.length > 0 ? manuscriptContentToHtml({ type: "doc", content: front }) : "";
  const bodyHtml = manuscriptContentToHtml({ type: "doc", content: body });
  const tocHtml = buildTocHtml(body);
  const backCoverHtml = backCoverUrl
    ? `<div class="back-cover-page"><img src="${escapeHtml(backCoverUrl)}" alt=""></div>`
    : "";

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
${tocHtml}
<div class="manuscript-body">${bodyHtml}</div>
</div>
${backCoverHtml}
</body>
</html>`;
}
