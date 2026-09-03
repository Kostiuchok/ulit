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

// Shared with output-data/page.tsx's infoSchema (zod) so the "still counts
// as long enough" check below can never drift from what the save form
// actually validates against.
export const DESCRIPTION_MIN_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 500;

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
  category: "cover" | "manuscript" | "language" | "title" | "description" | "genre" | "author" | "price" | "other";
}

// Same keyword rules as parseRejectedConcerns above, applied per-line
// instead of to the whole note -- lets a caller isolate just the cover
// line(s) from a mixed rejection (e.g. show a dedicated, monitored cover
// block plus a generic block for everything else, instead of one
// undifferentiated paragraph the author has to parse themselves).
//
// "language" was the first category split out of a generic "metadata"
// bucket (checked before it, its own category) so a field-level UI can
// point a red ring at exactly the "Мова книги" select only when a rejection
// line actually mentions language -- not at every metadata-adjacent field
// whenever ANY of them is mentioned. title/description/genre/author/price
// split the same "metadata" bucket further, the same way, for the same
// reason: isRejectionLineResolved below needs to know exactly WHICH field a
// line is about to check whether that specific field now has a value --
// one shared "metadata" bucket can't answer "is THIS line fixed", only "is
// something in this vague pile of fields fixed".
export function splitRejectionLines(note: string): RejectionLine[] {
  return note
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((text) => {
      const n = text.toLowerCase();
      if (/обкладин/.test(n)) return { text, category: "cover" as const };
      if (/рукопис|docx|файл|конверт|epub|mobi/.test(n)) return { text, category: "manuscript" as const };
      if (/мов/.test(n)) return { text, category: "language" as const };
      if (/жанр/.test(n)) return { text, category: "genre" as const };
      if (/опис|анотац/.test(n)) return { text, category: "description" as const };
      if (/назв/.test(n)) return { text, category: "title" as const };
      if (/автор/.test(n)) return { text, category: "author" as const };
      if (/ціна|price|роялт/.test(n)) return { text, category: "price" as const };
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

// Fields isRejectionLineResolved needs to decide whether a specific rejected
// line has already been addressed. Optional throughout -- callers (e.g. the
// cover editor page) that only care about a subset just pass what they have.
export interface RejectionFieldState {
  title?: string | null;
  description?: string | null;
  genre?: string | null;
  coverUrl?: string | null;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  epubUrl?: string | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  bookAuthors?: { lastName: string; firstName: string }[] | null;
}

// Whether a specific rejection line's concern has already been addressed by
// the CURRENT field values -- checked live against the book record every
// render, not a point-in-time flag. Replaces the old "locallyFixed" trick
// (set once on save, reset to false on next mount/navigation) which made
// the rejection banner and its red border reappear on reload even after the
// flagged field was actually fixed, since nothing about the persisted
// moderationStatus/moderationNote itself had changed -- same live-field
// pattern the cover editor page already uses for its own cover-only
// rejection banner (coverResolved = !!book?.coverUrl).
export function isRejectionLineResolved(line: RejectionLine, book: RejectionFieldState): boolean {
  switch (line.category) {
    case "cover":
      return !!book.coverUrl;
    case "manuscript":
      return !!(book.originalDocxUrl || book.pdfUrl || book.epubUrl);
    case "title":
      return !!book.title && book.title.trim().length >= 3;
    case "description": {
      const len = (book.description ?? "").trim().length;
      return len >= DESCRIPTION_MIN_LENGTH && len <= DESCRIPTION_MAX_LENGTH;
    }
    case "genre":
      return !!book.genre?.trim();
    case "author":
      return Array.isArray(book.bookAuthors) && book.bookAuthors.some((a) => a.lastName?.trim() && a.firstName?.trim());
    case "price":
      return !!(
        book.priceEbook ||
        book.pricePrint ||
        book.pricePrintHardcover ||
        book.pricePrintBw ||
        book.pricePrintHardcoverBw
      );
    case "language":
    case "other":
    default:
      // No single field reliably signals "this specific concern is fixed"
      // -- language always holds SOME value (nothing to detect a "wrong
      // language" fix by), and "other" covers freeform/ISBN-ish text with
      // no field of its own on this page. These stay flagged until the
      // admin re-reviews rather than risk auto-clearing something that
      // hasn't actually been addressed.
      return false;
  }
}

// Convenience for a caller that just wants "what's left to fix" -- filters
// out lines already resolved against the live book record.
export function getUnresolvedRejectionLines(book: ModeratedBook & RejectionFieldState): RejectionLine[] {
  if (book.moderationStatus !== "REJECTED" || !book.moderationNote) return [];
  return splitRejectionLines(book.moderationNote).filter((l) => !isRejectionLineResolved(l, book));
}
