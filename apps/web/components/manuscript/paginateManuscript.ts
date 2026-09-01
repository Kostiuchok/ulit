import { generateHTML } from "@tiptap/core";
import { MANUSCRIPT_CORE_EXTENSIONS, extractOutline, splitFrontMatter, type OutlineItem } from "shared-types";
import { TocEntry } from "./tocEntry";

// Same core extension set as ManuscriptEditor.tsx and the server-side
// print-PDF render (T-2057, shared-types/manuscript/extensions.ts) --
// guarantees generateHTML() output matches the live editor's own rendering.
// TocEntry stays local: the auto-generated TOC only exists in this
// browser-side pagination probe, not the print render (out of scope,
// docs/T-2057-checklist.md section 2).
export const MANUSCRIPT_EXTENSIONS: any[] = [...MANUSCRIPT_CORE_EXTENSIONS, TocEntry];

export interface PageLeaf {
  html: string;
  blockId: string | null;
  // Bottom edge (px, in probe/live coordinates) of this page's last node --
  // used by the live A5 page-break overlay (T-1961) to draw its marker line
  // at the exact same boundary this function itself computed.
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
// pagination probe and the live A5 page-break overlay (T-1961) alike.
function floatAlignOf(element: HTMLElement): "left" | "right" | null {
  const img = element.matches("img") ? element : element.querySelector("img");
  const align = img?.getAttribute("data-align");
  return align === "left" || align === "right" ? align : null;
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph", attrs: { style: "normal" } }] };

// Images may not carry explicit width/height in the saved doc (author never
// resized them) -- preload to learn natural size and inject a display size
// capped at the page content width, so the probe layout below is accurate
// on the first pass instead of jumping after an async image load.
async function resolveImageDimensions(doc: any, maxWidth: number): Promise<any> {
  const cache = new Map<string, { w: number; h: number }>();

  async function loadDim(src: string): Promise<{ w: number; h: number }> {
    const cached = cache.get(src);
    if (cached) return cached;
    const dim = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ w: img.naturalWidth || maxWidth, h: img.naturalHeight || maxWidth });
      img.onerror = () => resolve({ w: maxWidth, h: maxWidth });
      img.src = src;
    });
    cache.set(src, dim);
    return dim;
  }

  async function walk(node: any): Promise<any> {
    if (!node || typeof node !== "object") return node;
    if (node.type === "image" && node.attrs?.src && (!node.attrs.width || !node.attrs.height)) {
      const dim = await loadDim(node.attrs.src as string);
      const displayW = Math.min(dim.w, maxWidth);
      const displayH = dim.w > 0 ? Math.round((dim.h * displayW) / dim.w) : displayW;
      return { ...node, attrs: { ...node.attrs, width: node.attrs.width ?? displayW, height: node.attrs.height ?? displayH } };
    }
    if (Array.isArray(node.content)) {
      const content = await Promise.all(node.content.map((child: any) => walk(child)));
      return { ...node, content };
    }
    return node;
  }

  return walk(doc);
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

export async function paginateManuscript(
  content: any,
  contentWidth: number,
  contentHeight: number,
  fontSizePx?: number
): Promise<PageLeaf[]> {
  const doc = content ?? EMPTY_DOC;
  const resolvedDoc = await resolveImageDimensions(doc, contentWidth);
  const html = generateHTML(resolvedDoc, MANUSCRIPT_EXTENSIONS);

  const probe = document.createElement("div");
  probe.className = "manuscript-prose";
  probe.style.position = "fixed";
  probe.style.left = "-99999px";
  probe.style.top = "0";
  probe.style.width = `${contentWidth}px`;
  probe.style.height = "auto";
  probe.style.visibility = "hidden";
  // Must match the font-size the leaf is actually rendered at (see
  // --ms-font-size in manuscriptProseStyles.tsx) -- measuring at a different
  // size than the real render undercounts/overcounts height and causes text
  // to clip at the bottom of a page.
  if (fontSizePx) probe.style.setProperty("--ms-font-size", `${fontSizePx}px`);
  probe.innerHTML = html;
  document.body.appendChild(probe);
  const nodes = measureNodes(probe);
  document.body.removeChild(probe);

  // 1px safety margin: browsers can round a wrapped line's height up by a
  // sub-pixel amount between the probe measurement and the real leaf render,
  // which previously accumulated across a page's paragraphs and clipped the
  // last line of text at the bottom.
  return paginateNodes(nodes, contentHeight - 1);
}

