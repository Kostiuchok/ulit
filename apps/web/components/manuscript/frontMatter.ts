import type { StyledBlockStyleName } from "shared-types";

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

function styledParagraph(style: StyledBlockStyleName, text: string, variant?: string) {
  return {
    type: "paragraph",
    attrs: { style, variant: variant ?? null },
    content: text ? [{ type: "text", text }] : undefined,
  };
}

/**
 * Ridero-style title + colophon pages — two blocks of styled paragraphs the
 * author can freely edit, separated by a forced pageBreak (T-1962) and
 * followed by a horizontalRule. Everything above that rule is treated as
 * "front matter" (see docs/TASKS.md T-1953/T-1962); how many nodes precede
 * the rule doesn't matter to the sentinel check in ManuscriptEditor, only
 * that it stays within the first 15 nodes it scans.
 */
export function buildFrontMatterNodes(meta: FrontMatterMeta): any[] {
  const nodes: any[] = [];
  const year = meta.createdAt ? new Date(meta.createdAt).getFullYear() : new Date().getFullYear();

  // --- Page 1: title page -- author, title, subtitle, publisher imprint ---
  if (meta.authorName) nodes.push(styledParagraph("normal", meta.authorName));
  nodes.push(styledParagraph("heading", meta.title));
  if (meta.subtitle) nodes.push(styledParagraph("subheading", meta.subtitle));
  nodes.push(styledParagraph("normal", "Видано на платформі Ulit", "titlepage-imprint"));
  nodes.push(styledParagraph("normal", String(year)));

  nodes.push({ type: "pageBreak" });

  // --- Page 2: colophon -- catalog codes, typesetting note, bibliographic
  // line, annotation, age rating, ISBN + copyright footer ---
  const catalogParts: string[] = [];
  if (meta.udcCode) catalogParts.push(`УДК ${meta.udcCode}`);
  if (meta.bbkCode) catalogParts.push(`ББК ${meta.bbkCode}`);
  if (meta.authorSign) catalogParts.push(meta.authorSign);
  if (catalogParts.length > 0) nodes.push(styledParagraph("normal", catalogParts.join("   "), "colophon-code"));

  nodes.push(styledParagraph("normal", "Комп'ютерна верстка. Гарнітура Times New Roman.", "colophon-meta"));

  const bibParts = [`${meta.title} : [б.м.] : Ulit, ${year}.`];
  if (meta.pageCount) bibParts.push(`– ${meta.pageCount} ст.`);
  if (meta.isbn) bibParts.push(`– ISBN ${meta.isbn}`);
  nodes.push(styledParagraph("normal", bibParts.join(" ")));

  if (meta.description) nodes.push(styledParagraph("normal", meta.description));

  const ageCodeParts: string[] = [];
  if (meta.udcCode || meta.bbkCode) {
    ageCodeParts.push([meta.udcCode && `УДК ${meta.udcCode}`, meta.bbkCode && `ББК ${meta.bbkCode}`].filter(Boolean).join(" "));
  }
  if (meta.ageRating) ageCodeParts.push(meta.ageRating);
  if (ageCodeParts.length > 0) nodes.push(styledParagraph("normal", ageCodeParts.join("   "), "colophon-code"));

  const footerParts: string[] = [];
  if (meta.isbn) footerParts.push(`ISBN ${meta.isbn}`);
  footerParts.push(`© ${meta.authorName ?? "Автор"}, ${year}`);
  nodes.push(styledParagraph("normal", footerParts.join("   "), "colophon-footer"));

  nodes.push({ type: "horizontalRule" });
  return nodes;
}

/** True if front matter was already generated (and possibly edited) before. */
export function hasFrontMatter(doc: any): boolean {
  const content = doc?.content;
  if (!Array.isArray(content)) return false;
  return content.slice(0, 15).some((node) => node?.type === "horizontalRule");
}
