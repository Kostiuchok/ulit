import JsBarcode from "jsbarcode";
import { deriveCoverTheme, isSpineTooThinForText, type CoverTheme } from "shared-types";
import { computeCoverLayout } from "@/lib/coverLayout";
import { fontString, renderDoc, type Node, type RenderResult } from "./engine";
import { COVER_FONT_CSS_URL, COVER_FONT_FACES, findCoverStyle, type CoverStyle, type CoverTexts } from "./styles";

// ── Fonts ────────────────────────────────────────────────────────────────
// Loaded at runtime from Google Fonts, only on pages that actually render an
// auto-cover -- canvas text needs the face fully loaded BEFORE drawing (it
// silently falls back otherwise), hence the explicit document.fonts.load per
// face. The sample text matters: Google serves Cyrillic as a separate
// unicode-range subset that is only fetched for text that needs it.
let fontsPromise: Promise<void> | null = null;

export function loadCoverFonts(sample: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!document.getElementById("ulit-cover-fonts")) {
    const link = document.createElement("link");
    link.id = "ulit-cover-fonts";
    link.rel = "stylesheet";
    link.href = COVER_FONT_CSS_URL;
    document.head.appendChild(link);
  }
  const text = `${sample} ULIT АаБбЇїЄєҐґ`;
  const attempt = () =>
    Promise.all(COVER_FONT_FACES.map((f) => document.fonts.load(fontString(f, 32), text).catch(() => []))).then(
      (r) => r.some((faces) => faces.length > 0)
    );
  if (!fontsPromise) {
    // The stylesheet itself may not have arrived yet on the first call --
    // fonts.load() resolves to [] until the @font-face rules exist.
    fontsPromise = (async () => {
      for (let i = 0; i < 20; i += 1) {
        if (await attempt()) return;
        await new Promise((r) => setTimeout(r, 150));
      }
    })();
    return fontsPromise;
  }
  // Later calls (a different title) still need their own glyph subsets.
  return fontsPromise.then(() => attempt()).then(() => undefined);
}

// ── Photos ───────────────────────────────────────────────────────────────
const PHOTO_SRC = { flowers: "/cover-styles/flowers.jpg", city: "/cover-styles/city.jpg" } as const;
const photoCache = new Map<string, Promise<HTMLCanvasElement | null>>();

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// The spec's `grayscale(1) contrast(1.15)`, baked into pixels once per photo
// (ctx.filter would do it in one line, but Safari doesn't implement it).
function loadPhoto(kind: keyof typeof PHOTO_SRC): Promise<HTMLCanvasElement | null> {
  let p = photoCache.get(kind);
  if (!p) {
    p = loadImage(PHOTO_SRC[kind]).then((img) => {
      if (!img) return null;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const g = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        const v = Math.max(0, Math.min(255, (g - 128) * 1.15 + 128));
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
      return c;
    });
    photoCache.set(kind, p);
  }
  return p;
}

export async function prepareCoverAssets(style: CoverStyle, sample: string): Promise<CanvasImageSource | null> {
  const [, photo] = await Promise.all([loadCoverFonts(sample), style.photo ? loadPhoto(style.photo) : null]);
  return photo;
}

// ── Front ────────────────────────────────────────────────────────────────
export function drawFront(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  style: CoverStyle,
  theme: CoverTheme,
  texts: CoverTexts,
  photo: CanvasImageSource | null
): RenderResult {
  return renderDoc(ctx, W, H, theme, style.build(texts, photo));
}

// ── Back ("Промо автора") ────────────────────────────────────────────────
export interface BackCoverData {
  description?: string | null;
  authorName: string;
  authorBio?: string | null;
  authorPhoto?: CanvasImageSource | null;
  otherCovers?: CanvasImageSource[];
  isbn?: string | null;
}

