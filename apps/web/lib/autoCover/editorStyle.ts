import JsBarcode from "jsbarcode";
import qrcode from "qrcode-generator";
import { deriveCoverTheme, isSpineTooThinForText } from "shared-types";
import type { CoverLayout, PanelRect } from "@/lib/coverLayout";
import type { Placed, PlacedText } from "./engine";
import { BACK_BIO_MAX, BACK_BLURB_MAX, drawBack, drawFront, drawSpine, type BackCoverData } from "./render";
import { findCoverStyle, type CoverTexts } from "./styles";

// A ready-made cover style, taken apart for the cover editor.
//
// The picker (AutoCoverPicker) paints a style as one picture. The editor
// needs the same cover as LAYERS the author can change: every text and every
// picture on it becomes its own object, and everything else -- background,
// decor, plates, ornaments, the template's photo -- is painted once into a
// single "style background" picture that sits underneath.
//
// Both halves come out of ONE layout pass of the very same engine the picker
// uses (engine.ts: `collect` + `skipLeaves`), so what opens in the editor is
// the cover that was chosen, not a look-alike rebuilt by other code.
//
// This module deliberately does not import fabric (see lib/coverLayout.ts for
// why that matters): it returns plain object descriptors in Fabric's JSON
// shape, which the editor feeds to canvas.loadFromJSON.

export interface EditorStyleInput {
  layout: CoverLayout;
  styleId: string;
  baseColor: string;
  texts: CoverTexts;
  back: BackCoverData;
  // Where the back cover's pictures come from -- the editor loads them
  // itself (by URL) as separate layers; `back.authorPhoto` / `back.otherCovers`
  // are the already-loaded elements the layout is measured with.
  authorPhotoUrl?: string | null;
  otherCoverUrls?: string[];
  pageCount: number | null;
  // The style's own photo (photo-1-flowers / photo-2-city), already loaded.
  photo: CanvasImageSource | null;
  // Background picture pixels per layout px -- the editor exports at
  // ~4.4-5.9x, so the picture has to be that sharp.
  resolution: number;
}

export interface EditorStyleBuild {
  // (totalW + 2*bleed) x (totalH + 2*bleed) layout px, times `resolution`.
  // Its top-left corner belongs at (-bleed, -bleed).
  background: HTMLCanvasElement;
  resolution: number;
  // Fabric JSON descriptors, in layout coordinates, bottom to top.
  objects: Record<string, unknown>[];
  themeBg: string;
  overflow: boolean;
}

// Fabric draws a line's baseline at top + fontSize * FABRIC_FONT_MULT *
// (1 - FABRIC_FONT_FRACTION) and advances by fontSize * lineHeight *
// FABRIC_FONT_MULT -- these two constants are fabric.Text's own
// (_fontSizeMult, _fontSizeFraction); the engine uses plain px * lineHeight
// and a baseline at half the line + 0.35 px. Converting between the two is
// what keeps every line where the picker drew it.
const FABRIC_FONT_MULT = 1.13;
const FABRIC_FONT_FRACTION = 0.222;
const ENGINE_BASELINE = 0.35;

const TEXT_ROLE: Record<string, string> = {
  title: "text-title",
  author: "text-author",
  subtitle: "text-subtitle",
  blurb: "text-blurb",
  bio: "text-bio",
};

