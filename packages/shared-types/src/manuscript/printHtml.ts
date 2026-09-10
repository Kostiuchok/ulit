import { MANUSCRIPT_PROSE_CSS } from "./proseStyles";
import { manuscriptContentToHtml } from "./extensions";
import { splitFrontMatter } from "./splitFrontMatter";
import { buildFrontMatterParts, type FrontMatterMeta } from "./frontMatter";
import { DEFAULT_PAGE_NUMBER_POSITION, type PageNumberPosition } from "./pageNumberPosition";
import { extractOutline } from "./outline";
import {
  PAGE_MARGIN_TOP_MM,
  PAGE_MARGIN_BOTTOM_MM,
  PAGE_MARGIN_INNER_MM,
  PAGE_MARGIN_OUTER_MM,
  BODY_FONT_PT,
  BODY_LINE_HEIGHT_EM,
  PAGE_NUMBER_BOTTOM_OFFSET_MM,
  TITLE_PAGE_REFERENCE_HEIGHT_MM,
  TITLE_PAGE_PEN_NAME_TOP_MM,
  TITLE_PAGE_TITLE_TOP_MM,
  TITLE_PAGE_SUBTITLE_GAP_MM,
  TITLE_PAGE_IMPRINT_BOTTOM_MM,
  TITLE_PAGE_YEAR_BOTTOM_MM,
  TITLE_PAGE_PEN_NAME_FONT_PT,
  TITLE_PAGE_TITLE_FONT_PT,
  TITLE_PAGE_SUBTITLE_FONT_PT,
  TITLE_PAGE_IMPRINT_FONT_PT,
  TITLE_PAGE_YEAR_FONT_PT,
  TITLE_PAGE_IMPRINT_LINE_HEIGHT_EM,
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

const PT_TO_MM = 25.4 / 72;

// Title-page vertical rhythm, computed fresh per render from the book's own
// physical trim height so the proportions in printGeometry.ts's comment
// (measured against the 200mm-tall reference) hold at any trim size instead
// of just the one they were measured on.
//
// titleTop (pen name/title/subtitle) and titleBottom (imprint+year) are two
// SEPARATE flex items inside a fixed-height ".titlepage" container
// (buildManuscriptPrintHtml wraps them this way), laid out with
// justify-content:space-between -- not one shared margin-top chain from page
// top to page bottom like this used to be. A margin-top chain assumes every
// line is exactly one line tall; a long title/subtitle wrapping onto a 2nd
// line made every sibling "pushed" via margin-top land further down than
// intended, occasionally overflowing titleBottom onto a second page even
// though titleBottom's own target position never changed (verified against a
// real render, author-reported 2026-09-10). Flex instead pins titleTop flush
// to the container's top and titleBottom flush to its bottom regardless of
// how tall titleTop's real rendered content turns out to be -- the two can
// only ever collide if the combined content is taller than the whole page,
// an unavoidable edge case no layout technique fixes.
//
// Within each group, a line's target is still expressed as "distance from
// the physical page edge to this line's baseline", and margin-top still
// derived as (this baseline - previous baseline - this line's own
// font-size) -- the same "baseline sits ~one font-size below the box's own
// top" approximation as before, not pixel-exact per font metrics, but the
// author-tuned proportions are what matter here, not a sub-millimetre
// baseline grid. This is still exact for titleBottom (imprint/year are
// fixed short strings that never wrap) and only approximate for titleTop's
// OWN internal title-to-subtitle gap -- but an error there can no longer
// cascade into titleBottom the way it used to.
function titlePageGeometryCss(heightMm: number, meta: Pick<FrontMatterMeta, "authorPenName">): string {
  const scale = heightMm / TITLE_PAGE_REFERENCE_HEIGHT_MM;
  const pt2mm = (pt: number) => pt * PT_TO_MM;

  const penNameFontMm = pt2mm(TITLE_PAGE_PEN_NAME_FONT_PT);
  const titleFontMm = pt2mm(TITLE_PAGE_TITLE_FONT_PT);
  const subtitleFontMm = pt2mm(TITLE_PAGE_SUBTITLE_FONT_PT);
  const imprintFontMm = pt2mm(TITLE_PAGE_IMPRINT_FONT_PT);
  const yearFontMm = pt2mm(TITLE_PAGE_YEAR_FONT_PT);
  const imprintLineHeightMm = imprintFontMm * TITLE_PAGE_IMPRINT_LINE_HEIGHT_EM;

  // Clamped against the fixed (unscaled) print margins -- on the smallest
  // supported trim (pocket, 107x177mm) the scaled bottom distances land
  // INSIDE PAGE_MARGIN_BOTTOM_MM's fixed 20mm (17.7mm at that size for the
  // year line), i.e. past the printable content box's own bottom edge,
  // which WeasyPrint can't render as plain flowed text without pushing it
  // onto a next page. Floors keep every target inside the printable area at
  // every supported trim size instead of only the ones at or above the
  // 200mm reference.
  const penNameBaseline = Math.max(TITLE_PAGE_PEN_NAME_TOP_MM * scale, PAGE_MARGIN_TOP_MM);
  const titleBaseline = TITLE_PAGE_TITLE_TOP_MM * scale;
  const subtitleBaseline = titleBaseline + TITLE_PAGE_SUBTITLE_GAP_MM * scale;
  const imprintBottomMm = Math.max(TITLE_PAGE_IMPRINT_BOTTOM_MM * scale, PAGE_MARGIN_BOTTOM_MM);
  const yearBottomMm = Math.max(TITLE_PAGE_YEAR_BOTTOM_MM * scale, PAGE_MARGIN_BOTTOM_MM);
  const imprintLine2Baseline = heightMm - imprintBottomMm;
  const imprintLine1Baseline = imprintLine2Baseline - imprintLineHeightMm;
  const yearBaseline = heightMm - yearBottomMm;

  // authorPenName is optional -- "the line before the title" isn't always
  // the pen name; falling back to the top-of-page reference keeps the gap
  // correct instead of leaving a phantom blank space sized for a line that
  // was never rendered.
  const beforeTitleBaseline = meta.authorPenName ? penNameBaseline : PAGE_MARGIN_TOP_MM;

  const marginTop = (baseline: number, prevBaseline: number, fontMm: number) =>
    Math.max(0, baseline - prevBaseline - fontMm).toFixed(2);

  // ".titlepage"'s own height: translates yearBaseline (an absolute target
  // measured from the physical page top) into a height relative to the
  // container's own top edge (which starts flush at the content box's top,
  // PAGE_MARGIN_TOP_MM down from the physical edge) -- what pins titleBottom
  // (bottom:0, absolutely positioned against this box) flush against it.
  const titlepageHeightMm = Math.max(0, yearBaseline - PAGE_MARGIN_TOP_MM);

  return `
    /* position:relative + explicit height (not flex/justify-content:
       space-between, tried first) -- WeasyPrint's flexbox support turned out
       not to be reliable enough for this (verified against a real render,
       author-reported 2026-09-10: no spacing between the title-page lines
       at all, and the page still overflowed). position:absolute against a
       sized ancestor is a much older, more consistently-supported CSS
       feature and is the textbook tool for exactly this "pin to a fixed
       point, independent of a sibling's real height" need -- titleBottom
       below is pulled completely out of normal flow, so titleTop's actual
       rendered height (1 line or 3, wrapped or not) can never affect its
       position at all, not even indirectly through a margin/flex
       calculation. */
    .titlepage {
      position: relative;
      height: ${titlepageHeightMm.toFixed(2)}mm;
    }
    .titlepage-bottom {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
    }
    .manuscript-prose p[data-variant="titlepage-author"] {
      margin-top: ${marginTop(penNameBaseline, PAGE_MARGIN_TOP_MM, penNameFontMm)}mm;
    }
    .manuscript-prose p[data-variant="titlepage-title"] {
      margin-top: ${marginTop(titleBaseline, beforeTitleBaseline, titleFontMm)}mm;
    }
    .manuscript-prose p[data-variant="titlepage-subtitle"] {
      margin-top: ${marginTop(subtitleBaseline, titleBaseline, subtitleFontMm)}mm;
    }
    /* First child of ".titlepage-bottom" -- its position comes entirely from
       the absolutely-positioned parent's own bottom:0 (flush to titlepage's
       bottom edge), not from a margin-top chain reaching back through
       titleTop. */
    .manuscript-prose p[data-variant="titlepage-imprint-line1"] {
      margin-top: 0;
    }
    .manuscript-prose p[data-variant="titlepage-imprint-line2"] {
      margin-top: ${marginTop(imprintLine2Baseline, imprintLine1Baseline, imprintFontMm)}mm;
    }
    .manuscript-prose p[data-variant="titlepage-year"] {
      margin-top: ${marginTop(yearBaseline, imprintLine2Baseline, yearFontMm)}mm;
    }
  `;
}

function pageNumberMarginBox(position: PageNumberPosition): string {
  switch (position) {
    case "bottom-left":
      return "@bottom-left";
    case "bottom-right":
      return "@bottom-right";
    case "bottom-outer":
      // Handled entirely via the per-side @page :right/:left blocks in
      // printCss() -- there's no single margin box that means "outer" on
      // every page, so this return value is never actually used for it.
      return "@bottom-center";
    default:
      return "@bottom-center";
  }
}

// Shared declarations for whichever margin box ends up holding the page
// number -- factored out so the mirrored ("bottom-outer") case can repeat
// them in two separate boxes (@bottom-right on recto, @bottom-left on
// verso) without drifting from the fixed-side case's styling.
function pageNumberDeclarations(): string {
  return `
        content: counter(page); font-size: ${BODY_FONT_PT}pt; color: #333;
        font-family: "Times New Roman", "Liberation Serif", "Times", serif;
        vertical-align: bottom; padding-bottom: ${PAGE_NUMBER_BOTTOM_OFFSET_MM}mm;`;
}

function printCss(widthMm: number, heightMm: number, pageNumberPosition: PageNumberPosition): string {
  // "bottom-outer" mirrors the number to the outer (non-spine) edge of each
  // page -- @bottom-right on recto, @bottom-left on verso -- instead of the
  // single shared margin box the other three positions use on every page.
  const mirrored = pageNumberPosition === "bottom-outer";
  const pageNumberBox = pageNumberMarginBox(pageNumberPosition);
  const pageNumberDecl = pageNumberDeclarations();
  return `
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin-top: ${PAGE_MARGIN_TOP_MM}mm;
      margin-bottom: ${PAGE_MARGIN_BOTTOM_MM}mm;
      /* Page margin boxes (running header/footer) aren't in the document
         tree -- they don't inherit font-family from .manuscript-prose or
         even body, just WeasyPrint's own default (DejaVu Serif), so the
         Times New Roman override needs repeating here explicitly. Verified
         against a real render: without this, pdffonts still showed
         DejaVu-Serif embedded alongside Liberation Serif -- only these two
         margin boxes, everything in the actual page content was already
         Liberation Serif from .manuscript-prose's own rule (proseStyles.ts). */
      /* vertical-align:bottom + padding-bottom pins the number to an exact
         distance off the physical page edge (PAGE_NUMBER_BOTTOM_OFFSET_MM),
         independent of how tall the bottom margin area itself is -- without
         this the margin box centers its content within the whole
         margin-bottom area by default, which drifts every time
         PAGE_MARGIN_BOTTOM_MM changes. */
      ${mirrored ? "" : `${pageNumberBox} { ${pageNumberDecl} }`}
      @top-center { content: string(chapter-title); font-size: 8pt; color: #666; font-family: "Times New Roman", "Liberation Serif", "Times", serif; }
    }
    @page :right {
      margin-left: ${PAGE_MARGIN_INNER_MM}mm;
      margin-right: ${PAGE_MARGIN_OUTER_MM}mm;
      ${mirrored ? `@bottom-right { ${pageNumberDecl} }` : ""}
    }
    @page :left {
      margin-left: ${PAGE_MARGIN_OUTER_MM}mm;
      margin-right: ${PAGE_MARGIN_INNER_MM}mm;
      ${mirrored ? `@bottom-left { ${pageNumberDecl} }` : ""}
    }
    @page :first {
      @top-center { content: none; }
    }
    /* Back cover -- its own named page, zero margin, so the image fills the
       full physical page (not inset by the interior pages' text margins). */
    @page back-cover {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0;
      ${mirrored ? "@bottom-right { content: none; } @bottom-left { content: none; }" : `${pageNumberBox} { content: none; }`}
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
    body { font-size: ${BODY_FONT_PT}pt; line-height: ${BODY_LINE_HEIGHT_EM}em; }

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

    /* An inserted image that doesn't fit in the remaining space on the
       current page was getting sliced by the page boundary instead of
       flowing whole onto the next one (verified against a real render --
       a photo landed with its bottom half cut off, nothing carried over to
       the following page, the content just gone from the printed file --
       text from the next paragraph even printed straight through the
       missing part). break-inside:avoid reliably fixes this for a normal
       (align="center") block image -- WeasyPrint fragments block boxes
       correctly. It does NOT reliably fix it for a FLOATED one
       (align="left"/"right"): verified against several real renders that
       break-inside:avoid on a float is honored in some vertical positions
       and silently ignored (same clipping as with no rule at all) in
       others, depending on exactly how much room is left above the float
       -- a WeasyPrint fragmentation bug specific to floats, not something
       fixable from CSS alone. Rather than ship a fix that only sometimes
       works for a defect this severe (lost photo content in a book headed
       to a physical printer), left/right images stop floating for print
       specifically: rendered as centered blocks instead, same as
       align="center". The live editor keeps the real float+text-wrap
       (MANUSCRIPT_PROSE_CSS, proseStyles.ts) -- browsers don't paginate a
       scrolling page, so they never hit this. Print-only override, hence
       here rather than in the shared stylesheet. */
    .manuscript-prose img {
      break-inside: avoid;
    }
    /* Same :not([data-resize-container] img) qualifier as the proseStyles.ts
       rules being overridden here -- needed to match their specificity
       (a bare [data-align] selector loses the tie-break otherwise, since
       :not()'s argument counts toward specificity same as if it weren't
       negated; verified empirically, the override was silently no-op
       without it despite being the later of the two <style> tags). */
    .manuscript-prose img[data-align="left"]:not([data-resize-container] img),
    .manuscript-prose img[data-align="right"]:not([data-resize-container] img) {
      float: none;
      display: block;
      margin: 1em auto;
      max-width: 100%;
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
       rule, which renders fine in real browsers (live editor + preview).
       Same size as body text (BODY_FONT_PT, no "+2" bump) -- author
       feedback was that the auto-generated Зміст read too large next to
       the rest of the printed book. */
    .manuscript-prose p[data-variant="toc-title"],
    .manuscript-prose div[data-type="toc-entry"] {
      font-size: ${BODY_FONT_PT}pt;
    }
    /* Same reasoning, plain var() this time (no calc()) -- proseStyles.ts's
       p[data-style="normal"] now reads --ms-font-size so the live editor's
       page-format-check toggle (ManuscriptEditor.tsx) actually resizes body
       text. The print pipeline never sets that custom property at all, so
       without this override every ordinary paragraph would silently fall
       back to the var()'s own 1rem (16px) default instead of inheriting
       body's ${BODY_FONT_PT}pt -- body text alone is most of a book, so this
       one would have been impossible to miss on a real render, unlike the
       Зміст-only case above. */
    .manuscript-prose p[data-style="normal"] {
      font-size: ${BODY_FONT_PT}pt;
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
  // Title page + colophon, generated fresh from live Book fields (Вихідні
  // дані) on every render -- NOT read from `content`. Any front matter still
  // physically present at the start of `content` (baked in by the old
  // insert-into-manuscript approach, T-1953/T-1962) is stripped and
  // discarded below via splitFrontMatter, same mechanism, opposite purpose.
  frontMatterMeta: FrontMatterMeta;
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
  frontMatterMeta,
  backCoverUrl,
}: BuildManuscriptPrintHtmlInput): string {
  const doc = content ?? { type: "doc", content: [] };
  const allContent: any[] = doc.content ?? [];
  // `front` (if any) is old manuscript-baked front matter -- discarded, not
  // rendered; only `body` is used. The actual front matter below is always
  // generated fresh from frontMatterMeta instead.
  const { body } = splitFrontMatter(allContent);

  const frontMatterParts = buildFrontMatterParts(frontMatterMeta);
  const titleTopHtml = manuscriptContentToHtml({ type: "doc", content: frontMatterParts.titleTop });
  const titleBottomHtml = manuscriptContentToHtml({ type: "doc", content: frontMatterParts.titleBottom });
  const colophonHtml = manuscriptContentToHtml({ type: "doc", content: frontMatterParts.colophon });
  // Same literal markup PageBreak's own renderHTML emits (pageBreak.ts) --
  // built by hand here (not through the TipTap doc/generateHTML above) since
  // it's purely a structural seam between the two flex-wrapped title-page
  // groups and the colophon, not part of either's own node list anymore.
  const titleColophonBreakHtml = `<div data-type="page-break" contenteditable="false"></div>`;
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
<style>${titlePageGeometryCss(heightMm, frontMatterMeta)}</style>
</head>
<body>
<div class="manuscript-prose">
<div class="front-matter">
<div class="titlepage">
<div class="titlepage-top">${titleTopHtml}</div>
<div class="titlepage-bottom">${titleBottomHtml}</div>
</div>
${titleColophonBreakHtml}
${colophonHtml}
</div>
${tocHtml}
<div class="manuscript-body">${bodyHtml}</div>
</div>
${backCoverHtml}
</body>
</html>`;
}
