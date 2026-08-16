import { useEffect, useState } from "react";
import { paginateManuscriptWithToc, type PageLeaf } from "./paginateManuscript";

interface Result {
  pages: PageLeaf[] | null;
  loading: boolean;
}

// Runs the (one-shot, browser-measured) pagination once per manuscript load
// -- manuscriptContent is a stable object reference once the preview route
// has finished polling for status "DONE" (see manuscript/preview/page.tsx),
// so this effect fires once per mount, not per keystroke.
export function useManuscriptPagination(
  content: any,
  contentWidth: number,
  contentHeight: number,
  fontSizePx?: number
): Result {
  const [pages, setPages] = useState<PageLeaf[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPages(null);
    paginateManuscriptWithToc(content, contentWidth, contentHeight, fontSizePx).then((result) => {
      if (!cancelled) setPages(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, contentWidth, contentHeight, fontSizePx]);

  return { pages, loading: pages === null };
}