function textObject(p: PlacedText, ox: number, oy: number) {
  const lineHeightPx = p.px * p.lineHeight;
  const baseline = FABRIC_FONT_MULT * (1 - FABRIC_FONT_FRACTION);
  const role = p.role ? TEXT_ROLE[p.role] : undefined;
  // A little air around the box of a ONE-line text. The engine sizes a text
  // inside a row to the exact width it measured; Fabric measures the same
  // string a fraction of a pixel differently and would break the last word
  // onto a new line. Added symmetrically for centred text, so nothing moves.
  // A text the engine already wrapped keeps its exact width (plus a hair):
  // any real slack there would let Fabric fit more words per line and wrap
  // it into fewer lines than the picker showed.
  const slack = p.lines > 1 ? 0.5 : Math.max(2, p.px * 0.3);
  const boxLeft = p.align === "center" ? p.x - slack : p.x;
  const boxWidth = p.w + (p.align === "center" ? slack * 2 : slack);
  return {
    type: "textbox",
    originX: "left",
    originY: "top",
    left: ox + boxLeft,
    top: oy + p.y + lineHeightPx / 2 + (ENGINE_BASELINE - baseline) * p.px,
    width: boxWidth,
    text: p.text,
    fontSize: p.px,
    fontFamily: p.spec.family,
    fontWeight: p.spec.weight,
    fontStyle: p.spec.italic ? "italic" : "normal",
    fill: p.color,
    textAlign: p.align,
    charSpacing: p.letterSpacing * 1000,
    lineHeight: p.lineHeight / FABRIC_FONT_MULT,
    // Fabric expects per-character styles to be present (an empty list is
    // fine); without it the object cannot be serialised again.
    styles: [],
    data: {
      ...(role ? { role } : {}),
      // What the text is in the template, for layers that have no editor
      // role of their own ("brand", "heading", "author-name").
      part: p.role,
      // Kept in sync with the book's data through these two (the editor
      // re-applies them when the linked value changes).
      upper: !!p.spec.upper,
      ...(p.role === "blurb" ? { clip: BACK_BLURB_MAX } : {}),
      ...(p.role === "bio" ? { clip: BACK_BIO_MAX } : {}),
    },
  };
}

function imageObject(src: string, natural: { w: number; h: number }, box: PanelRect, role: string, round = false) {
  // Cover-fit a round photo by its shorter side; everything else fills its box.
  const side = Math.min(natural.w, natural.h);
  return {
    type: "image",
    src,
    crossOrigin: src.startsWith("data:") ? null : "anonymous",
    originX: "left",
    originY: "top",
    left: round ? box.x - ((natural.w - side) / 2) * (box.w / side) : box.x,
    top: round ? box.y - ((natural.h - side) / 2) * (box.h / side) : box.y,
    scaleX: round ? box.w / side : box.w / natural.w,
    scaleY: round ? box.h / side : box.h / natural.h,
    ...(round ? { clipPath: { type: "circle", radius: side / 2, originX: "center", originY: "center", left: 0, top: 0 } } : {}),
    data: { role },
  };
}

function naturalSize(img: CanvasImageSource | null | undefined): { w: number; h: number } | null {
  const el = img as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null | undefined;
  const w = el?.naturalWidth || (typeof el?.width === "number" ? el.width : 0);
  const h = el?.naturalHeight || (typeof el?.height === "number" ? el.height : 0);
  return w && h ? { w, h } : null;
}

// QR code and ISBN barcode of the back cover's bottom row, as their own
// pictures (each on a white plate -- a scanner needs dark on white whatever
// the theme colour is).
function codeObjects(box: PanelRect, bookUrl: string | null | undefined, isbn: string | null | undefined) {
  const out: Record<string, unknown>[] = [];
  if (bookUrl) {
    try {
      const qr = qrcode(0, "M");
      qr.addData(bookUrl);
      qr.make();
      const cell = 6;
      const margin = 12;
      const natural = qr.getModuleCount() * cell + margin * 2;
      out.push(imageObject(qr.createDataURL(cell, margin), { w: natural, h: natural }, { x: box.x, y: box.y, w: box.h, h: box.h }, "qr"));
    } catch {
      // A URL too long for a QR code simply doesn't get one.
    }
  }
  const digits = (isbn ?? "").replace(/[^0-9]/g, "");
  if (digits.length === 13) {
    try {
      const el = document.createElement("canvas");
      JsBarcode(el, digits, { format: "EAN13", width: 3, height: 90, fontSize: 26, margin: 10, background: "#ffffff" });
      const w = (box.h * el.width) / el.height;
      out.push(
        imageObject(el.toDataURL("image/png"), { w: el.width, h: el.height }, { x: box.x + box.w - w, y: box.y, w, h: box.h }, "barcode")
      );
    } catch {
      // An ISBN that doesn't encode just leaves the corner empty.
    }
  }
  return out;
}

