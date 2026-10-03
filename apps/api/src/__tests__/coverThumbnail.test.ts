import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { toCoverThumbnail } from "../lib/coverThumbnail";

// Stands in for a real cover export: a flattened PNG at a print-ish
// resolution, well above the thumbnail's own cap, so resize actually has to
// act (withoutEnlargement must never trigger here).
async function fakeCoverExport(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe("toCoverThumbnail", () => {
  it("shrinks a large print-resolution PNG down to a small WebP", async () => {
    const original = await fakeCoverExport(1800, 2700); // a plausible print-trim export
    const thumb = await toCoverThumbnail(original);

    const meta = await sharp(thumb).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(400);
    // The whole point of the perf fix -- a thumbnail must be dramatically
    // smaller than the original, not just re-encoded at the same size.
    expect(thumb.length).toBeLessThan(original.length / 10);
  });

  it("preserves the original aspect ratio", async () => {
    const original = await fakeCoverExport(1200, 1800); // 2:3
    const thumb = await toCoverThumbnail(original);
    const meta = await sharp(thumb).metadata();
    const ratio = (meta.width ?? 0) / (meta.height ?? 1);
    expect(ratio).toBeCloseTo(1200 / 1800, 2);
  });

  it("never enlarges an image already smaller than the thumbnail cap", async () => {
    const original = await fakeCoverExport(100, 150);
    const thumb = await toCoverThumbnail(original);
    const meta = await sharp(thumb).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(150);
  });
});