function barcodeCanvas(isbn: string): HTMLCanvasElement | null {
  const digits = isbn.replace(/[^0-9]/g, "");
  if (digits.length !== 13) return null;
  try {
    const el = document.createElement("canvas");
    JsBarcode(el, digits, { format: "EAN13", width: 3, height: 90, fontSize: 26, margin: 10, background: "#ffffff" });
    return el;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40))}…`;
}

// Every block is driven by real book data; a block with no data is simply
// absent -- placeholder copy must never be able to reach a printed cover.
export function drawBack(ctx: CanvasRenderingContext2D, W: number, H: number, theme: CoverTheme, data: BackCoverData) {
  const heading = (text: string): Node => ({
    t: "text",
    text,
    spec: { family: "Montserrat", weight: 600, size: 1.6, letterSpacing: 0.18, upper: true, token: "accent", align: "left" },
  });
  const body = (text: string): Node => ({
    t: "text",
    text,
    spec: { family: "Lora", weight: 400, size: 1.95, lineHeight: 1.45, token: "textPrimary", align: "left" },
  });

  const top: Node[] = [];
  if (data.description?.trim()) {
    top.push(heading("Про книгу"), body(clip(data.description, 420)), { t: "spacer", h: 2.2 });
  }
  if (data.authorBio?.trim() || data.authorPhoto) {
    top.push(heading("Про автора"));
    const name: Node = {
      t: "text",
      text: data.authorName,
      spec: { family: "Montserrat", weight: 700, size: 2.1, token: "textPrimary", align: "left" },
    };
    top.push(
      data.authorPhoto
        ? { t: "row", gap: 3, children: [{ t: "image", img: data.authorPhoto, w: 14, ratio: 1, round: true }, name] }
        : name
    );
    if (data.authorBio?.trim()) top.push(body(clip(data.authorBio, 360)));
  }
  if (data.otherCovers?.length) {
    top.push({ t: "spacer", h: 2.2 }, heading("Інші книги автора на ULIT"), {
      t: "row",
      gap: 3,
      children: data.otherCovers.slice(0, 3).map((img): Node => ({ t: "image", img, w: 13, ratio: 1.5 })),
    });
  }

  const barcode = data.isbn ? barcodeCanvas(data.isbn) : null;
  const bottomRow: Node[] = [
    {
      t: "text",
      text: "ULIT",
      spec: { family: "Unbounded", weight: 600, size: 1.6, letterSpacing: 0.3, token: "textSecondary", align: "left" },
    },
  ];
  const bottom: Node[] = [];
  if (barcode) {
    // Bottom-right, on its own white plate -- a scanner needs black on white
    // whatever the theme colour is.
    bottom.push({
      t: "custom",
      w: 80,
      h: 9,
      draw: (c, x, y, w, h) => {
        const bw = (h * barcode.width) / barcode.height;
        c.drawImage(barcode, x + w - bw, y, bw, h);
      },
    });
  }
  bottom.push(...bottomRow);

  renderDoc(ctx, W, H, theme, {
    decor: [
      { shape: "rect", token: "accent", x: 0, y: 0, w: 100, h: 1.2 },
    ],
    pad: [7.5, 10, 6, 10],
    justify: "space-between",
    align: "left",
    maxTitleLines: 99,
    children: [
      { t: "stack", gap: 1.6, children: top },
      { t: "stack", gap: 2, children: bottom },
    ],
  });
}

// ── Spine ────────────────────────────────────────────────────────────────
export function drawSpine(
  ctx: CanvasRenderingContext2D,
  w: number,
  H: number,
  theme: CoverTheme,
  texts: CoverTexts,
  showText: boolean
) {
  ctx.save();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, H);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, w, H * 0.012);
  if (showText && w >= 14) {
    const px = Math.min(w * 0.5, H * 0.022);
    ctx.translate(w / 2, H / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = theme.textPrimary;
    ctx.font = fontString({ family: "Montserrat", weight: 700 }, px);
    const full = `${texts.title}  ·  ${texts.author}`;
    let label = full;
    for (let n = full.length - 1; n > 8 && ctx.measureText(label).width > H * 0.84; n -= 1) {
      label = `${full.slice(0, n).trimEnd()}…`;
    }
    ctx.fillText(label, 0, 0);
  }
  ctx.restore();
}

// ── Composite helpers ────────────────────────────────────────────────────
export interface AutoCoverInput {
  styleId: string;
  baseColor: string;
  texts: CoverTexts;
  back: BackCoverData;
  pageCount: number | null;
  trimMm: { widthMm: number; heightMm: number };
}

const EXPORT_DPI = 300;

function newCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d")!];
}

function toPngBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Не вдалося сформувати зображення обкладинки"))), "image/png")
  );
}

function spineShowsText(input: AutoCoverInput, hardcover: boolean): boolean {
  return input.pageCount != null && !isSpineTooThinForText(input.pageCount, hardcover);
}

// Print-resolution PNGs, same sizing convention as the cover editor's own
// export (trim size at 300 DPI; the spine at the softcover thickness).
export async function exportAutoCover(input: AutoCoverInput): Promise<{ front: Blob; back: Blob; spine: Blob; overflow: boolean }> {
  const style = findCoverStyle(input.styleId);
  const theme = deriveCoverTheme(input.baseColor);
  const photo = await prepareCoverAssets(style, `${input.texts.title} ${input.texts.author} ${input.texts.subtitle ?? ""}`);
  const W = Math.round((input.trimMm.widthMm / 25.4) * EXPORT_DPI);
  const H = Math.round((input.trimMm.heightMm / 25.4) * EXPORT_DPI);
  const layout = computeCoverLayout("softcover", input.pageCount, input.trimMm);
  const spineW = Math.max(12, Math.round((layout.spine!.w / layout.front.w) * W));

  const [front, fctx] = newCanvas(W, H);
  const { overflow } = drawFront(fctx, W, H, style, theme, input.texts, photo);
  const [back, bctx] = newCanvas(W, H);
  drawBack(bctx, W, H, theme, input.back);
  const [spine, sctx] = newCanvas(spineW, H);
  drawSpine(sctx, spineW, H, theme, input.texts, spineShowsText(input, false));

  return { front: await toPngBlob(front), back: await toPngBlob(back), spine: await toPngBlob(spine), overflow };
}

// One canvas with the whole print wrap (back · spine · front) plus fold
// guides -- the "Друк" preview.
export function drawSpread(
  ctx: CanvasRenderingContext2D,
  height: number,
  input: AutoCoverInput,
  hardcover: boolean,
  photo: CanvasImageSource | null
): { width: number; overflow: boolean } {
  const style = findCoverStyle(input.styleId);
  const theme = deriveCoverTheme(input.baseColor);
  const layout = computeCoverLayout(hardcover ? "hardcover" : "softcover", input.pageCount, input.trimMm);
  const k = height / layout.totalH;
  const panelW = layout.front.w * k;
  const spineW = layout.spine!.w * k;

  ctx.save();
  drawBack(ctx, panelW, height, theme, input.back);
  ctx.translate(panelW, 0);
  drawSpine(ctx, spineW, height, theme, input.texts, spineShowsText(input, hardcover));
  ctx.translate(spineW, 0);
  const { overflow } = drawFront(ctx, panelW, height, style, theme, input.texts, photo);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  for (const x of [panelW, panelW + spineW]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.restore();
  return { width: panelW * 2 + spineW, overflow };
}

export { loadImage };
