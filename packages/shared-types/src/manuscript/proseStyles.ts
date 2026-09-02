// Shared CSS for rendering manuscript content — same rules used by the live
// TipTap editor and the read-only paginated preview (both via
// apps/web/components/manuscript/manuscriptProseStyles.tsx, which just wraps
// this string in a <style jsx global>) AND the server-side print-PDF render
// (T-2057, printHtml.ts, which embeds it in a plain <style> tag). One string,
// three consumers -- keeps the print PDF from visually drifting away from
// what the author sees while editing.
export const MANUSCRIPT_PROSE_CSS = `
      .manuscript-prose { outline: none; font-size: var(--ms-font-size, 1rem); }
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
      .manuscript-prose p[data-style="normal"] { text-indent: 1.5em; text-align: justify; }
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
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto;
      }
      .manuscript-prose .toc-entry-page { flex: none; margin-left: 0.75em; }

      .manuscript-prose img { max-width: 100%; height: auto; display: block; }
      .manuscript-prose [data-resize-container] { max-width: 100%; }
      /* Bare <img> direct children only -- this is what generateHTML() (the
         pagination probe + read-only preview) renders, since it has no
         NodeView wrapper. Scoped with ">" so it never doubles up with the
         [data-resize-container] rules below, which target the live editor's
         wrapped image instead (nested, not a direct child). */
      .manuscript-prose > img[data-align="left"] { float: left; margin: 0.25em 1.5em 1em 0; max-width: 60%; }
      .manuscript-prose > img[data-align="right"] { float: right; margin: 0.25em 0 1em 1.5em; max-width: 60%; }
      .manuscript-prose > img[data-align="center"] { display: block; margin: 1em auto; }
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
        text-align: left; text-indent: 0; font-size: 0.95rem; margin: 5em 0 0;
      }
      .manuscript-prose p[data-variant="titlepage-title"] {
        text-align: left; text-indent: 0; font-size: 1.7rem; font-weight: 700; margin: 0.3em 0 0;
      }
      .manuscript-prose p[data-variant="titlepage-subtitle"] {
        text-align: left; text-indent: 0; font-size: 1.05rem; font-weight: 400; color: #444; margin: 0.2em 0 0;
      }
      .manuscript-prose p[data-variant="titlepage-imprint"] {
        text-align: left; font-size: 0.8rem; color: #888; margin: 1.5em 0 0; text-indent: 0;
      }
      .manuscript-prose p[data-variant="titlepage-year"] {
        text-align: left; text-indent: 0; font-size: 0.85rem; color: #333; margin: 22em 0 0;
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
