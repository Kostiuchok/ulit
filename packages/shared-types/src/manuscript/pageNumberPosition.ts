// Page-number placement (T-1963 follow-up) -- a document-level setting, not
// per-paragraph-style, so it can't live inside the StyledBlockStyleName-keyed
// styleOverrides map (StyleOverride shape). Piggybacks on the same JSON blob
// under a reserved key instead of a backend migration: both
// Book.manuscriptStyleOverrides and AuthorStyleSet.styleOverrides are
// z.any() on the API (apps/api/src/modules/books/manuscript.ts,
// style-sets.ts) -- an extra key round-trips untouched. This is what makes
// it save/restore correctly both as the book's own setting and inside a
// personal "Набір стилів" (AuthorStyleSet), same mechanism as T-1943/1944.
//
// Moved to shared-types (T-2057) so the print-PDF render (printHtml.ts, run
// server-side in the worker) reads the exact same saved position the author
// picked in the editor, instead of a second, potentially-drifting copy.
export type PageNumberPosition = "bottom-left" | "bottom-center" | "bottom-right";

export const DEFAULT_PAGE_NUMBER_POSITION: PageNumberPosition = "bottom-center";

export const PAGE_NUMBER_POSITION_LABELS: Record<PageNumberPosition, string> = {
  "bottom-left": "Знизу зліва",
  "bottom-center": "Знизу по центру",
  "bottom-right": "Знизу справа",
};

const RESERVED_KEY = "__pageNumberPosition";

function isPageNumberPosition(value: unknown): value is PageNumberPosition {
  return value === "bottom-left" || value === "bottom-center" || value === "bottom-right";
}

/** Reads the saved position out of a raw styleOverrides JSON blob, falling back to the default. */
export function extractPageNumberPosition(raw: Record<string, unknown> | null | undefined): PageNumberPosition {
  const value = raw?.[RESERVED_KEY];
  return isPageNumberPosition(value) ? value : DEFAULT_PAGE_NUMBER_POSITION;
}

/** Embeds the position into a styleOverrides map before it's sent to the API. */
export function withPageNumberPosition<T extends Record<string, unknown>>(
  styleOverrides: T,
  position: PageNumberPosition
): T & { [RESERVED_KEY]: PageNumberPosition } {
  return { ...styleOverrides, [RESERVED_KEY]: position };
}

/** Strips the reserved key back out so the per-paragraph-style map stays clean in memory. */
export function stripPageNumberPosition<T extends Record<string, unknown>>(raw: T): T {
  const { [RESERVED_KEY]: _drop, ...rest } = raw as Record<string, unknown>;
  return rest as T;
}
