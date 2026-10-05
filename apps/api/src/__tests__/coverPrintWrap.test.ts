import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { COVER_BLEED_MM } from "shared-types";
import {
  buildCoverPrintWrap,
  finalizeEditorPrintWrap,
  coverObjectNameFromUrl,
  PRINT_WRAP_DPI,
} from "../lib/coverPrintWrap";

const solid = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

const px = (mm: number) => Math.round((mm / 25.4) * PRINT_WRAP_DPI);

async function pixel(buffer: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

describe("buildCoverPrintWrap", () => {
  const trimMm = { widthMm: 148, heightMm: 210 };

  it("uses the print-house bleed of 1.5 mm", () => {
    expect(COVER_BLEED_MM).toBe(1.5);
  });

  it("lays out back | spine | front at trim size plus bleed on every outer edge", async () => {
    // Deliberately small sources -- the wrap must be sized from the book's
    // trim size, not from whatever resolution the stored images happen to be.
    const front = await solid(350, 497, "#ff0000");
    const back = await solid(350, 497, "#0000ff");
    const spine = await solid(35, 497, "#00ff00");

    const wrap = await buildCoverPrintWrap({ front, back, spine, trimMm });
    const meta = await sharp(wrap.buffer).metadata();

    const panelW = px(148);
    const panelH = px(210);
    const bleed = px(1.5);
    const spineW = Math.round((35 / 497) * panelH);

    expect(wrap.bleedPx).toBe(bleed);
    expect(meta.width).toBe(panelW * 2 + spineW + bleed * 2);
    expect(meta.height).toBe(panelH + bleed * 2);
    expect(meta.density).toBe(PRINT_WRAP_DPI);
    expect(wrap.widthPx).toBe(meta.width);
    expect(wrap.heightPx).toBe(meta.height);

    const midY = Math.round(meta.height! / 2);
    expect(await pixel(wrap.buffer, bleed + 10, midY)).toEqual([0, 0, 255]);
    expect(await pixel(wrap.buffer, bleed + panelW + Math.floor(spineW / 2), midY)).toEqual([0, 255, 0]);
    expect(await pixel(wrap.buffer, bleed + panelW + spineW + 10, midY)).toEqual([255, 0, 0]);
  });

  it("fills the bleed with the artwork's own edge, never with blank paper", async () => {
    const front = await solid(350, 497, "#ff0000");
    const back = await solid(350, 497, "#0000ff");
    const spine = await solid(35, 497, "#00ff00");
    const wrap = await buildCoverPrintWrap({ front, back, spine, trimMm });
    const midY = Math.round(wrap.heightPx / 2);

    expect(await pixel(wrap.buffer, 0, midY)).toEqual([0, 0, 255]); // left of the back cover
    expect(await pixel(wrap.buffer, wrap.widthPx - 1, midY)).toEqual([255, 0, 0]); // right of the front
    expect(await pixel(wrap.buffer, wrap.bleedPx + 10, 0)).toEqual([0, 0, 255]); // above the back cover
    expect(await pixel(wrap.buffer, wrap.widthPx - wrap.bleedPx - 10, wrap.heightPx - 1)).toEqual([255, 0, 0]);
  });

  it("honours an explicit bleed override", async () => {
    const img = await solid(100, 142, "#888888");
    const wrap = await buildCoverPrintWrap({ front: img, back: img, spine: img, trimMm, bleedMm: 3.2 });
    expect(wrap.bleedPx).toBe(px(3.2));
  });
});

describe("finalizeEditorPrintWrap", () => {
  it("normalises the editor's own wrap to the exact print size without adding a mirror", async () => {
    const trimMm = { widthMm: 148, heightMm: 210 };
    // Editor export: slightly off-size, artwork (red) right to the edge.
    const wrap = await solid(3741, 2513, "#ff0000");
    const spine = await solid(35, 497, "#00ff00");
    const out = await finalizeEditorPrintWrap({ wrap, spine, trimMm });
    const meta = await sharp(out.buffer).metadata();

    const panelH = px(210);
    const spineW = Math.round((35 / 497) * panelH);
    expect(meta.width).toBe(px(148) * 2 + spineW + px(1.5) * 2);
    expect(meta.height).toBe(panelH + px(1.5) * 2);
    expect(meta.density).toBe(PRINT_WRAP_DPI);
    expect(await pixel(out.buffer, 0, 0)).toEqual([255, 0, 0]);
    expect(await pixel(out.buffer, meta.width! - 1, meta.height! - 1)).toEqual([255, 0, 0]);
  });
});

describe("coverObjectNameFromUrl", () => {
  it("extracts the storage key from a public cover URL", () => {
    expect(coverObjectNameFromUrl("https://ulit.render.ua/storage/public/covers/abc.png?v=17")).toBe(
      "public/covers/abc.png"
    );
    expect(coverObjectNameFromUrl("http://minio:9000/knyha-books/public/covers-back/abc.jpg")).toBe(
      "public/covers-back/abc.jpg"
    );
    expect(coverObjectNameFromUrl("https://x/storage/public/covers-wrap/abc.png")).toBe("public/covers-wrap/abc.png");
    expect(coverObjectNameFromUrl("https://x/storage/public/covers-spine/abc-pending.png")).toBe(
      "public/covers-spine/abc-pending.png"
    );
  });

  it("returns null for anything that is not a stored cover", () => {
    expect(coverObjectNameFromUrl(null)).toBeNull();
    expect(coverObjectNameFromUrl("https://example.com/image.png")).toBeNull();
  });
});
