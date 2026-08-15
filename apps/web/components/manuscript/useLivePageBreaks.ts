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
    return () => {
      editor.off("transaction", handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, enabled, contentHeight]);

  return breaks;
}
