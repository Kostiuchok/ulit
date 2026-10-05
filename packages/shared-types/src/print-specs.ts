// Centralized print/cover technical constants for the dashboard redesign
// (docs/dashboard-ui/WF-SPEC.md v1). Single place to edit once the
// Ukrainian print house and Amazon KDP numbers below are formally
// confirmed -- every consumer (cover editor overlays, 06/06d/06e preview,
// price page) reads from here instead of a scattered literal.

// Bleed ("вильоти") the print house needs on every outer edge of the cover
// wrap -- 1.5 mm per side, confirmed by the owner 2026-10-05. The earlier
// 3.2 here was Amazon KDP's own figure (0.125in = 3.175mm), a placeholder
// from before the printer's number was known. A KDP print upload would
// still want KDP's 3.2 -- buildCoverPrintWrap (apps/api) takes the bleed
// as a parameter for exactly that case.
export const COVER_BLEED_MM = 1.5;
export const KDP_COVER_BLEED_MM = 3.2;

// Safe-zone margin from the trim edge that text/important content should
// stay clear of. WF-SPEC's own number -- not yet confirmed with a printer.
export const COVER_SAFE_ZONE_MIN_MM = 10;
export const COVER_SAFE_ZONE_MAX_MM = 15;

// KDP allows spine text starting at this page count (paperback) -- a
// page-count rule, not the physical-thickness rule
// (isSpineTooThinForText in index.ts) this app used before. TODO: confirm
// whether hardcover has its own (typically higher) page-count threshold --
// shipping the same number for both formats until that's confirmed.
export const MIN_SPINE_TEXT_PAGES = 79;

// Amazon KDP's PRINT royalty is a flat 60% of list price minus KDP's own
// print cost -- NOT the 35-70% tiered rate that applies to KDP EBOOKS only
// (distributionPlatforms.ts's existing KDP royaltyMin/Max). Used as:
// price = (printCost + royalty) / KDP_PRINT_ROYALTY_RATE
export const KDP_PRINT_ROYALTY_RATE = 0.6;

// TODO: Ukrainian print-house numbers (cover stock bleed/safe-zone, if they
// turn out to differ from KDP's own) -- placeholders until confirmed with
// the printer.
