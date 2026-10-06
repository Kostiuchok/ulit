import { siteRoyaltyRate } from "shared-types";

// Price maths for «Вихідні дані → Ціна».
//
// Author-facing model: the author types what THEY want to earn per copy
// ("бажаний гонорар"), not a final shelf price. Print has a real per-unit
// production cost (from print-cost), an ebook doesn't, hence two royalty
// numbers instead of one.
//
// Every channel's suggested price is ADVISORY except Ulit (our own store,
// fixed rate, always enabled) -- computeAnchorPrices() derives the one
// concrete price actually SAVED to priceEbook/pricePrint/pricePrintHardcover
// from Ulit's rate, since apps/api/.../orders.ts requires a real stored
// price to check out.
//
// (Lived in components/books/FormatsAndDistribution.tsx next to the creation
// wizard's own formats step until the wizard was removed, 2026-10-06.)

export type PrintCost =
  | { status: "DONE"; softcoverCost: number; hardcoverCost: number }
  | { status: "NO_PAGE_COUNT" }
  | { status: "NO_SETTINGS" }
  | null;

const ULIT_RATE = siteRoyaltyRate(); // DISTRIBUTION_PLATFORMS "ULIT" -- fixed, not a range, so it's the only channel we can derive a single concrete price from.

export function parseRoyalty(v: string): number | undefined {
  const n = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
}

// The one concrete price that actually gets written to priceEbook/pricePrint/
// pricePrintHardcover, derived from Ulit's fixed rate. Returns undefined for
// a field when there isn't enough info yet (no royalty entered, or -- for
// print -- no production cost available yet).
export function computeAnchorPrices(
  printCost: PrintCost,
  royaltyEbookInput: string,
  royaltyPrintInput: string
): { priceEbook?: number; pricePrint?: number; pricePrintHardcover?: number } {
  const royaltyEbook = parseRoyalty(royaltyEbookInput);
  const royaltyPrint = parseRoyalty(royaltyPrintInput);
  const cost = printCost?.status === "DONE" ? printCost : null;

  return {
    priceEbook: royaltyEbook !== undefined ? round2(royaltyEbook / ULIT_RATE) : undefined,
    pricePrint:
      royaltyPrint !== undefined && cost ? round2((cost.softcoverCost + royaltyPrint) / ULIT_RATE) : undefined,
    pricePrintHardcover:
      royaltyPrint !== undefined && cost ? round2((cost.hardcoverCost + royaltyPrint) / ULIT_RATE) : undefined,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatUah(n: number): string {
  return `${n.toFixed(2)} грн`;
}

// min price at the channel's best rate (royaltyMax) .. max price at its
// worst rate (royaltyMin) -- fixed-rate channels (Ulit, D2D, Google) collapse
// to a single number since min===max there.
export function suggestedPriceRange(cost: number, royalty: number, royaltyMin: number, royaltyMax: number) {
  return { min: (cost + royalty) / royaltyMax, max: (cost + royalty) / royaltyMin };
}
