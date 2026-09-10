import type { StyledBlockStyleName } from "./styledParagraph";

export interface FrontMatterMeta {
  title: string;
  subtitle?: string | null;
  // The account's own "Ім'я автора" (Особисті дані, Псевдонім) -- shown on
  // the title page only. Deliberately separate from authorNameDisplay below:
  // that one is the LEGAL name (Book.bookAuthors, needed for the colophon's
  // ISBN/УДК bibliographic entries and Книжкова палата deposit-copy
  // registration), which readers never need to see and often isn't the name
  // the author publishes under. The title page is reader-facing, same as the
  // cover -- both show the pen name (author feedback: showing the legal name
  // there read as a mistake, not a formality).
  authorPenName?: string | null;
  // Two orderings, built by the caller from structured Book.bookAuthors
  // (lastName/firstName) -- colophon-only now (see authorPenName above for
  // the title page). Catalog uses surname-first (bibliographic cataloguing
  // convention), display uses given-name-first (the bibliographic citation
  // line, "Title / Author. -- [s.l.]: Ulit, year."). Deliberately not
  // derived here from one flat string: that can't be reordered reliably
  // (which word is the surname?), only a caller with the structured fields
  // can build both correctly.
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

export interface FrontMatterParts {
  // Pen name / title / subtitle -- variable-length, author-controlled text
  // that can wrap onto 2+ lines for a long title. Kept in its own group so
  // printHtml.ts can size it independently of titleBottom below.
  titleTop: any[];
  // Imprint ("ULIT" / "Українська літера") + year -- fixed, short strings
  // that never wrap in practice, bottom-pinned on the title page.
  titleBottom: any[];
  colophon: any[];
}

/**
 * Ridero-style title + colophon pages, generated fresh at print-render time
 * from live Book fields (Вихідні дані) -- NOT persisted into
 * Book.manuscriptContent and not author-editable. Previously these were
 * inserted once into the editable manuscript on first open (T-1953/T-1962),
 * which meant ISBN/УДК/anotation baked in at that moment never updated
 * again; this generator is now called fresh on every print-PDF render
 * instead (see printHtml.ts), so it always reflects the current book data.
 *
 * Returns titleTop/titleBottom/colophon as three separate node arrays
 * instead of one flat list -- printHtml.ts renders each separately and
 * wraps titleTop/titleBottom in their own flex-positioned divs, so the
 * bottom group (imprint+year) stays pinned to its own book-trim-aware
 * target distance from the page's physical bottom edge NO MATTER how tall
 * titleTop's real rendered height turns out to be (a long title/subtitle
 * wrapping onto a 2nd line used to push margin-top-chained siblings below it
 * further down than intended, occasionally overflowing onto a second page --
 * a single shared margin-top chain can't tell "this line wrapped" from "this
 * line didn't", flex's own layout can).
 */
export function buildFrontMatterParts(meta: FrontMatterMeta): FrontMatterParts {
  const year = meta.createdAt ? new Date(meta.createdAt).getFullYear() : new Date().getFullYear();

  // --- Page 1: title page -- author, title, subtitle, publisher imprint,
  // year -- centered, no paragraph indent/justify (that's body-prose
  // styling, wrong for a handful of standalone title-page lines; each gets
  // its own "titlepage-*" variant in proseStyles.ts so it never inherits
  // data-style="normal"'s text-indent/justify by accident).
  const titleTop: any[] = [];
  if (meta.authorPenName) titleTop.push(styledParagraph("normal", meta.authorPenName, "titlepage-author"));
  titleTop.push(styledParagraph("heading", meta.title, "titlepage-title"));
  if (meta.subtitle) titleTop.push(styledParagraph("subheading", meta.subtitle, "titlepage-subtitle"));

  // Two-line publisher imprint + year, own variant per line (printHtml.ts's
  // title-page geometry gives each its own computed margin-top WITHIN this
  // group -- the group as a whole is what's pinned to the page bottom).
  const titleBottom: any[] = [
    styledParagraph("normal", "ULIT", "titlepage-imprint-line1"),
    styledParagraph("normal", "Українська літера", "titlepage-imprint-line2"),
    styledParagraph("normal", `Київ - ${year}`, "titlepage-year"),
  ];

  // --- Page 2: colophon (Ridero-style випускні дані) -- catalog codes
  // stacked top-left, typesetting note, bold author byline (surname-first),
  // hanging-indent bibliographic line (author-sign as the hanging label),
  // annotation, bold catalog-code repeat, age-rating badge, copyright
  // pinned toward the bottom. ---
  const colophon: any[] = [];
  const authorCatalog = meta.authorNameCatalog ?? meta.authorNameDisplay;

  if (meta.udcCode) colophon.push(styledParagraph("normal", `УДК ${meta.udcCode}`, "colophon-code"));
  if (meta.authorSign) colophon.push(styledParagraph("normal", meta.authorSign, "colophon-code"));

  colophon.push(styledParagraph("normal", "Комп'ютерна верстка. Гарнітура Times New Roman.", "colophon-meta"));

  if (authorCatalog) colophon.push(styledParagraph("normal", authorCatalog, "colophon-author"));

  const bibLabel = meta.authorSign ? `${meta.authorSign} ` : "";
  const bibParts = [
    `${meta.title}${meta.authorNameDisplay ? ` / ${meta.authorNameDisplay}` : ""}. — [б.м.] : Ulit, ${year}.`,
  ];
  if (meta.pageCount) bibParts.push(`— ${meta.pageCount} с.`);
  if (meta.isbn) bibParts.push(`— ISBN ${meta.isbn}`);
  colophon.push(styledParagraph("normal", `${bibLabel}${bibParts.join(" ")}`, "colophon-biblio"));

  if (meta.description) colophon.push(styledParagraph("normal", meta.description, "colophon-description"));

  if (meta.udcCode) colophon.push(styledParagraph("normal", `УДК ${meta.udcCode}`, "colophon-code-bold"));

  if (meta.ageRating) colophon.push(styledParagraph("normal", meta.ageRating, "colophon-age"));

  colophon.push(styledParagraph("normal", `© ${authorCatalog ?? "Автор"}, ${year}`, "colophon-footer"));

  colophon.push({ type: "horizontalRule" });

  return { titleTop, titleBottom, colophon };
}
