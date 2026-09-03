import {
  REJECTION_REASONS,
  isRejectionReasonResolved,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  type RejectionReasonKey,
} from "shared-types";

interface ModeratedBook {
  moderationStatus?: string | null;
  moderationNote?: string | null;
}

// output-data's own section keys (SECTION_LABELS in output-data/page.tsx) --
// duplicated here rather than imported, since that page isn't a module
// other pages/lib can import from (it's a route file). Keep in sync if
// SECTION_LABELS' keys change.
export type OutputDataSectionKey = "info" | "file" | "price" | "review" | "publish";

// Per-line target for a rejection-reason bullet -- lets the author's
// rejection banner turn each line into a jump-link to the exact block to
// fix, instead of one flat paragraph of text the author has to match up to
// a page section themselves. `resolved` is always computed live against the
// current book record (never a point-in-time flag) -- see getAllRejectionLines.
export interface RejectionLine {
  text: string;
  category: RejectionReasonKey | "other";
  section: OutputDataSectionKey | "cover-page" | null;
  resolved: boolean;
}

// Legacy path only: best-effort keyword match against a freeform rejection
// note, for a book rejected before the structured REJECTION_REASONS system
// existed (moderationReasons empty/absent). "language" was the first
// category split out of a generic "metadata" bucket (its own category,
// checked before it) so a field-level UI can point a red ring at exactly the
// "Мова книги" select only when a rejection line actually mentions
// language -- not at every metadata-adjacent field whenever ANY of them is
// mentioned. title/description/genre/author/price split the same bucket
// further, for the same reason: isRejectionLineResolved needs to know
// exactly WHICH field a line is about.
function splitLegacyNote(note: string): { text: string; category: RejectionReasonKey | "other" }[] {
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

// Fields needed to decide whether a rejection concern has already been
// addressed -- both the legacy presence-based checks below and shared-types'
// snapshot-diff checks read from this same shape. Optional throughout --
// callers (e.g. the cover editor page) that only care about a subset just
// pass what they have.
export interface RejectionFieldState {
  title?: string | null;
  description?: string | null;
  genre?: string | null;
  language?: string | null;
  coverUrl?: string | null;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  epubUrl?: string | null;
  docxUpdatedAt?: string | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  desiredRoyaltyAmount?: number | string | null;
  desiredRoyaltyAmountPrint?: number | string | null;
  bookAuthors?: { lastName: string; firstName: string }[] | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

// Legacy-only presence check (no snapshot recorded) -- "is this field
// non-empty", which can't distinguish a rejection for a MISSING value from
// one for a WRONG-but-already-present value. Kept only for books rejected
// before the structured REJECTION_REASONS system existed; every new
// rejection uses isRejectionReasonResolved (shared-types) instead, which
// compares against the value snapshotted at the moment of rejection and so
// catches both cases.
function isLegacyLineResolved(category: RejectionReasonKey | "other", book: RejectionFieldState): boolean {
  switch (category) {
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
      // language" fix by, in the legacy freeform path), and "other" covers
      // freeform/ISBN-ish text with no field of its own on this page. These
      // stay flagged until the admin re-reviews rather than risk
      // auto-clearing something that hasn't actually been addressed.
      return false;
  }
}

// Every rejection line for this book, resolved or not -- the structured path
// (book.moderationReasons non-empty, i.e. rejected via the admin's
// checkboxes) reads REJECTION_REASONS directly and checks resolution via
// isRejectionReasonResolved's snapshot-diff (catches "was wrong, still
// unchanged" the legacy presence-checks below never could); a book rejected
// before that system existed (no moderationReasons recorded) falls back to
// best-effort keyword matching against the raw freeform note. Callers that
// only want what's left to fix should use getUnresolvedRejectionLines
// instead -- this is for anything that also wants to show already-resolved
// concerns (e.g. a green "✓ fixed" confirmation).
export function getAllRejectionLines(book: ModeratedBook & RejectionFieldState): RejectionLine[] {
  if (book.moderationStatus !== "REJECTED") return [];

  const reasons = book.moderationReasons;
  if (Array.isArray(reasons) && reasons.length > 0) {
    const snapshot = book.moderationFieldSnapshot as Partial<Record<RejectionReasonKey, unknown>> | null | undefined;
    const lines: RejectionLine[] = reasons
      .filter((k): k is RejectionReasonKey => REJECTION_REASONS.some((d) => d.key === k))
      .map((key) => {
        const def = REJECTION_REASONS.find((d) => d.key === key)!;
        return {
          text: def.noteText,
          category: key,
          section: def.section,
          resolved: isRejectionReasonResolved(key, book, snapshot),
        };
      });
    // The admin's own free-text addition (if any) never auto-resolves --
    // no field of its own to compare against, same treatment as a legacy
    // "other" line.
    if (book.moderationCustomNote?.trim()) {
      lines.push({ text: book.moderationCustomNote.trim(), category: "other", section: null, resolved: false });
    }
    return lines;
  }

  if (!book.moderationNote) return [];
  return splitLegacyNote(book.moderationNote).map((l) => ({
    text: l.text,
    category: l.category,
    section: resolveRejectionLineSection(l.text),
    resolved: isLegacyLineResolved(l.category, book),
  }));
}

// Convenience for a caller that just wants "what's left to fix".
export function getUnresolvedRejectionLines(book: ModeratedBook & RejectionFieldState): RejectionLine[] {
  return getAllRejectionLines(book).filter((l) => !l.resolved);
}
