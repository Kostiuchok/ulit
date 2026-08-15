// Maps Pandoc's native JSON AST (`pandoc file.docx -t json`) to the TipTap/ProseMirror
// document JSON used by the manuscript editor (apps/web/components/manuscript).
//
// Deliberately NOT auto-detected (no reliable signal in a generic .docx): "chapter" (Розділ,
// above Глава), "epigraph", "poem", "signature". Those blocks import as "normal" — the author
// re-tags them manually via the style panel after import.

type PandocAttr = [string, string[], [string, string][]];

type PandocInline =
  | { t: "Str"; c: string }
  | { t: "Space" }
  | { t: "SoftBreak" }
  | { t: "LineBreak" }
  | { t: "Emph"; c: PandocInline[] }
  | { t: "Strong"; c: PandocInline[] }
  | { t: "Underline"; c: PandocInline[] }
  | { t: "Strikeout"; c: PandocInline[] }
  | { t: "Image"; c: [PandocAttr, PandocInline[], [string, string]] }
  | { t: string; c?: unknown };

type PandocBlock =
  | { t: "Header"; c: [number, unknown, PandocInline[]] }
  | { t: "Para"; c: PandocInline[] }
  | { t: "Plain"; c: PandocInline[] }
  | { t: "BlockQuote"; c: PandocBlock[] }
  | { t: "BulletList"; c: PandocBlock[][] }
  | { t: "OrderedList"; c: [unknown, PandocBlock[][]] }
  | { t: string; c?: unknown };

interface PandocDoc {
  blocks: PandocBlock[];
}

type EditorMark = { type: "bold" | "italic" | "underline" | "strike" };
type EditorText = { type: "text"; text: string; marks?: EditorMark[] };
type EditorNode = { type: string; attrs?: Record<string, unknown>; content?: EditorNode[] };

let blockIdCounter = 0;
function nextBlockId() {
  blockIdCounter += 1;
  return `b${Date.now().toString(36)}${blockIdCounter}`;
}

// Real per-image wrap-side from the raw docx XML (docxImageAlignment.ts),
// consumed in the same document order Pandoc itself produces Image inlines
// in. Reset alongside blockIdCounter at the start of pandocToEditorDoc();
// only ever non-empty when the caller already verified its length matches
// Pandoc's own image count (see pandocToEditorDoc below).
let imageAlignments: string[] = [];
let imageAlignmentCursor = 0;
function nextImageAlign(): string {
  const align = imageAlignments[imageAlignmentCursor] ?? "center";
  imageAlignmentCursor += 1;
  return align;
}

function mapInlines(inlines: PandocInline[], activeMarks: EditorMark[] = []): EditorText[] {
  const out: EditorText[] = [];
  for (const inline of inlines) {
    switch (inline.t) {
      case "Str":
        out.push({ text: (inline as any).c as string, type: "text", marks: activeMarks.length ? activeMarks : undefined });
        break;
      case "Space":
      case "SoftBreak":
        out.push({ type: "text", text: " ", marks: activeMarks.length ? activeMarks : undefined });
        break;
      case "LineBreak":
        out.push({ type: "text", text: "\n", marks: activeMarks.length ? activeMarks : undefined });
        break;
      case "Emph":
        out.push(...mapInlines((inline as any).c, [...activeMarks, { type: "italic" }]));
        break;
      case "Strong":
        out.push(...mapInlines((inline as any).c, [...activeMarks, { type: "bold" }]));
        break;
      case "Underline":
        out.push(...mapInlines((inline as any).c, [...activeMarks, { type: "underline" }]));
        break;
      case "Strikeout":
        out.push(...mapInlines((inline as any).c, [...activeMarks, { type: "strike" }]));
        break;
      case "Image":
        // Handled separately by splitInlinesAroundImages (below) -- an Image's
        // `c` is a 3-tuple ([Attr, altInlines, [src, title]]), not a plain
        // inline array, so recursing into it here (the old "unknown inline"
        // fallback did exactly that) produced garbage/dropped text instead of
        // an image. Skip it in plain text mapping.
        break;
      default:
        // Unknown inline (footnote, math, etc.) — recurse into its content if any, else skip.
        if (Array.isArray((inline as any).c)) {
          out.push(...mapInlines((inline as any).c, activeMarks));
        }
    }
  }
  return out;
}

// Word images always live at their own anchor point inside whatever
// paragraph contains them -- pandoc represents that as an Image inline
// mixed in with the paragraph's other inlines (usually the *only* inline,
// for a standalone figure). Our editor schema has no inline image node
// (ResizableImage is block-level, like the base @tiptap/extension-image
// default), so a paragraph containing an image must be split into: [text
// run] [image node] [text run] [image node] ... -- each text run rendered
// as its own "normal" paragraph, each image as its own top-level image node.
function splitInlinesAroundImages(inlines: PandocInline[], mediaMap: Record<string, string>): EditorNode[] {
  const nodes: EditorNode[] = [];
  let run: PandocInline[] = [];

  function flushRun() {
    if (run.length === 0) return;
    const text = mapInlines(run);
    if (text.some((t) => t.text.trim() !== "")) {
      nodes.push({ type: "paragraph", attrs: { style: "normal" }, content: text });
    }
    run = [];
  }

  for (const inline of inlines) {
    if (inline.t !== "Image") {
      run.push(inline);
      continue;
    }
    flushRun();
    const [, , target] = (inline as any).c as [PandocAttr, PandocInline[], [string, string]];
    const [rawSrc] = target;
    const src = mediaMap[rawSrc] ?? mediaMap[decodeURIComponent(rawSrc)];
    // Always consume one alignment slot here, whether or not this specific
    // image ends up with a resolved src -- the cursor must stay in lockstep
    // with the total Image-inline count the safety check in
    // pandocToEditorDoc() below counted, or every image after a dropped one
    // would silently read the wrong alignment.
    const align = nextImageAlign();
    if (src) {
      nodes.push({ type: "image", attrs: { src, align } });
    }
    // If the extracted file couldn't be matched/uploaded, the image is
    // silently dropped rather than left as a broken node -- same
    // best-effort spirit as the rest of this importer (author fixes up
    // anything the generic mapping couldn't handle).
  }
  flushRun();
  return nodes;
}

