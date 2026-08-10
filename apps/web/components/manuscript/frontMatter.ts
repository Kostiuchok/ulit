import type { StyledBlockStyleName } from "./styledParagraph";

export interface FrontMatterMeta {
  title: string;
  subtitle?: string | null;
  authorName?: string | null;
  description?: string | null;
  ageRating?: string | null;
  isbn?: string | null;
  udcCode?: string | null;
  bbkCode?: string | null;
  authorSign?: string | null;
  pageCount?: number | null;
  createdAt?: string | null;
}

function styledParagraph(style: StyledBlockStyleName, text: string) {
  return {
    type: "paragraph",
    attrs: { style },
    content: text ? [{ type: "text", text }] : undefined,
  };
}

/**
 * Ridero-style title/copyright page — a block of styled paragraphs the author
 * can freely edit, followed by a horizontalRule. Everything above that rule
 * is treated as "page 2" (see docs/TASKS.md T-1953); how many nodes precede
 * the rule doesn't matter to the sentinel check in ManuscriptEditor.
 */
export function buildFrontMatterNodes(meta: FrontMatterMeta): any[] {
  const nodes: any[] = [];

  if (meta.authorName) nodes.push(styledParagraph("normal", meta.authorName));
  nodes.push(styledParagraph("heading", meta.title));
  if (meta.subtitle) nodes.push(styledParagraph("subheading", meta.subtitle));

  const catalogParts: string[] = [];
  if (meta.udcCode) catalogParts.push(`УДК ${meta.udcCode}`);
  if (meta.bbkCode) catalogParts.push(`ББК ${meta.bbkCode}`);
  if (meta.authorSign) catalogParts.push(meta.authorSign);
  if (catalogParts.length > 0) nodes.push(styledParagraph("normal", catalogParts.join("   ")));

  const year = meta.createdAt ? new Date(meta.createdAt).getFullYear() : new Date().getFullYear();
  const bibParts = [`${meta.title} : [б.м.] : Ulit, ${year}.`];
  if (meta.pageCount) bibParts.push(`– ${meta.pageCount} ст.`);
  if (meta.isbn) bibParts.push(`– ISBN ${meta.isbn}`);
  nodes.push(styledParagraph("normal", bibParts.join(" ")));

  if (meta.description) nodes.push(styledParagraph("normal", meta.description));
  if (meta.ageRating) nodes.push(styledParagraph("signature", meta.ageRating));

  nodes.push({ type: "horizontalRule" });
  return nodes;
}

/** True if front matter was already generated (and possibly edited) before. */
export function hasFrontMatter(doc: any): boolean {
  const content = doc?.content;
  if (!Array.isArray(content)) return false;
  return content.slice(0, 15).some((node) => node?.type === "horizontalRule");
}
