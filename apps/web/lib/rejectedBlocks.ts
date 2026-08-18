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
export function resolveRejectionLineSection(line: string): OutputDataSectionKey | "cover-page" | null {
  const n = line.toLowerCase();
  if (/обкладин/.test(n)) return "cover-page";
  if (/isbn|кількість сторінок|сторінок не визначен/.test(n)) return null;
  if (/epub|mobi|рукопис|конверт/.test(n)) return "file";
  if (/ціна|price|роялт|платформ|розповсюдж|канал/.test(n)) return "price";
  if (/опис|анотац|назв|жанр|мов|автор/.test(n)) return "info";
  return null;
}