// Editor-side, the styled node is a `Paragraph` extension that kept the name "paragraph"
// (see apps/web/components/manuscript/styledParagraph.ts) — TipTap's schema has no node
// literally called "styledBlock", so the JSON emitted here must use "paragraph".
function styledBlock(style: string, inlines: PandocInline[]): EditorNode {
  const text = mapInlines(inlines);
  return {
    type: "paragraph",
    attrs: { style, id: nextBlockId() },
    content: text.length ? text : undefined,
  };
}

function headerStyle(level: number): string {
  if (level <= 1) return "section"; // Глава — most common top-level heading in a manuscript
  if (level === 2) return "heading"; // Заголовок
  return "subheading"; // Підзаголовок
}

// Returns 0+ nodes per Pandoc block -- a Para/Plain containing one or more
// images expands into multiple top-level nodes (see splitInlinesAroundImages
// above), everything else maps 1:1 same as before.
function mapBlock(block: PandocBlock, mediaMap: Record<string, string>): EditorNode[] {
  switch (block.t) {
    case "Header": {
      const [level, , inlines] = (block as any).c;
      return [styledBlock(headerStyle(level), inlines)];
    }
    case "Para":
    case "Plain":
      return splitInlinesAroundImages((block as any).c, mediaMap);
    case "BlockQuote": {
      const inner = ((block as any).c as PandocBlock[]).flatMap((b) => mapBlock(b, mediaMap));
      if (inner.length === 0) return [];
      // Flatten nested paragraphs into a single "quote" styled block; any
      // image split out of the quote's text keeps its own node instead of
      // being force-merged into the quote's text content.
      const textNodes = inner.filter((n) => n.type === "paragraph");
      const otherNodes = inner.filter((n) => n.type !== "paragraph");
      if (textNodes.length === 0) return otherNodes;
      const merged: EditorNode =
        textNodes.length === 1
          ? { ...textNodes[0], attrs: { ...textNodes[0].attrs, style: "quote" } }
          : { type: "paragraph", attrs: { style: "quote", id: nextBlockId() }, content: textNodes.flatMap((n) => n.content ?? []) };
      return [merged, ...otherNodes];
    }
    case "BulletList":
    case "OrderedList": {
      const itemsSource: PandocBlock[][] = block.t === "BulletList" ? (block as any).c : (block as any).c[1];
      const items: EditorNode[] = itemsSource.map((blocks) => ({
        type: "listItem",
        content: blocks.flatMap((b) => mapBlock(b, mediaMap)),
      }));
      return [{ type: block.t === "BulletList" ? "bulletList" : "orderedList", content: items }];
    }
    case "HorizontalRule":
      return [];
    default:
      return [];
  }
}

// Mirrors exactly which blocks/inlines splitInlinesAroundImages actually
// scans for Image inlines (top-level of Para/Plain, recursing the same way
// through BlockQuote/lists) -- must stay in lockstep with that traversal or
// the safety check below is comparing two different counts.
function countImageInlines(blocks: PandocBlock[]): number {
  let count = 0;
  for (const block of blocks) {
    switch (block.t) {
      case "Para":
      case "Plain":
        count += ((block as any).c as PandocInline[]).filter((i) => i.t === "Image").length;
        break;
      case "BlockQuote":
        count += countImageInlines((block as any).c as PandocBlock[]);
        break;
      case "BulletList":
        for (const item of (block as any).c as PandocBlock[][]) count += countImageInlines(item);
        break;
      case "OrderedList":
        for (const item of (block as any).c[1] as PandocBlock[][]) count += countImageInlines(item);
        break;
      default:
        break;
    }
  }
  return count;
}

export function pandocToEditorDoc(
  pandocJson: PandocDoc,
  mediaMap: Record<string, string> = {},
  wordImageAlignments: string[] = []
): EditorNode {
  blockIdCounter = 0;
  imageAlignmentCursor = 0;
  // Only trust the XML-derived alignments if the count matches exactly --
  // see docxImageAlignment.ts for why a mismatch is worse than the uniform
  // "center" default.
  imageAlignments = wordImageAlignments.length === countImageInlines(pandocJson.blocks) ? wordImageAlignments : [];
  const content = pandocJson.blocks.flatMap((b) => mapBlock(b, mediaMap));
  return {
    type: "doc",
    content: content.length ? content : [styledBlock("normal", [])],
  };
}