function findPageIndexOfId(pages: PageLeaf[], id: string): number | null {
  const idx = pages.findIndex((p) => p.html.includes(`data-id="${id}"`));
  return idx === -1 ? null : idx;
}

function buildTocContent(outline: OutlineItem[], pageOf: (id: string) => number | null): any[] {
  return [
    { type: "paragraph", attrs: { style: "normal", variant: "toc-title" }, content: [{ type: "text", text: "Зміст" }] },
    ...outline.map((item) => ({
      type: "tocEntry",
      attrs: { text: item.text, page: pageOf(item.id), tier: item.tier },
    })),
  ];
}

// Same as paginateManuscript(), but auto-generates a "Зміст" page (or pages)
// right after front matter from the document's own Розділ/Глава/Заголовок/
// Підзаголовок headings, with real page numbers, forcing the body to start
// on a fresh page after it. The TOC itself is never persisted to
// manuscriptContent -- rebuilt fresh on every pagination pass here, so it
// can never go stale as the author edits.
export async function paginateManuscriptWithToc(
  content: any,
  contentWidth: number,
  contentHeight: number,
  fontSizePx?: number
): Promise<PageLeaf[]> {
  const doc = content ?? EMPTY_DOC;
  const allContent: any[] = doc.content ?? [];
  const { front, body } = splitFrontMatter(allContent);
  const outline = extractOutline(body);

  if (outline.length === 0) {
    return paginateManuscript(doc, contentWidth, contentHeight, fontSizePx);
  }

  // The TOC must land on its own page(s), sharing with nothing else -- not
  // the tail of front matter, not the body. Force a break right after front
  // matter too (not just after the TOC), and fold that into Pass 1 itself so
  // basePageOfId() already reflects it (front matter's colophon might not
  // naturally end exactly at a page boundary otherwise, which would throw
  // off every subsequent page number by one).
  const frontWithBreak = front.length > 0 ? [...front, { type: "pageBreak" }] : front;

  // Pass 1: paginate front matter + body (with the break above, no TOC yet)
  // to learn which page each heading lands on -- only the TOC's own (not
  // yet known) page count still needs adding on top of this.
  const basePages = await paginateManuscript(
    { type: "doc", content: [...frontWithBreak, ...body] },
    contentWidth,
    contentHeight,
    fontSizePx
  );
  const basePageOfId = (id: string) => {
    const idx = findPageIndexOfId(basePages, id);
    return idx === null ? null : idx + 1;
  };

  // Pass 2: converge on how many pages the TOC itself takes. Inserting it
  // shifts every heading's printed number by exactly that count, and the
  // count can itself change once those (now shifted, possibly wider) numbers
  // are typeset into the TOC -- so iterate instead of assuming one page.
  let tocPageCount = 1;
  let tocContent = buildTocContent(outline, (id) => {
    const base = basePageOfId(id);
    return base === null ? null : base + tocPageCount;
  });
  for (let i = 0; i < 4; i++) {
    const tocPages = await paginateManuscript(
      { type: "doc", content: tocContent },
      contentWidth,
      contentHeight,
      fontSizePx
    );
    if (tocPages.length === tocPageCount) break;
    tocPageCount = tocPages.length;
    tocContent = buildTocContent(outline, (id) => {
      const base = basePageOfId(id);
      return base === null ? null : base + tocPageCount;
    });
  }

  const combinedDoc = {
    type: "doc",
    content: [...frontWithBreak, ...tocContent, { type: "pageBreak" }, ...body],
  };
  return paginateManuscript(combinedDoc, contentWidth, contentHeight, fontSizePx);
}