function shift(box: { x: number; y: number; w: number; h: number }, panel: PanelRect): PanelRect {
  return { x: panel.x + box.x, y: panel.y + box.y, w: box.w, h: box.h };
}

export function buildEditorStyle(input: EditorStyleInput): EditorStyleBuild {
  const { layout, resolution } = input;
  const style = findCoverStyle(input.styleId);
  const theme = deriveCoverTheme(input.baseColor);
  const B = layout.bleed;

  const background = document.createElement("canvas");
  background.width = Math.max(1, Math.round((layout.totalW + B * 2) * resolution));
  background.height = Math.max(1, Math.round((layout.totalH + B * 2) * resolution));
  const ctx = background.getContext("2d")!;
  ctx.scale(resolution, resolution);
  ctx.translate(B, B);

  const objects: Record<string, unknown>[] = [];
  const leaves = (placed: Placed[], panel: PanelRect, otherUrls: string[]) => {
    let other = 0;
    for (const p of placed) {
      if (p.kind === "text") {
        objects.push(textObject(p, panel.x, panel.y));
      } else if (p.kind === "image" && p.tag === "author-photo") {
        const size = naturalSize(input.back.authorPhoto);
        if (input.authorPhotoUrl && size) objects.push(imageObject(input.authorPhotoUrl, size, shift(p, panel), "author-photo", true));
      } else if (p.kind === "image" && p.tag === "other-book") {
        const url = otherUrls[other];
        const size = naturalSize(input.back.otherCovers?.[other]);
        other += 1;
        if (url && size) objects.push(imageObject(url, size, shift(p, panel), "other-book"));
      } else if (p.kind === "custom" && p.tag === "codes") {
        objects.push(...codeObjects(shift(p, panel), input.back.bookUrl, input.back.isbn));
      }
    }
  };

  let overflow = false;
  const { front, back, spine } = layout;

  if (back && spine) {
    const hardcover = layout.format === "hardcover";

    const backPlaced: Placed[] = [];
    ctx.save();
    ctx.translate(back.x, back.y);
    drawBack(ctx, back.w, back.h, theme, input.back, { l: B, t: B, r: 0, b: B }, { collect: backPlaced, skipLeaves: true });
    ctx.restore();
    leaves(backPlaced, back, input.otherCoverUrls ?? []);

    ctx.save();
    ctx.translate(spine.x, spine.y);
    const showText = input.pageCount != null && !isSpineTooThinForText(input.pageCount, hardcover);
    const label = drawSpine(ctx, spine.w, spine.h, theme, input.texts, showText, { l: 0, t: B, r: 0, b: B }, true);
    ctx.restore();
    if (label) {
      objects.push({
        type: "textbox",
        originX: "center",
        originY: "center",
        left: spine.x + spine.w / 2,
        top: spine.y + spine.h / 2,
        angle: 90,
        width: spine.h * 0.86,
        text: label.text,
        fontSize: label.px,
        fontFamily: "Montserrat",
        fontWeight: 700,
        fill: theme.textPrimary,
        textAlign: "center",
        styles: [],
        data: { role: "text-spine" },
      });
    }
  }

  const frontPlaced: Placed[] = [];
  ctx.save();
  ctx.translate(front.x, front.y);
  overflow = drawFront(
    ctx,
    front.w,
    front.h,
    style,
    theme,
    input.texts,
    input.photo,
    back ? { l: 0, t: B, r: B, b: B } : { l: 0, t: 0, r: 0, b: 0 },
    { collect: frontPlaced, skipLeaves: true }
  ).overflow;
  ctx.restore();
  leaves(frontPlaced, front, []);

  return { background, resolution, objects, themeBg: theme.bg, overflow };
}
