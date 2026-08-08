// Maps Pandoc's native JSON AST (`pandoc file.docx -t json`) to the TipTap/ProseMirror
// document JSON used by the manuscript editor (apps/web/components/manuscript).
//
// Deliberately NOT auto-detected (no reliable signal in a generic .docx): "chapter" (Розділ,
// above Глава), "epigraph", "poem", "signature". Those blocks import as "normal" — the author
// re-tags them manually via the style panel after import.

type PandocInline =
  | { t: "Str"; c: string }
  | { t: "Space" }
  | { t: "SoftBreak" }
  | { t: "LineBreak" }
  | { t: "Emph"; c: PandocInline[] }
  | { t: "Strong"; c: PandocInline[] }
  | { t: "Underline"; c: PandocInline[] }
  | { t: "Strikeout"; c: PandocInline[] }
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
      default:
        // Unknown inline (footnote, math, etc.) — recurse into its content if any, else skip.
        if (Array.isArray((inline as any).c)) {
          out.push(...mapInlines((inline as any).c, activeMarks));
        }
    }
  }
  return out;
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

function mapBlock(block: PandocBlock): EditorNode | null {
  switch (block.t) {
    case "Header": {
      const [level, , inlines] = (block as any).c;
      return styledBlock(headerStyle(level), inlines);
    }
    case "Para":
    case "Plain":
      return styledBlock("normal", (block as any).c);
    case "BlockQuote": {
      const inner = ((block as any).c as PandocBlock[]).map(mapBlock).filter(Boolean) as EditorNode[];
      // Flatten nested blocks into a single "quote" styled block per paragraph.
      return inner.length === 1 ? { ...inner[0], attrs: { ...inner[0].attrs, style: "quote" } } : {
        type: "styledBlock",
        attrs: { style: "quote", id: nextBlockId() },
        content: inner.flatMap((n) => n.content ?? []),
      };
    }
    case "BulletList":
    case "OrderedList": {
      const itemsSource: PandocBlock[][] = block.t === "BulletList" ? (block as any).c : (block as any).c[1];
      const items: EditorNode[] = itemsSource.map((blocks) => ({
        type: "listItem",
        content: blocks.map(mapBlock).filter(Boolean) as EditorNode[],
      }));
      return { type: block.t === "BulletList" ? "bulletList" : "orderedList", content: items };
    }
    case "HorizontalRule":
      return null;
    default:
      return null;
  }
}

export function pandocToEditorDoc(pandocJson: PandocDoc): EditorNode {
  blockIdCounter = 0;
  const content = pandocJson.blocks.map(mapBlock).filter((n): n is EditorNode => n !== null);
  return {
    type: "doc",
    content: content.length ? content : [styledBlock("normal", [])],
  };
}
