import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { StyledParagraph } from "./styledParagraph";
import { ResizableImage } from "./resizableImage";
import { PageBreak } from "./pageBreak";

// Same extension set as ManuscriptEditor.tsx / ManuscriptPagePreview.tsx --
// guarantees generateHTML() output matches the live editor's own rendering.
export const MANUSCRIPT_EXTENSIONS: any[] = [
  StarterKit.configure({ paragraph: false }),
  TextAlign.configure({ types: ["paragraph"] }),
  StyledParagraph,
  ResizableImage,
  PageBreak,
];

export interface PageLeaf {
  html: string;
  blockId: string | null;
}

interface NodeMetric {
  top: number;
  height: number;
  id: string | null;
  html: string;
  isPageBreak: boolean;
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

function measureNodes(container: HTMLElement): NodeMetric[] {
  return Array.from(container.children).map((el) => {
    const element = el as HTMLElement;
    return {
      top: element.offsetTop,
      height: element.offsetHeight,
      id: element.getAttribute("data-id"),
      html: element.outerHTML,
      isPageBreak: element.getAttribute("data-type") === "page-break",
    };
  });
}

// Pure, testable: greedily groups measured top-level nodes into pages of at
// most `pageHeight` px, honoring a manual page-break node as a forced flush.
// A paragraph's own text never splits across two pages here (whole node
// moves down if it doesn't fit) -- required so each page can be rendered as
// one self-contained HTMLFlipBook leaf instead of a shared scrolled column.
export function paginateNodes(nodes: NodeMetric[], pageHeight: number): PageLeaf[] {
  if (nodes.length === 0) return [{ html: "", blockId: null }];

  const pages: PageLeaf[] = [];
  let current: NodeMetric[] = [];
  let pageStartY = nodes[0].top;

  function flush() {
    if (current.length === 0) return;
    pages.push({
      html: current.filter((n) => !n.isPageBreak).map((n) => n.html).join(""),
      blockId: current.find((n) => n.id)?.id ?? null,
    });
    current = [];
  }

  for (const node of nodes) {
    if (node.isPageBreak) {
      flush();
      pageStartY = node.top + node.height;
      continue;
    }
    const bottom = node.top + node.height;
    if (current.length > 0 && bottom - pageStartY > pageHeight) {
      flush();
      pageStartY = node.top;
    }
    current.push(node);
  }
  flush();

  return pages.length > 0 ? pages : [{ html: "", blockId: null }];
}

export async function paginateManuscript(content: any, contentWidth: number, contentHeight: number): Promise<PageLeaf[]> {
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
  probe.innerHTML = html;
  document.body.appendChild(probe);
  const nodes = measureNodes(probe);
  document.body.removeChild(probe);

  return paginateNodes(nodes, contentHeight);
}
