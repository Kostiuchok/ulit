// Shared CSS for rendering manuscript content — used by both the live
// TipTap editor (ManuscriptEditor.tsx) and the read-only paginated preview
// (ManuscriptPagePreview.tsx), so the preview stays pixel-identical to what
// the author actually built instead of risking a second, drifting renderer.
export function ManuscriptProseStyles() {
  return (
    <style jsx global>{`
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

      .manuscript-prose img { max-width: 100%; height: auto; display: block; }
      .manuscript-prose [data-resize-container] { max-width: 100%; }
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
    `}</style>
  );
}
