import sharp from "sharp";
import { COVER_BLEED_MM } from "shared-types";

// The print house gets ONE file: back | spine | front side by side, at the
// book's real trim size, plus bleed ("вильоти") on every outer edge. The
// author-facing exports (cover editor, auto-cover, a self-uploaded cover)
// are three separate trim-size images with no bleed at all, so the wrap is
// assembled here, on demand, from whatever is stored -- it works for every
// cover source and for books saved before this existed, with no re-save.
//
// The bleed itself is the outermost strip of the artwork mirrored outwards
// (sharp's extendWith: "mirror"). It is trimmed off after printing; its only
// job is to make sure a slightly off cut never shows unprinted paper, and a
// mirrored strip does that for any artwork (flat colour, photo, pattern)
// without the design having to be drawn past its own edge.
export const PRINT_WRAP_DPI = 300;

const mmToPx = (mm: number) => Math.round((mm / 25.4) * PRINT_WRAP_DPI);

export interface CoverPrintWrapInput {
  front: Buffer;
  back: Buffer;
  spine: Buffer;
  trimMm: { widthMm: number; heightMm: number };
  bleedMm?: number;
}

export interface CoverPrintWrapResult {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
  bleedPx: number;
  spineMm: number;
}

export async function buildCoverPrintWrap(input: CoverPrintWrapInput): Promise<CoverPrintWrapResult> {
  const bleedMm = input.bleedMm ?? COVER_BLEED_MM;
  const panelW = mmToPx(input.trimMm.widthMm);
  const panelH = mmToPx(input.trimMm.heightMm);
  const bleedPx = mmToPx(bleedMm);

  // The spine's thickness depends on page count AND binding (soft/hard), both
  // already baked into the saved spine image's own proportions -- reading it
  // back from there keeps the wrap consistent with what the author saw.
  const spineMeta = await sharp(input.spine).metadata();
  const spineRatio = spineMeta.width && spineMeta.height ? spineMeta.width / spineMeta.height : 0;
  const spineW = Math.max(1, Math.round(spineRatio * panelH));

  const panel = (buffer: Buffer, width: number) =>
    sharp(buffer)
      .flatten({ background: "#ffffff" })
      .resize({ width, height: panelH, fit: "fill" })
      .png()
      .toBuffer();

  const [back, spine, front] = await Promise.all([
    panel(input.back, panelW),
    panel(input.spine, spineW),
    panel(input.front, panelW),
  ]);

  const trimW = panelW * 2 + spineW;
  const trimmed = await sharp({
    create: { width: trimW, height: panelH, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: back, left: 0, top: 0 },
      { input: spine, left: panelW, top: 0 },
      { input: front, left: panelW + spineW, top: 0 },
    ])
    .png()
    .toBuffer();

  // Separate pipeline on purpose: sharp applies extend BEFORE composite
  // within one pipeline, which would mirror the blank base, not the artwork.
  const buffer = await sharp(trimmed)
    .extend({ top: bleedPx, bottom: bleedPx, left: bleedPx, right: bleedPx, extendWith: "mirror" })
    // Without this the PNG carries no resolution at all and opens in
    // InDesign/Photoshop at 72 dpi, i.e. four times the real size.
    .withMetadata({ density: PRINT_WRAP_DPI })
    .png()
    .toBuffer();

  return {
    buffer,
    widthPx: trimW + bleedPx * 2,
    heightPx: panelH + bleedPx * 2,
    bleedPx,
    spineMm: (spineW / PRINT_WRAP_DPI) * 25.4,
  };
}

// Stored cover URLs are public URLs (publicUrl(), optionally with a ?v=
// cache-buster); the object key is the `public/covers*/<file>` tail.
export function coverObjectNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.split("?")[0].match(/public\/covers(?:-back|-spine)?\/[^/]+$/);
  return match ? match[0] : null;
}
