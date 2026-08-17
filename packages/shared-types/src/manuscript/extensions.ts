import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { StyledParagraph } from "./styledParagraph";
import { ResizableImage } from "./resizableImage";
import { PageBreak } from "./pageBreak";

// The core node/mark set shared by every generateHTML() caller that needs to
// reproduce the manuscript editor's own output exactly: the browser-side
// pagination probe (apps/web/components/manuscript/paginateManuscript.ts,
// which appends its own local TocEntry on top of this) and the server-side
// print-PDF render (T-2057, printHtml.ts). Deliberately does NOT include
// TocEntry -- the print render has no auto-generated TOC (out of scope,
// docs/T-2057-checklist.md section 2) and doesn't need it.
export const MANUSCRIPT_CORE_EXTENSIONS: any[] = [
  StarterKit.configure({ paragraph: false }),
  TextAlign.configure({ types: ["paragraph"] }),
  StyledParagraph,
  ResizableImage,
  PageBreak,
];

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph", attrs: { style: "normal" } }] };

// Serializes a TipTap JSON doc to HTML using the exact same node schema the
// live editor and browser pagination probe use -- single source of truth so
// the print PDF can never visually drift from what the author actually
// built. Pure/DOM-free (generateHTML() only walks the JSON + schema), safe
// to call from the print-PDF worker (Node, no browser).
export function manuscriptContentToHtml(content: any): string {
  return generateHTML(content ?? EMPTY_DOC, MANUSCRIPT_CORE_EXTENSIONS);
}
