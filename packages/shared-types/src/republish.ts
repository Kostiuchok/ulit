// Phase 3 (WF-SPEC.md dashboard-ui, "Фаза 3 — бекенд") -- generalizes the
// post-publish re-moderation staging that used to cover only
// title/description/genre (pendingTitle/pendingDescription/pendingGenre) and
// the manuscript (docxUpdatedAt vs publishedAt) to also include the cover
// (pendingCoverUrl). This is the SINGLE place both the backend
// (republish.ts's "is there anything to submit" gate, admin.ts's queue) and
// the frontend (RepublishButton.tsx's getChangesSummary, which the
// dashboard's header/banner and the "Огляд" page's section cards all read)
// compute the pending-blocks list -- before this, apps/web had its own
// separate client-side copy of the docx/metadata logic that had to be kept
// in sync by hand with this one.
export interface PendingChangeBook {
  docxUpdatedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  pendingCoverUrl?: string | null;
}

export type PendingChangeBlock = "Вихідні дані" | "Рукопис" | "Обкладинка";

export function hasPendingManuscriptChange(book: Pick<PendingChangeBook, "docxUpdatedAt" | "publishedAt">): boolean {
  if (!book.docxUpdatedAt) return false;
  const docxUpdatedAt = new Date(book.docxUpdatedAt);
  const publishedAt = book.publishedAt ? new Date(book.publishedAt) : null;
  return !publishedAt || docxUpdatedAt > publishedAt;
}

// Order here is the canonical display order everywhere this list is shown
// (dashboard banner, "Огляд" page).
export function getPendingChangeBlocks(book: PendingChangeBook): PendingChangeBlock[] {
  const blocks: PendingChangeBlock[] = [];
  if (book.pendingTitle != null || book.pendingDescription != null || book.pendingGenre != null) {
    blocks.push("Вихідні дані");
  }
  if (hasPendingManuscriptChange(book)) blocks.push("Рукопис");
  if (book.pendingCoverUrl != null) blocks.push("Обкладинка");
  return blocks;
}

export function hasPendingChanges(book: PendingChangeBook): boolean {
  return getPendingChangeBlocks(book).length > 0;
}

// WF-SPEC "Рішення 03.10, частина 2": "Обкладинку опублікованої книги можна
// змінювати раз на 90 днів." The clock starts at the last APPROVED cover
// change (coverApprovedAt), not at submission -- a still-pending change
// already blocks a second submission on its own (pendingCoverUrl != null
// gate in cover.ts), so this only needs to cover the post-approval cooldown.
export const COVER_CHANGE_LOCK_DAYS = 90;

// Returns the date the next cover change becomes allowed, or null if there
// is no active lock (never approved a post-publish change, or the lock has
// already expired).
export function coverLockedUntil(coverApprovedAt: string | Date | null | undefined, now: Date = new Date()): Date | null {
  if (!coverApprovedAt) return null;
  const until = new Date(new Date(coverApprovedAt).getTime() + COVER_CHANGE_LOCK_DAYS * 24 * 60 * 60 * 1000);
  return until > now ? until : null;
}

// WF-SPEC "ISBN-правило": "зберігається, якщо не змінюються формат, тип
// друку, назва чи автор, а кількість сторінок змінюється ≤ 10%; інакше —
// нове видання з новим ISBN." Snapshotted once by book-chamber.ts whenever
// an admin assigns/changes `isbn` (IsbnEditionSnapshot below); compared
// against the book's CURRENT values at republish-approve time. "Тип друку"
// has no dedicated field -- softcover-vs-hardcover isn't a book-level
// property here (both can coexist via pricePrint/pricePrintHardcover), so
// this reads trim size (printFormatKey/width/height) as the "формат/тип
// друку" the rule actually means.
export interface IsbnEditionSnapshot {
  printFormatKey: string | null;
  printWidthMm: number | null;
  printHeightMm: number | null;
  title: string;
  primaryAuthor: string | null;
  pageCount: number | null;
}

// Moved here from apps/api/src/modules/admin/book-chamber.ts (where it
// originated) once a third call site (conversion-status.ts, books module)
// needed it too -- a books-module file importing from admin/ would have
// been a backwards layering dependency; this is pure/side-effect-free, so
// shared-types is the correct common home, same as effectivePageCount above.
export interface BookAuthorEntry {
  lastName?: string;
  firstName?: string;
  middleName?: string;
}

export function formatAuthorFullName(bookAuthors: unknown): string | null {
  const authors = Array.isArray(bookAuthors) ? (bookAuthors as BookAuthorEntry[]) : [];
  const a = authors.find((x) => x?.lastName?.trim() && x?.firstName?.trim());
  if (!a) return null;
  return [a.lastName, a.firstName, a.middleName].filter((p) => p?.trim()).join(" ");
}

export const ISBN_EDITION_PAGE_DRIFT_RATIO = 0.1;

export function buildIsbnEditionSnapshot(book: {
  printFormatKey?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  title: string;
  primaryAuthor?: string | null;
  pageCount?: number | null;
}): IsbnEditionSnapshot {
  return {
    printFormatKey: book.printFormatKey ?? null,
    printWidthMm: book.printWidthMm ?? null,
    printHeightMm: book.printHeightMm ?? null,
    title: book.title,
    primaryAuthor: book.primaryAuthor ?? null,
    pageCount: book.pageCount ?? null,
  };
}

// true = same edition, keep the existing ISBN. false = new edition, the
// caller should clear isbn/udcCode/authorSign/bookChamberSubmittedAt so the
// admin re-registers. No snapshot at all (never assigned) isn't this
// function's problem -- the caller only calls it when `book.isbn` is set.
export function isbnStillValidForEdition(snapshot: IsbnEditionSnapshot, current: IsbnEditionSnapshot): boolean {
  if (snapshot.printFormatKey !== current.printFormatKey) return false;
  if (snapshot.printWidthMm !== current.printWidthMm) return false;
  if (snapshot.printHeightMm !== current.printHeightMm) return false;
  if (snapshot.title !== current.title) return false;
  if (snapshot.primaryAuthor !== current.primaryAuthor) return false;
  if (snapshot.pageCount != null && current.pageCount != null) {
    const drift = Math.abs(current.pageCount - snapshot.pageCount) / snapshot.pageCount;
    if (drift > ISBN_EDITION_PAGE_DRIFT_RATIO) return false;
  } else if (snapshot.pageCount != null || current.pageCount != null) {
    // One side has a page count and the other doesn't (e.g. print PDF never
    // regenerated after a format switch) -- can't confirm it's within drift,
    // so treat as a new edition rather than silently assuming it's fine.
    return false;
  }
  return true;
}
