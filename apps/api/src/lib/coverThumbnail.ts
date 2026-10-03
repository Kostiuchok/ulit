import sharp from "sharp";

// AuthorBooksSidebar renders the cover at ~22x35 CSS px; BookCard (the book
// list, MyBooksList) at ~96x128 CSS px -- loading the full print-resolution
// export (2.6-4.3MB PNG, per the live perf report) for either is pure waste.
// 400px covers even a 3x-retina render of BookCard's larger box with margin
// to spare, while still being a tiny fraction of the original's size.
const THUMB_MAX_EDGE = 400;
const THUMB_QUALITY = 80;

export async function toCoverThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}
