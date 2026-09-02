import type { StyledBlockStyleName } from "./styledParagraph";

export interface FrontMatterMeta {
  title: string;
  subtitle?: string | null;
  // Two orderings, built by the caller from structured Book.bookAuthors
  // (lastName/firstName) -- title page uses given-name-first (Ridero
  // reference), the colophon uses surname-first (bibliographic cataloguing
  // convention). Deliberately not derived here from one flat string: that
  // can't be reordered reliably (which word is the surname?), only a caller
  // with the structured fields can build both correctly.
  authorNameDisplay?: string | null;
  authorNameCatalog?: string | null;
  description?: string | null;
  ageRating?: string | null;
  isbn?: string | null;
  udcCode?: string | null;
  // No bbkCode -- ББК officially discontinued for Ukrainian publishers
  // (Cabinet of Ministers resolution, March 2017, mandatory switch to УДК).
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
 * Ridero-style title + colophon pages, generated fresh at print-render time
 * from live Book fields (Вихідні дані) -- NOT persisted into
 * Book.manuscriptContent and not author-editable. Previously these were
 * inserted once into the editable manuscript on first open (T-1953/T-1962),
 * which meant ISBN/УДК/anotation baked in at that moment never updated
 * again; this generator is now called fresh on every print-PDF render
 * instead (see printHtml.ts), so it always reflects the current book data.
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
  if (meta.authorNameDisplay) nodes.push(styledParagraph("normal", meta.authorNameDisplay, "titlepage-author"));
  nodes.push(styledParagraph("heading", meta.title, "titlepage-title"));
  if (meta.subtitle) nodes.push(styledParagraph("subheading", meta.subtitle, "titlepage-subtitle"));
  nodes.push(styledParagraph("normal", "Видано на платформі Ulit", "titlepage-imprint"));
  nodes.push(styledParagraph("normal", String(year), "titlepage-year"));

  nodes.push({ type: "pageBreak" });

  // --- Page 2: colophon (Ridero-style випускні дані) -- catalog codes
  // stacked top-left, typesetting note, bold author byline (surname-first),
  // hanging-indent bibliographic line (author-sign as the hanging label),
  // annotation, bold catalog-code repeat, age-rating badge, copyright
  // pinned toward the bottom. ---
  const authorCatalog = meta.authorNameCatalog ?? meta.authorNameDisplay;

  if (meta.udcCode) nodes.push(styledParagraph("normal", `УДК ${meta.udcCode}`, "colophon-code"));
  if (meta.authorSign) nodes.push(styledParagraph("normal", meta.authorSign, "colophon-code"));

  nodes.push(styledParagraph("normal", "Комп'ютерна верстка. Гарнітура Times New Roman.", "colophon-meta"));

  if (authorCatalog) nodes.push(styledParagraph("normal", authorCatalog, "colophon-author"));

  const bibLabel = meta.authorSign ? `${meta.authorSign} ` : "";
  const bibParts = [
    `${meta.title}${meta.authorNameDisplay ? ` / ${meta.authorNameDisplay}` : ""}. — [б.м.] : Ulit, ${year}.`,
  ];
  if (meta.pageCount) bibParts.push(`— ${meta.pageCount} с.`);
  if (meta.isbn) bibParts.push(`— ISBN ${meta.isbn}`);
  nodes.push(styledParagraph("normal", `${bibLabel}${bibParts.join(" ")}`, "colophon-biblio"));

  if (meta.description) nodes.push(styledParagraph("normal", meta.description, "colophon-description"));

  if (meta.udcCode) nodes.push(styledParagraph("normal", `УДК ${meta.udcCode}`, "colophon-code-bold"));

  if (meta.ageRating) nodes.push(styledParagraph("normal", meta.ageRating, "colophon-age"));

  nodes.push(styledParagraph("normal", `© ${authorCatalog ?? "Автор"}, ${year}`, "colophon-footer"));

  nodes.push({ type: "horizontalRule" });
  return nodes;
}
