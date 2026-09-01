import { OUTLINE_TIERS, type StyledBlockStyleName } from "./styledParagraph";

export interface OutlineItem {
  id: string;
  text: string;
  tier: number;
}

function textContentOf(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (Array.isArray(node.content)) return node.content.map(textContentOf).join("");
  return "";
}

// Walks a TipTap JSON doc/node array and extracts every heading-tier
// paragraph (Розділ/Глава/Заголовок/Підзаголовок, OUTLINE_TIERS) that has a
// stable id -- single source of truth for "what does this manuscript's Зміст
// look like", shared by the browser-side pagination preview
// (paginateManuscript.ts) and the server-side print-PDF Зміст (printHtml.ts)
// so the two can never drift on which headings count as ToC entries.
export function extractOutline(nodes: any[]): OutlineItem[] {
  const items: OutlineItem[] = [];
  function walk(node: any) {
    if (!node || typeof node !== "object") return;
    if (node.type === "paragraph") {
      const style = node.attrs?.style as StyledBlockStyleName | undefined;
      const tierIdx = style ? OUTLINE_TIERS.indexOf(style) : -1;
      if (tierIdx !== -1) {
        const text = textContentOf(node).trim();
        // No id yet (content saved before StyledParagraph's id-backfill
        // plugin last ran) -- can't reliably reference it, so skip rather
        // than link the wrong entry.
        if (text && node.attrs?.id) items.push({ id: node.attrs.id, text, tier: tierIdx });
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  nodes.forEach(walk);
  return items;
}
