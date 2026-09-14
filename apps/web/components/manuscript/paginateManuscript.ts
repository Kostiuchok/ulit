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
  // Bottom edge of each visual LINE inside this node, relative to the
  // node's own top (so `node.top + lineBreakYs[i]` is an absolute
  // container-relative Y, same coordinate space as `top`/`height`) --
  // lets paginateNodes split flowing text mid-node instead of always
  // deferring the whole node (see its own comment for why). undefined for
  // node types that should never split (heading/epigraph/page-break --
  // policy exclusions, kept atomic on purpose even though they're
  // technically measurable the same way). An image naturally yields a
  // single one-element array (a replaced element has exactly one "line" =
  // its own box), which always fails the "does another line still fit"
  // check below and falls back to the old defer-whole behavior --
  // no separate isImage flag needed.
  lineBreakYs?: number[];
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

// Range.getClientRects() over an element's contents returns one rect per
// visual LINE BOX for wrapped inline/text content (a replaced element like
// <img> instead yields exactly one rect, its own box) -- this is the
// standard technique for finding where a browser actually wrapped text,
// used here so the live page-break estimate can split "mid-paragraph" the
// same way real flowing text does, instead of only ever moving a whole node
// down (see paginateNodes' own comment). Returned as bottom-edge offsets
// relative to the element's own top, ascending, deduped (adjacent rects
// occasionally share a boundary, e.g. across an inline mark's own tag).
function measureLineBottoms(element: HTMLElement): number[] {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rects = Array.from(range.getClientRects());
  const elementTop = element.getBoundingClientRect().top;
  const bottoms: number[] = [];
  for (const r of rects) {
    if (r.width === 0 && r.height === 0) continue; // collapsed range artifact (e.g. empty paragraph)
    const rel = r.bottom - elementTop;
    if (bottoms.length === 0 || rel - bottoms[bottoms.length - 1] > 0.5) {
      bottoms.push(rel);
    }
  }
  return bottoms;
}

export function measureNodes(container: HTMLElement): NodeMetric[] {
  return Array.from(container.children).map((el) => {
    const element = el as HTMLElement;
    const isPageBreak = element.getAttribute("data-type") === "page-break";
    const isHeading = HEADING_STYLES.has(element.getAttribute("data-style") ?? "");
    const isEpigraph = element.getAttribute("data-style") === "epigraph";
    return {
      top: element.offsetTop,
      height: element.offsetHeight,
      id: element.getAttribute("data-id"),
      html: element.outerHTML,
      isPageBreak,
      isHeading,
      isFloatedImage: floatAlignOf(element) !== null,
      isEpigraph,
      lineBreakYs: isPageBreak || isEpigraph || isHeading ? undefined : measureLineBottoms(element),
    };
  });
}

// Largest line-bottom (relative to the node's own top) that (a) is past
// whatever portion of the node was already placed on an earlier page
// (`consumedFromTop`) and (b) fits within the remaining `budget` -- or null
// if not even the next line fits. `lines` is ascending, so the first one
// that doesn't fit means nothing after it will either.
function findSplitLine(lines: number[], consumedFromTop: number, budget: number): number | null {
  let best: number | null = null;
  for (const L of lines) {
    if (L <= consumedFromTop + 0.5) continue;
    if (L - consumedFromTop <= budget) best = L;
    else break;
  }
  return best;
}

// Greedily groups measured top-level nodes into pages of at most
// `pageHeight` px, honoring a manual page-break node as a forced flush.
//
// A node that doesn't fully fit on the current page splits at the LAST
// LINE that still fits (findSplitLine, via lineBreakYs) and continues on
// the next page -- this is what real flowing body text does in the actual
// print PDF (WeasyPrint breaks a paragraph mid-line at the page boundary,
// it doesn't defer the whole paragraph); always deferring the whole node
// instead used to make this live estimate drift further from the real
// page count the longer the manuscript got, since every paragraph that
// almost-but-not-quite fit got pushed down whole. Only nodes WITHOUT line
// data (heading/epigraph/page-break -- excluded on purpose in
// measureNodes -- and images, which naturally yield one unsplittable
// "line") still defer whole, same as before.
//
// This remains a client-side APPROXIMATION, not byte-identical to
// WeasyPrint's own line-breaking (different text-layout engine -- see
// manuscriptLayout.ts's own comment) -- no orphan/widow control either
// (a split could in principle leave a single line alone at the bottom or
// top of a page; WeasyPrint's own default CSS orphans/widows:2 avoids
// that, this doesn't attempt to match it). Good enough to track the real
// page boundary far more closely than whole-node deferral did, not meant
// to be pixel-exact -- for that, use Передперегляд (the real rendered PDF).
export function paginateNodes(nodes: NodeMetric[], pageHeight: number): PageLeaf[] {
  if (nodes.length === 0) return [{ html: "", blockId: null, endY: 0 }];

  const pages: PageLeaf[] = [];
  let current: NodeMetric[] = [];
  let pageStartY = nodes[0].top;

  function flush(endYOverride?: number) {
    if (endYOverride === undefined && current.length === 0) return;
    const endY = endYOverride ?? current[current.length - 1].top + current[current.length - 1].height;
    pages.push({
      html: current.filter((n) => !n.isPageBreak).map((n) => n.html).join(""),
      blockId: current.find((n) => n.id)?.id ?? null,
      endY,
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

    // consumedFromTop tracks how much of THIS node was already placed on
    // an earlier page by a previous pass through this inner loop (only
    // nonzero for a node long enough to need more than one internal
    // split -- rare, but not impossible for a very long paragraph).
    // deferredOnce guards against looping forever on content that's
    // unsplittable AND still taller than one whole fresh page (e.g. a
    // single oversized image) -- after one "give it a fresh page anyway"
    // attempt, just place it and let it overflow, same as the original
    // algorithm did in that edge case.
    let consumedFromTop = 0;
    let firstPass = true;
    let deferredOnce = false;

    for (;;) {
      const remainingHeight = node.height - consumedFromTop;
      const budget = current.length > 0 ? pageHeight - (node.top + consumedFromTop - pageStartY) : pageHeight;

      if (remainingHeight <= budget) {
        current.push(node);
        break;
      }

      if (firstPass && precededByFloat) {
        current.push(node);
        break;
      }

      // Don't leave a heading alone as the last item on a page with the
      // content it introduces pushed to the next page -- carry the heading
      // forward so it lands together with what follows it.
      const last = current.length > 0 ? current[current.length - 1] : null;
      if (firstPass && last?.isHeading) {
        current.pop();
        flush();
        pageStartY = last.top;
        current.push(last);
        firstPass = false;
        continue;
      }

      const splitRel = node.lineBreakYs ? findSplitLine(node.lineBreakYs, consumedFromTop, budget) : null;
      if (splitRel !== null) {
        const splitY = node.top + splitRel;
        flush(splitY);
        pageStartY = splitY;
        consumedFromTop = splitRel;
        firstPass = false;
        continue;
      }

      if (!deferredOnce) {
        flush();
        pageStartY = node.top + consumedFromTop;
        deferredOnce = true;
        firstPass = false;
        continue;
      }

      // Nothing else to try -- place it and let it overflow.
      current.push(node);
      break;
    }
  }
  flush();

  return pages.length > 0 ? pages : [{ html: "", blockId: null, endY: 0 }];
}
