// "Знижка в ULIT" (price page, WF-SPEC v1) -- ULIT-only discount, author
// configures a percent + end date (optional start date) on the price page;
// applies immediately without moderation, never passed to external
// channels. Shared between apps/web (display: strikethrough price, badge,
// royalty preview) and apps/api (orders.ts -- the actual charge MUST use
// the discounted price, not just display it, or display and charge would
// silently diverge).
//
// One discount shared by ebook AND print for now (per Анатолій's own
// answer: "якщо це зараз складно, хай поки буде одна знижка на обидва
// формати, але так, щоб поле легко було розділити") -- splitting later
// just means adding discountPercentPrint/discountEndsAtPrint etc. and
// reading the right one per format; this module's functions take the
// percent/dates as plain arguments rather than a Book shape specifically
// so that split is a call-site change, not a signature change here.

export interface DiscountFields {
  discountPercent?: number | null;
  discountStartsAt?: Date | string | null;
  discountEndsAt?: Date | string | null;
}

export const MIN_DISCOUNT_PERCENT = 5;
export const MAX_DISCOUNT_PERCENT = 90;

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

// Checked at display/charge time, not by a cron -- an expired or
// not-yet-started discount is simply inactive on the next read.
export function isDiscountActive(book: DiscountFields, now: Date = new Date()): boolean {
  if (book.discountPercent == null || book.discountPercent <= 0) return false;
  const endsAt = toDate(book.discountEndsAt);
  if (!endsAt || endsAt <= now) return false;
  const startsAt = toDate(book.discountStartsAt);
  if (startsAt && startsAt > now) return false;
  return true;
}

// Rounds to the same 2-decimal-place money precision as every other price
// in this app (Decimal(10,2) columns).
export function discountedPrice(price: number, book: DiscountFields, now: Date = new Date()): number {
  if (!isDiscountActive(book, now)) return price;
  const rate = 1 - book.discountPercent! / 100;
  return Math.round(price * rate * 100) / 100;
}

// The author's actual payout per sale once a discount is active --
// recomputed from the DISCOUNTED price (the platform doesn't absorb the
// discount, the same royalty-rate split still applies to the lower price).
// `cost` is the print cost basis (0 for ebook); `royaltyRate` is the
// channel's own rate (ULIT 0.7, KDP print 0.6, etc.).
export function royaltyFromPrice(price: number, cost: number, royaltyRate: number): number {
  return price * royaltyRate - cost;
}
