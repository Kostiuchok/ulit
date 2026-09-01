interface ModeratedBook {
  moderationStatus?: string | null;
  moderationNote?: string | null;
}

export interface RejectedConcerns {
  cover: boolean;
  manuscript: boolean;
  metadata: boolean;
}

export function parseRejectedConcerns(book: ModeratedBook): RejectedConcerns {
  if (book.moderationStatus !== "REJECTED" || !book.moderationNote) {
    return { cover: false, manuscript: false, metadata: false };
  }
  const n = book.moderationNote.toLowerCase();
  return {
    cover: /обкладин/.test(n),
    manuscript: /рукопис|docx|файл|конверт/.test(n),
    metadata: /назв|опис|жанр|мов|ціна|price|isbn|метадан/.test(n),
  };
}

// output-data's own section keys (SECTION_LABELS in output-data/page.tsx) --
// duplicated here rather than imported, since that page isn't a module
// other pages/lib can import from (it's a route file). Keep in sync if
// SECTION_LABELS' keys change.
export type OutputDataSectionKey = "info" | "file" | "price" | "review" | "publish";

// Per-line target for a rejection-reason bullet -- lets the author's
// rejection banner turn each line into a jump-link to the exact block to
// fix, instead of one flat paragraph of text the author has to match up to
// a page section themselves. Best-effort keyword match against the admin's
// rejection text, which is freeform/editable (prefilled from
// buildRejectionText in distribute/page.tsx but not guaranteed to stay in
// that shape) -- returns null when a line isn't something the author can
// act on from either page (e.g. ISBN, which only the admin can enter via
// "Книжкова палата"; or the pageCount pipeline bug, which isn't a content
// problem at all).
export interface RejectionLine {
  text: string;
  category: "cover" | "manuscript" | "language" | "metadata" | "other";
}

// Same keyword rules as parseRejectedConcerns above, applied per-line
// instead of to the whole note -- lets a caller isolate just the cover
// line(s) from a mixed rejection (e.g. show a dedicated, monitored cover
// block plus a generic block for everything else, instead of one
// undifferentiated paragraph the author has to parse themselves).
//
// "language" is split out of the generic "metadata" bucket (its own
// category, checked before the metadata catch-all) so a field-level UI can
// point a red ring at exactly the "Мова книги" select only when a rejection
// line actually mentions language -- not at every metadata-adjacent field
// (title/genre/description/price/...) whenever ANY of them is mentioned,
// which previously made e.g. an "Опис замалий" line light up the unrelated
// language dropdown too (output-data/page.tsx's showRejection used one
// blind flag for the whole section AND every field inside it alike).
export function splitRejectionLines(note: string): RejectionLine[] {
  return note
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((text) => {
      const n = text.toLowerCase();
      if (/обкладин/.test(n)) return { text, category: "cover" as const };
      if (/рукопис|docx|файл|конверт|epub|mobi/.test(n)) return { text, category: "manuscript" as const };
      if (/мов/.test(n)) return { text, category: "language" as const };
      if (/назв|опис|жанр|ціна|price|isbn|метадан|анотац|автор/.test(n)) return { text, category: "metadata" as const };
      return { text, category: "other" as const };
    });
}

export function resolveRejectionLineSection(line: string): OutputDataSectionKey | "cover-page" | null {
  const n = line.toLowerCase();
  if (/обкладин/.test(n)) return "cover-page";
  if (/isbn|кількість сторінок|сторінок не визначен/.test(n)) return null;
  if (/epub|mobi|рукопис|конверт/.test(n)) return "file";
  if (/ціна|price|роялт|платформ|розповсюдж|канал/.test(n)) return "price";
  if (/опис|анотац|назв|жанр|мов|автор/.test(n)) return "info";
  return null;
}
