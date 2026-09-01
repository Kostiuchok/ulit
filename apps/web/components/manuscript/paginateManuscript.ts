export interface PageLeaf {
  html: string;
  blockId: string | null;
  // Bottom edge (px, in probe/live coordinates) of this page's last node --
  // used by the live page-break overlay (T-1961) to draw its marker line at
  // the exact same boundary this function itself computed.
  endY: number;
}

const HEADING_STYLES = new Set(["chapter", "section", "heading", "subheading"]);

interface NodeMetric {
  top: number;
  height: number;
  id: string | null;
  html: string;
  isPageBreak: boolean;
  isHeading: boolean;
  isFloatedImage: boolean;
  // Ridero-style convention (T-1963 follow-up, Figma node 14:841): an
  // epigraph/dedication paragraph always gets a page to itself -- forced
  // page boundary both before and after it, regardless of surrounding
  // content's height, not just "when it doesn't fit".
  isEpigraph: boolean;
}

// Detects a left/right-aligned (text-wrapped) image node, whether it's a bare
// <img data-align="..."> (probe/preview HTML from generateHTML(), which has
// no NodeView wrapper) or the live editor's <div data-resize-container><img
// data-align="..."></div> -- both shapes are handled so this works for the
// live page-break overlay (T-1961) alike.
function floatAlignOf(element: HTMLElement): "left" | "right" | null {
  const img = element.matches("img") ? element : element.querySelector("img");
  const align = img?.getAttribute("data-align");
  return align === "left" || align === "right" ? align : null;
}

export function measureNodes(container: HTMLElement): NodeMetric[] {
  return Array.from(container.children).map((el) => {
    const element = el as HTMLElement;
    return {
      top: element.offsetTop,
      height: element.offsetHeight,
      id: element.getAttribute("data-id"),
      html: element.outerHTML,
      isPageBreak: element.getAttribute("data-type") === "page-break",
      isHeading: HEADING_STYLES.has(element.getAttribute("data-style") ?? ""),
      isFloatedImage: floatAlignOf(element) !== null,
      isEpigraph: element.getAttribute("data-style") === "epigraph",
    };
  });
}

// Pure, testable: greedily groups measured top-level nodes into pages of at
// most `pageHeight` px, honoring a manual page-break node as a forced flush.
// A paragraph's own text never splits across two pages here (whole node
// moves down if it doesn't fit) -- required so each page can be rendered as
// one self-contained HTMLFlipBook leaf instead of a shared scrolled column.
export function paginateNodes(nodes: NodeMetric[], pageHeight: number): PageLeaf[] {
  if (nodes.length === 0) return [{ html: "", blockId: null, endY: 0 }];

  const pages: PageLeaf[] = [];
  let current: NodeMetric[] = [];
  let pageStartY = nodes[0].top;

  function flush() {
    if (current.length === 0) return;
    const last = current[current.length - 1];
    pages.push({
      html: current.filter((n) => !n.isPageBreak).map((n) => n.html).join(""),
      blockId: current.find((n) => n.id)?.id ?? null,
      endY: last.top + last.height,
    });
    current = [];
  }

  for (const node of nodes) {
    if (node.isPageBreak) {
      flush();
      pageStartY = node.top + node.height;
      continue;
    }
    if (node.isEpigraph) {
      // Always its own page -- cut off whatever came before, place it alone,
      // then cut off again so the next node starts fresh too.
      flush();
      current.push(node);
      flush();
      pageStartY = node.top + node.height;
      continue;
    }
    // A left/right-aligned image's box overlaps the paragraph(s) that wrap
    // around it (CSS float takes it out of normal flow), so the very next
    // node's measured top/height can't be trusted to decide a break here --
    // simplest fix (T-1961.3): never split immediately after a floated
    // image, force the following node onto the same page as the image it
    // wraps around instead of risking the two landing on different pages.
    const precededByFloat = current.length > 0 && current[current.length - 1].isFloatedImage;
    const bottom = node.top + node.height;
    if (current.length > 0 && !precededByFloat && bottom - pageStartY > pageHeight) {
      // Don't leave a heading alone as the last item on a page with the
      // content it introduces pushed to the next page -- carry the heading
      // forward so it lands together with what follows it.
      const last = current[current.length - 1];
      if (last.isHeading) {
        current.pop();
        flush();
        pageStartY = last.top;
        current.push(last);
      } else {
        flush();
        pageStartY = node.top;
      }
    }
    current.push(node);
  }
  flush();

  return pages.length > 0 ? pages : [{ html: "", blockId: null, endY: 0 }];
}
