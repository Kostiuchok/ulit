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

  // --- Page 1: title page -- author, title, subtitle, publisher imprint,
  // year -- left-aligned, no paragraph indent/justify (that's body-prose
  // styling, wrong for a handful of standalone title-page lines; each gets
  // its own "titlepage-*" variant in proseStyles.ts so it never inherits
  // data-style="normal"'s text-indent/justify by accident). Author/year get
  // a large margin-top push each, matching the Ridero reference's rhythm
  // (name near the top third, title bold below it, big gap, year near the
  // bottom) -- CSS Paged Media can't flex/absolute-position "bottom of this
  // specific page" across a fragmented div, so this is a tuned approximation
  // for the common print formats, not pixel-exact for every trim size.
  if (meta.authorName) nodes.push(styledParagraph("normal", meta.authorName, "titlepage-author"));
  nodes.push(styledParagraph("heading", meta.title, "titlepage-title"));
  if (meta.subtitle) nodes.push(styledParagraph("subheading", meta.subtitle, "titlepage-subtitle"));
  nodes.push(styledParagraph("normal", "Видано на платформі Ulit", "titlepage-imprint"));
  nodes.push(styledParagraph("normal", String(year), "titlepage-year"));

  nodes.push({ type: "pageBreak" });

  // --- Page 2: colophon (Ridero-style випускні дані) -- catalog codes
  // stacked top-left, typesetting note, bold author byline, hanging-indent
  // bibliographic line (author-sign as the hanging label), annotation, bold
  // catalog-code repeat, age-rating badge, ISBN + copyright footer pinned
  // toward the bottom. ---
  if (meta.udcCode) nodes.push(styledParagraph("normal", `УДК ${meta.udcCode}`, "colophon-code"));
  if (meta.bbkCode) nodes.push(styledParagraph("normal", `ББК ${meta.bbkCode}`, "colophon-code"));
  if (meta.authorSign) nodes.push(styledParagraph("normal", meta.authorSign, "colophon-code"));

  nodes.push(styledParagraph("normal", "Комп'ютерна верстка. Гарнітура Times New Roman.", "colophon-meta"));

  if (meta.authorName) nodes.push(styledParagraph("normal", meta.authorName, "colophon-author"));

  const bibLabel = meta.authorSign ? `${meta.authorSign} ` : "";
  const bibParts = [`${meta.title}${meta.authorName ? ` / ${meta.authorName}` : ""}. — [б.м.] : Ulit, ${year}.`];
  if (meta.pageCount) bibParts.push(`— ${meta.pageCount} с.`);
  if (meta.isbn) bibParts.push(`— ISBN ${meta.isbn}`);
  nodes.push(styledParagraph("normal", `${bibLabel}${bibParts.join(" ")}`, "colophon-biblio"));

  if (meta.description) nodes.push(styledParagraph("normal", meta.description, "colophon-description"));

  const codeRepeat = [meta.udcCode && `УДК ${meta.udcCode}`, meta.bbkCode && `ББК ${meta.bbkCode}`].filter(Boolean);
  if (codeRepeat.length > 0) nodes.push(styledParagraph("normal", codeRepeat.join("   "), "colophon-code-bold"));

  if (meta.ageRating) nodes.push(styledParagraph("normal", meta.ageRating, "colophon-age"));

  nodes.push(styledParagraph("normal", `© ${meta.authorName ?? "Автор"}, ${year}`, "colophon-footer"));

  nodes.push({ type: "horizontalRule" });
  return nodes;
}

/** True if front matter was already generated (and possibly edited) before. */
export function hasFrontMatter(doc: any): boolean {
  const content = doc?.content;
  if (!Array.isArray(content)) return false;
  return content.slice(0, 15).some((node) => node?.type === "horizontalRule");
}
