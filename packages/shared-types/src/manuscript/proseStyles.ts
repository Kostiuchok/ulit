// Shared CSS for rendering manuscript content — same rules used by the live
// TipTap editor and the read-only paginated preview (both via
// apps/web/components/manuscript/manuscriptProseStyles.tsx, which just wraps
// this string in a <style jsx global>) AND the server-side print-PDF render
// (T-2057, printHtml.ts, which embeds it in a plain <style> tag). One string,
// three consumers -- keeps the print PDF from visually drifting away from
// what the author sees while editing.
export const MANUSCRIPT_PROSE_CSS = `
      .manuscript-prose {
        outline: none; font-size: var(--ms-font-size, 1rem);
        /* WeasyPrint's own default (DejaVu Serif) was what actually printed
           -- despite the colophon's own static text unconditionally
           claiming "Гарнітура Times New Roman" (frontMatter.ts), nothing
           ever set font-family to make that true. True Times New Roman
           itself isn't freely redistributable/embeddable (Microsoft-
           licensed); "Liberation Serif" is the metric-compatible open
           equivalent already installed in the worker image and covers
           Cyrillic -- confirmed via fc-match 'Times New Roman:lang=uk' on
           the actual worker container, which already resolves to it through
           fontconfig's own substitution rules, so listing the real name
           first costs nothing and documents intent. Applies everywhere this
           stylesheet does (live editor, preview, print) -- one font across
           all of them is the same reasoning this file's header comment
           already gives for sharing the rest of the CSS. */
        font-family: "Times New Roman", "Liberation Serif", "Times", serif;
      }
      .manuscript-prose p { margin: 0 0 0.9em; }
      .manuscript-prose p[data-style="chapter"] {
        font-size: 1.5rem; font-weight: 700; text-align: center; text-transform: uppercase;
        letter-spacing: 0.03em; margin-top: 2.5em; margin-bottom: 1em;
      }
      .manuscript-prose p[data-style="section"] {
        font-size: 1.25rem; font-weight: 700; text-align: center; margin-top: 2em; margin-bottom: 1em;
      }
      .manuscript-prose p[data-style="heading"] { font-size: 1.05rem; font-weight: 700; margin-top: 1.2em; }
      .manuscript-prose p[data-style="subheading"] { font-size: 0.95rem; font-weight: 600; color: #444; }
      .manuscript-prose p[data-style="normal"] {
        font-size: var(--ms-font-size, 1rem); text-indent: 1.5em; text-align: justify;
      }
      .manuscript-prose p[data-style="epigraph"] {
        font-style: italic; text-align: right; margin-left: auto; max-width: 60%; color: #555;
      }
      .manuscript-prose p[data-style="quote"] {
        font-style: italic; border-left: 2px solid #ccc; padding-left: 1em; color: #444;
      }
      .manuscript-prose p[data-style="poem"] { text-align: center; white-space: pre-line; }
      .manuscript-prose p[data-style="signature"] { text-align: right; font-size: 0.9rem; color: #666; }

      .manuscript-prose div[data-type="page-break"] {
        position: relative; height: 0; margin: 1.5em 0; border-top: 1px dashed #9ca3af;
      }
      .manuscript-prose div[data-type="page-break"]::after {
        content: "Розрив сторінки"; position: absolute; top: -0.65em; left: 50%; transform: translateX(-50%);
        background: #fff; padding: 0 0.5em; font-size: 0.6875rem; color: #9ca3af; white-space: nowrap;
      }

      .manuscript-prose p[data-variant="toc-title"] {
        font-size: calc(var(--ms-font-size, 1rem) + 2pt); font-weight: 700;
        text-align: left; text-indent: 0; margin-bottom: 0.8em;
      }
      .manuscript-prose div[data-type="toc-entry"] {
        display: flex; align-items: baseline; margin: 0 0 0.5em;
        font-size: calc(var(--ms-font-size, 1rem) + 2pt);
        border-bottom: 1px dotted #ccc; padding-bottom: 0.15em;
      }
      .manuscript-prose div[data-type="toc-entry"][data-tier="0"] { font-weight: 700; margin-top: 1em; }
      .manuscript-prose div[data-type="toc-entry"][data-tier="1"] { font-weight: 600; margin-left: 1em; }
      .manuscript-prose div[data-type="toc-entry"][data-tier="2"] { margin-left: 2em; }
      .manuscript-prose div[data-type="toc-entry"][data-tier="3"] { margin-left: 3em; color: #444; }
      .manuscript-prose .toc-entry-text {
        /* No truncation -- a heading that doesn't fit on one line wraps onto
           as many as it needs (author feedback: ellipsis was hiding real
           title text). flex:1 1 auto still makes this item's BOX span the
           full row width minus the page-number sibling -- text just wraps
           inside that wide box instead of overflowing single-line, which is
           what keeps toc-entry-page flush against the right edge below
           regardless of how many lines the title takes. */
        flex: 1 1 auto;
        min-width: 0;
        text-align: left;
      }
      .manuscript-prose .toc-entry-page { flex: none; margin-left: 0.75em; text-align: right; }

      .manuscript-prose img { max-width: 100%; height: auto; display: block; }
      .manuscript-prose [data-resize-container] { max-width: 100%; }
      /* Bare <img>, not wrapped in a [data-resize-container] -- this is what
         generateHTML() (print PDF + pagination probe) renders, since it has
         no NodeView wrapper. Used to be scoped with the ">" direct-child
         combinator instead of :not(...) below, on the assumption a bare img
         is always a direct child of .manuscript-prose -- true for the live
         editor, but WRONG for the print PDF: buildManuscriptPrintHtml()
         (printHtml.ts) wraps the body in its own <div class="manuscript-body">
         (and front matter in <div class="front-matter">) for page-break
         scoping, so there a bare img is a GRANDCHILD, never a direct child.
         ">" silently matched nothing there -- every print-PDF image rendered
         with NO alignment margin/float at all (verified against a real
         render, author-reported: gap above an image but none below, since
         the only spacing left was the *previous* paragraph's own
         margin-bottom collapsing with the image's now-absent margin-top;
         the image's own intended top+bottom margin never applied on either
         side). :not() reaches through wrapper divs regardless of depth
         while still excluding the live editor's actually-wrapped image, so
         it fixes print without double-margining the live editor. */
      .manuscript-prose img[data-align="left"]:not([data-resize-container] img) { float: left; margin: 0.25em 1.5em 1em 0; max-width: 60%; }
      .manuscript-prose img[data-align="right"]:not([data-resize-container] img) { float: right; margin: 0.25em 0 1em 1.5em; max-width: 60%; }
      .manuscript-prose img[data-align="center"]:not([data-resize-container] img) { display: block; margin: 1em auto; }
      .manuscript-prose [data-resize-container]:has(img[data-align="left"]) {
        float: left; display: inline-flex; margin: 0.25em 1.5em 1em 0; max-width: 60%;
      }
      .manuscript-prose [data-resize-container]:has(img[data-align="right"]) {
        float: right; display: inline-flex; margin: 0.25em 0 1em 1.5em; max-width: 60%;
      }
      .manuscript-prose [data-resize-container]:has(img[data-align="center"]) {
        display: flex; justify-content: center; margin: 1em auto;
      }
      .manuscript-prose [data-resize-handle] {
        background: #fff; border: 1.5px solid #111827; border-radius: 2px; z-index: 20;
      }
      .manuscript-prose [data-resize-handle="left"],
      .manuscript-prose [data-resize-handle="right"] { width: 9px; cursor: ew-resize; }
      .manuscript-prose [data-resize-handle="top"],
      .manuscript-prose [data-resize-handle="bottom"] { height: 9px; cursor: ns-resize; }
      .manuscript-prose [data-resize-handle="top-left"],
      .manuscript-prose [data-resize-handle="bottom-right"] { width: 9px; height: 9px; cursor: nwse-resize; }
      .manuscript-prose [data-resize-handle="top-right"],
      .manuscript-prose [data-resize-handle="bottom-left"] { width: 9px; height: 9px; cursor: nesw-resize; }

      /* Front-matter-only presentational treatments (T-1962) -- a separate
         "variant" attribute from "style" so these never appear as pickable
         options in the author-facing "Стилі тексту" panel. Ridero-style
         title/colophon layout (docs/ulit-reference/SCREENSHOTS 86/87) --
         left-aligned throughout, none of data-style="normal"'s
         text-indent/justify (that's body-prose formatting, wrong for these
         standalone lines -- the original bug: author-name/year had no
         variant at all and inherited it, rendering visibly crooked). */
      .manuscript-prose p[data-variant="titlepage-author"] {
        text-align: center; text-indent: 0; font-size: 16pt; font-weight: 400; margin: 5em 0 0;
      }
      .manuscript-prose p[data-variant="titlepage-title"] {
        text-align: center; text-indent: 0; font-size: 24pt; font-weight: 700; margin: 0.3em 0 0; line-height: 1.3em;
      }
      /* Regular weight, plain black -- NOT the "medium"/gray originally
         specified in text; corrected against the Figma reference (node
         154:10, node-id=14-657) 2026-09-10, which shows this as plain
         Times New Roman Regular, same color as everything else on the
         page. Title (below) is the only bold line on the title page. */
      .manuscript-prose p[data-variant="titlepage-subtitle"] {
        text-align: center; text-indent: 0; font-size: 20pt; font-weight: 400; margin: 0.2em 0 0; line-height: 1.3em;
      }
      /* Two-line imprint block ("ULIT" / "Українська літера"), same size --
         own variant per line so printHtml.ts's title-page geometry can give
         each line its own book-trim-aware margin-top; here (live
         editor/preview, not print-geometry-aware) they just sit close
         together with a bigger gap pushing the pair down from the subtitle.
         Regular weight, not bold -- corrected against the Figma reference
         (node 154:11) 2026-09-10, same reasoning as titlepage-subtitle above. */
      .manuscript-prose p[data-variant="titlepage-imprint-line1"] {
        text-align: center; text-indent: 0; font-size: 16pt; font-weight: 400; margin: 10em 0 0; line-height: 1.2;
      }
      .manuscript-prose p[data-variant="titlepage-imprint-line2"] {
        text-align: center; text-indent: 0; font-size: 16pt; font-weight: 400; margin: 0; line-height: 1.2;
      }
      .manuscript-prose p[data-variant="titlepage-year"] {
        text-align: center; text-indent: 0; font-size: 14pt; font-weight: 400; margin: 2em 0 0;
      }
      .manuscript-prose p[data-variant="colophon-code"] {
        font-weight: 400; font-size: 0.8rem; text-align: left; text-indent: 0; margin: 0 0 0.15em;
      }
      .manuscript-prose p[data-variant="colophon-meta"] {
        font-style: normal; font-size: 0.8rem; color: #666; text-align: left; text-indent: 0; margin: 2em 0 0;
      }
      .manuscript-prose p[data-variant="colophon-author"] {
        font-weight: 700; font-size: 0.85rem; text-align: left; text-indent: 0; margin: 1.5em 0 0;
      }
      .manuscript-prose p[data-variant="colophon-biblio"] {
        font-size: 0.8rem; text-align: left; text-indent: -2.2em; padding-left: 2.2em; color: #222; margin: 0.5em 0 0;
      }
      .manuscript-prose p[data-variant="colophon-description"] {
        font-size: 0.8rem; text-align: left; text-indent: 0; color: #333; margin: 1em 0 0;
      }
      .manuscript-prose p[data-variant="colophon-code-bold"] {
        font-weight: 700; font-size: 0.85rem; text-align: right; text-indent: 0; margin: 1em 0 0;
      }
      .manuscript-prose p[data-variant="colophon-age"] {
        display: inline-block; min-width: 1.9em; padding: 0.15em 0.4em; border: 1px solid #333;
        border-radius: 999px; font-size: 0.8rem; font-weight: 700; text-align: center;
        text-indent: 0; margin: 1em 0 0;
      }
      .manuscript-prose p[data-variant="colophon-footer"] {
        text-align: right; font-size: 0.8rem; color: #555; margin: 8em 0 0; text-indent: 0;
      }

      /* Live A5 page-break overlay (T-1961) -- computed client-side from the
         editor's own DOM, distinct blue accent from the manually-inserted
         pageBreak node's gray marker above so authors don't confuse "this is
         where a page will end" (advisory) with "insert a break here" (a real
         document node). Purely decorative: pointer-events none, not part of
         the document flow. */
      .manuscript-page-break-marker {
        position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed #3b82f6; pointer-events: none;
      }
      .manuscript-page-break-marker::after {
        content: attr(data-label); position: absolute; top: -0.65em; left: 50%; transform: translateX(-50%);
        background: #fff; padding: 0 0.5em; font-size: 0.6875rem; color: #3b82f6; white-space: nowrap;
      }
`;
