import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { measureNodes, paginateNodes } from "./paginateManuscript";

const DEBOUNCE_MS = 1000;

/**
 * Live A5 page-break markers (T-1961) -- while the editor's "A5" toggle is
 * on, measures the *real* editor DOM (editor.view.dom's top-level children
 * are exactly the document's top-level nodes) and reuses the same
 * paginateNodes() the read-only preview trusts, so the advisory lines drawn
 * here always agree with where the preview will actually break. Debounced so
 * typing doesn't re-measure the whole document on every keystroke.
 */
export function useLivePageBreaks(editor: Editor | null, enabled: boolean, contentHeight: number): number[] {
  const [breaks, setBreaks] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !editor) {
      setBreaks([]);
      return;
    }

    function recompute() {
      if (!editor) return;
      const nodes = measureNodes(editor.view.dom as HTMLElement);
      const pages = paginateNodes(nodes, contentHeight - 1);
      // A line after the last page would just sit at the end of the
      // document with nothing to mark -- only the boundaries between pages.
      setBreaks(pages.slice(0, -1).map((p) => p.endY));
    }

    recompute();
    const handler = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(recompute, DEBOUNCE_MS);
    };
    editor.on("transaction", handler);

    // Dragging an image's resize handle (@tiptap/extension-image's built-in
    // ResizableNodeView) only fires a real ProseMirror transaction once, on
    // drag END (onCommit) -- while actively dragging it mutates the <img>'s
    // inline width/height style directly (onResize), which never dispatches
    // "transaction" at all. Without also watching for plain DOM size
    // changes, shrinking an image to make trailing text fit on the page left
    // this marker frozen at its PRE-resize position for the whole drag
    // (author-reported 2026-09-10: the line doesn't track the shrinking
    // content, only catching up once the drag ends and a real transaction
    // finally fires). ResizeObserver reacts to ANY box-size change of the
    // editor's content root regardless of cause, so it catches this
    // CSS-only resize the same way "transaction" catches a real edit --
    // routed through the same debounced handler, not a separate one.
    const resizeObserver = new ResizeObserver(handler);
    resizeObserver.observe(editor.view.dom as HTMLElement);

    return () => {
      editor.off("transaction", handler);
      resizeObserver.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, enabled, contentHeight]);

  return breaks;
}
