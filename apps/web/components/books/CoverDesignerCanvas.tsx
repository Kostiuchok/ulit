"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { fabric } from "fabric";
import JsBarcode from "jsbarcode";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { CoverTemplatesModal } from "./CoverTemplatesModal";

// Front-panel display vs export
const DISPLAY_W = 350;
const DISPLAY_H = 525;
const EXPORT_SCALE = 1800 / DISPLAY_W; // ~5.14× → 1800×2700px per panel

// T-1926 — minimum accepted size for a self-uploaded cover (matches print requirements: 150 DPI)
const OWN_COVER_MIN_W = 915;
const OWN_COVER_MIN_H = 1270;

// Inset from a panel's raw edge for "safe zone" alignment — keeps text clear
// of the trim/bleed area near the physical edge of a printed cover.
const SAFE_MARGIN = 24;

// Standard system fonts only — rendered by the viewer's own browser/OS (like
// any CSS font-family), never embedded/redistributed as a file, so this
// carries no font-licensing risk. All have solid Cyrillic coverage.
const FONTS = ["Georgia", "Arial", "Helvetica", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New"];

// DISPLAY_W (350px) represents a 6in / 1800px-at-300dpi trim width — used to
// convert a real-world spine thickness (mm) into display px.
const TRIM_WIDTH_MM = (1800 / 300) * 25.4;
const PX_PER_MM = DISPLAY_W / TRIM_WIDTH_MM;
const DEFAULT_PAGE_COUNT = 150;

export type CoverFormat = "ebook" | "softcover" | "hardcover";

interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CoverLayout {
  format: CoverFormat;
  totalW: number;
  totalH: number;
  front: PanelRect;
  spine?: PanelRect;
  back?: PanelRect;
}

function computeSpineWidthPx(format: CoverFormat, pageCount?: number | null): number {
  const pages = pageCount && pageCount > 0 ? pageCount : DEFAULT_PAGE_COUNT;
  const spineMm = pages * 0.1 + (format === "hardcover" ? 4 : 0);
  return Math.max(6, Math.round(spineMm * PX_PER_MM));
}

export function computeCoverLayout(format: CoverFormat, pageCount?: number | null): CoverLayout {
  if (format === "ebook") {
    return { format, totalW: DISPLAY_W, totalH: DISPLAY_H, front: { x: 0, y: 0, w: DISPLAY_W, h: DISPLAY_H } };
  }
  const spineW = computeSpineWidthPx(format, pageCount);
  return {
    format,
    totalW: DISPLAY_W * 2 + spineW,
    totalH: DISPLAY_H,
    back: { x: 0, y: 0, w: DISPLAY_W, h: DISPLAY_H },
    spine: { x: DISPLAY_W, y: 0, w: spineW, h: DISPLAY_H },
    front: { x: DISPLAY_W + spineW, y: 0, w: DISPLAY_W, h: DISPLAY_H },
  };
}

// ─── Template contract ──────────────────────────────────────────────────────

export interface TemplateCtx {
  layout: CoverLayout;
  title: string;
  author: string;
  subtitle?: string;
  description?: string;
  bio?: string;
  isbn?: string | null;
}

export interface Template {
  id: string;
  label: string;
  thumbnail: string;
  palette: string[];
  apply: (canvas: fabric.Canvas, ctx: TemplateCtx) => void;
}

function addAccentBg(canvas: fabric.Canvas, layout: CoverLayout, color: string) {
  const bg = new fabric.Rect({
    left: 0,
    top: 0,
    width: layout.totalW,
    height: layout.totalH,
    fill: color,
    selectable: false,
    evented: false,
    data: { role: "accent" },
  });
  canvas.add(bg);
}

interface FrontTextStyle {
  font: string;
  titleColor: string;
  authorColor: string;
  bandColor: string;
  bandOpacity: number;
}

// Always draws translucent bands behind title/author — necessary because the
// whole front panel doubles as the photo/pattern slot, so text needs to stay
// legible once a photo is placed there. The top band's height follows the
// title/subtitle's actual wrapped height (fabric.Textbox computes line-wrap
// height synchronously on construction, before it's added to the canvas) —
// a long title that wraps to several lines no longer overlaps the subtitle.
function drawFrontText(canvas: fabric.Canvas, front: PanelRect, ctx: TemplateCtx, style: FrontTextStyle) {
  const cx = front.x + front.w / 2;
  const titleTop = front.y + front.h * 0.08;

  const titleObj = new fabric.Textbox(ctx.title, {
    left: cx,
    top: titleTop,
    fontSize: 28,
    fill: style.titleColor,
    fontFamily: style.font,
    fontWeight: "bold",
    textAlign: "center",
    originX: "center",
    width: front.w - 40,
    data: { role: "text-title" },
  });

  let cursorY = titleTop + (titleObj.height ?? 34) + 12;
  let subtitleObj: fabric.Textbox | null = null;
  if (ctx.subtitle) {
    subtitleObj = new fabric.Textbox(ctx.subtitle, {
      left: cx,
      top: cursorY,
      fontSize: 14,
      fill: style.titleColor,
      fontFamily: style.font,
      textAlign: "center",
      originX: "center",
      width: front.w - 60,
      opacity: 0.85,
      data: { role: "text-subtitle" },
    });
    cursorY += (subtitleObj.height ?? 18) + 10;
  }

  const bandTop = front.y + front.h * 0.04;
  const topBandHeight = Math.max(cursorY - bandTop + 10, front.h * 0.18);

  canvas.add(
    new fabric.Rect({
      left: front.x,
      top: bandTop,
      width: front.w,
      height: topBandHeight,
      fill: style.bandColor,
      opacity: style.bandOpacity,
      data: { role: "band" },
    })
  );
  canvas.add(
    new fabric.Rect({
      left: front.x,
      top: front.y + front.h - front.h * 0.14,
      width: front.w,
      height: front.h * 0.14,
      fill: style.bandColor,
      opacity: style.bandOpacity,
      data: { role: "band" },
    })
  );

  canvas.add(titleObj);
  if (subtitleObj) canvas.add(subtitleObj);

  canvas.add(
    new fabric.Textbox(ctx.author, {
      left: cx,
      top: front.y + front.h - front.h * 0.1,
      fontSize: 15,
      fill: style.authorColor,
      fontFamily: style.font,
      textAlign: "center",
      originX: "center",
      width: front.w - 40,
      data: { role: "text-author" },
    })
  );
}

function renderBarcodeDataUrl(isbn: string): string | null {
  const digits = isbn.replace(/[^0-9]/g, "");
  if (digits.length !== 13) return null;
  const el = document.createElement("canvas");
  try {
    JsBarcode(el, digits, {
      format: "EAN13",
      width: 1.3,
      height: 38,
      fontSize: 11,
      margin: 4,
      background: "#ffffff",
      lineColor: "#000000",
    });
  } catch {
    return null;
  }
  return el.toDataURL("image/png");
}

function drawBackAndSpine(canvas: fabric.Canvas, ctx: TemplateCtx, style: { font: string; color: string }) {
  const { layout } = ctx;
  if (layout.spine && layout.spine.w >= 14) {
    const spine = layout.spine;
    canvas.add(
      new fabric.Textbox(`${ctx.author}   •   ${ctx.title}`, {
        left: spine.x + spine.w / 2,
        top: spine.y + spine.h / 2,
        fontSize: 12,
        fill: style.color,
        fontFamily: style.font,
        textAlign: "center",
        width: spine.h - 20,
        originX: "center",
        originY: "center",
        angle: -90,
        data: { role: "text-spine" },
      })
    );
  }
  if (layout.back) {
    const back = layout.back;
    const blurbTop = back.y + 30;
    const blurbObj = new fabric.Textbox(ctx.description || "Анотація до книги…", {
      left: back.x + 24,
      top: blurbTop,
      fontSize: 12,
      fill: style.color,
      fontFamily: style.font,
      width: back.w - 48,
      lineHeight: 1.3,
      data: { role: "text-blurb" },
    });
    canvas.add(blurbObj);

    if (ctx.bio) {
      canvas.add(
        new fabric.Textbox(ctx.bio, {
          left: back.x + 24,
          top: blurbTop + (blurbObj.height ?? 0) + 20,
          fontSize: 11,
          fill: style.color,
          fontFamily: style.font,
          width: back.w - 48,
          lineHeight: 1.3,
          opacity: 0.85,
          data: { role: "text-bio" },
        })
      );
    }
    // Standardized colophon block: ISBN label above the barcode (bottom-left),
    // service logo + tagline to the right of the barcode.
    if (ctx.isbn) {
      const dataUrl = renderBarcodeDataUrl(ctx.isbn);
      if (dataUrl) {
        const bottomMargin = 34;
        fabric.Image.fromURL(dataUrl, (img) => {
          const barcodeW = img.width ?? 130;
          const barcodeH = img.height ?? 46;
          const barcodeX = back.x + 24;
          const barcodeY = back.y + back.h - bottomMargin - barcodeH;

          img.set({ left: barcodeX, top: barcodeY, selectable: false, evented: false, data: { role: "barcode" } });
          canvas.add(img);

          canvas.add(
            new fabric.Text(`ISBN ${ctx.isbn}`, {
              left: barcodeX,
              top: barcodeY - 16,
              fontSize: 10,
              fill: style.color,
              fontFamily: style.font,
              selectable: false,
              evented: false,
            })
          );

          const logoX = barcodeX + barcodeW + 20;
          const logoRightBound = back.x + back.w - 24;
          const logoTextW = Math.max(80, logoRightBound - logoX - 26);

          fabric.Image.fromURL("/figma/logo-group.svg", (logoImg) => {
            const s = 18 / (logoImg.width || 22);
            logoImg.set({ left: logoX, top: barcodeY - 2, scaleX: s, scaleY: s, selectable: false, evented: false });
            canvas.add(logoImg);
            canvas.add(
              new fabric.Text("ULIT", {
                left: logoX + 24,
                top: barcodeY - 3,
                fontSize: 13,
                fontWeight: "bold",
                fill: style.color,
                fontFamily: style.font,
                selectable: false,
                evented: false,
              })
            );
            canvas.add(
              new fabric.Textbox("Платформа самовидавництва для українських авторів", {
                left: logoX,
                top: barcodeY + 20,
                width: logoTextW,
                fontSize: 8,
                lineHeight: 1.25,
                fill: style.color,
                fontFamily: style.font,
                opacity: 0.85,
                selectable: false,
                evented: false,
                editable: false,
              })
            );
            canvas.renderAll();
          });

          canvas.renderAll();
        });
      }
    }
  }
}

export const TEMPLATES: Template[] = [
  {
    id: "classic",
    label: "Класик",
    thumbnail: "bg-gradient-to-b from-gray-900 to-gray-700",
    palette: ["#1a1a2e", "#16213e", "#0f172a", "#3b2f2f", "#1c1917"],
    apply(canvas, ctx) {
      canvas.clear();
      addAccentBg(canvas, ctx.layout, "#1a1a2e");
      const style = { font: "Georgia", titleColor: "#f5e6c8", authorColor: "#c9a96e", bandColor: "#000000", bandOpacity: 0.4 };
      drawFrontText(canvas, ctx.layout.front, ctx, style);
      drawBackAndSpine(canvas, ctx, { font: "Georgia", color: "#f5e6c8" });
    },
  },
  {
    id: "minimal",
    label: "Мінімал",
    thumbnail: "bg-white border border-gray-200",
    palette: ["#fafafa", "#f3f4f6", "#e5e7eb", "#ffffff", "#f5f5f4"],
    apply(canvas, ctx) {
      canvas.clear();
      addAccentBg(canvas, ctx.layout, "#fafafa");
      const style = { font: "Helvetica", titleColor: "#1a1a1a", authorColor: "#444444", bandColor: "#ffffff", bandOpacity: 0.8 };
      drawFrontText(canvas, ctx.layout.front, ctx, style);
      drawBackAndSpine(canvas, ctx, { font: "Helvetica", color: "#1a1a1a" });
    },
  },
  {
    id: "bold",
    label: "Яскравий",
    thumbnail: "bg-gradient-to-br from-orange-500 to-pink-600",
    palette: ["#f2542d", "#ec4899", "#f97316", "#db2777", "#ea580c"],
    apply(canvas, ctx) {
      canvas.clear();
      addAccentBg(canvas, ctx.layout, "#f2542d");
      const style = { font: "Arial", titleColor: "#ffffff", authorColor: "#ffffff", bandColor: "#000000", bandOpacity: 0.3 };
      drawFrontText(canvas, ctx.layout.front, ctx, style);
      drawBackAndSpine(canvas, ctx, { font: "Arial", color: "#ffffff" });
    },
  },
  {
    id: "dark-elegance",
    label: "Елегант",
    thumbnail: "bg-gradient-to-b from-slate-900 to-violet-950",
    palette: ["#241b40", "#0f0c29", "#302b63", "#1e1b4b", "#312e81"],
    apply(canvas, ctx) {
      canvas.clear();
      addAccentBg(canvas, ctx.layout, "#241b40");
      const style = { font: "Georgia", titleColor: "#e8d5b7", authorColor: "#a78bfa", bandColor: "#0f0c29", bandOpacity: 0.55 };
      drawFrontText(canvas, ctx.layout.front, ctx, style);
      drawBackAndSpine(canvas, ctx, { font: "Georgia", color: "#e8d5b7" });
    },
  },
  {
    id: "nature",
    label: "Природа",
    thumbnail: "bg-gradient-to-b from-emerald-800 to-teal-600",
    palette: ["#065f46", "#064e3b", "#047857", "#115e59", "#0f766e"],
    apply(canvas, ctx) {
      canvas.clear();
      addAccentBg(canvas, ctx.layout, "#065f46");
      const style = { font: "Georgia", titleColor: "#ecfdf5", authorColor: "#6ee7b7", bandColor: "#064e3b", bandOpacity: 0.45 };
      drawFrontText(canvas, ctx.layout.front, ctx, style);
      drawBackAndSpine(canvas, ctx, { font: "Georgia", color: "#ecfdf5" });
    },
  },
];

// ─── Patterns (self-authored, no external assets) ──────────────────────────

type PatternBuilder = (slot: PanelRect) => fabric.Object;

export const PATTERNS: { id: string; label: string; build: PatternBuilder }[] = [
  {
    id: "dots",
    label: "Крапки",
    build: (slot) => {
      const shapes: fabric.Object[] = [
        new fabric.Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, fill: "#1f2937" }),
      ];
      for (let y = slot.y + 10; y < slot.y + slot.h; y += 22) {
        for (let x = slot.x + 10; x < slot.x + slot.w; x += 22) {
          shapes.push(new fabric.Circle({ left: x, top: y, radius: 3, fill: "rgba(255,255,255,0.35)" }));
        }
      }
      return new fabric.Group(shapes);
    },
  },
  {
    id: "stripes",
    label: "Смуги",
    build: (slot) => {
      const shapes: fabric.Object[] = [
        new fabric.Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, fill: "#312e81" }),
      ];
      for (let x = slot.x - slot.h; x < slot.x + slot.w; x += 26) {
        shapes.push(
          new fabric.Line([x, slot.y, x + slot.h, slot.y + slot.h], { stroke: "rgba(255,255,255,0.12)", strokeWidth: 10 })
        );
      }
      return new fabric.Group(shapes);
    },
  },
  {
    id: "grid",
    label: "Сітка",
    build: (slot) => {
      const shapes: fabric.Object[] = [
        new fabric.Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, fill: "#0f172a" }),
      ];
      for (let x = slot.x; x < slot.x + slot.w; x += 24) {
        shapes.push(new fabric.Line([x, slot.y, x, slot.y + slot.h], { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }));
      }
      for (let y = slot.y; y < slot.y + slot.h; y += 24) {
        shapes.push(new fabric.Line([slot.x, y, slot.x + slot.w, y], { stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }));
      }
      return new fabric.Group(shapes);
    },
  },
  {
    id: "circles",
    label: "Кола",
    build: (slot) => {
      const shapes: fabric.Object[] = [
        new fabric.Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, fill: "#064e3b" }),
      ];
      for (let i = 0; i < 10; i++) {
        shapes.push(
          new fabric.Circle({
            left: slot.x + Math.random() * slot.w,
            top: slot.y + Math.random() * slot.h,
            radius: 20 + Math.random() * 50,
            fill: "rgba(255,255,255,0.05)",
          })
        );
      }
      return new fabric.Group(shapes);
    },
  },
];

// ─── Photo-slot helpers ─────────────────────────────────────────────────────

function replaceSlotObject(canvas: fabric.Canvas, obj: fabric.Object, slot: PanelRect) {
  obj.set({
    left: slot.x,
    top: slot.y,
    selectable: true,
    evented: true,
    lockUniScaling: true, // resize handles stay proportional — no stretching
    data: { role: "photo-slot" },
    // absolutePositioned clipPath is anchored to canvas coordinates, not the
    // object's own transform — so dragging/scaling the image inside it pans
    // and zooms (crops) without ever spilling outside the slot.
    clipPath: new fabric.Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, absolutePositioned: true }),
  });
  const existing = canvas.getObjects().find((o: any) => o.data?.role === "photo-slot");
  if (existing) canvas.remove(existing);
  canvas.add(obj);
  canvas.moveTo(obj, 1); // just above the accent background (index 0), below text
  canvas.renderAll();
}

// Background layers (accent color, bg-image) always sit contiguously at the
// bottom of the stack — everything else must stay above this floor so text
// and rects can never end up hidden behind the background.
function backgroundFloorIndex(canvas: fabric.Canvas): number {
  const objs = canvas.getObjects();
  let floor = 0;
  for (const o of objs) {
    const role = (o as any).data?.role;
    if (role === "accent" || role === "bg-image") floor++;
    else break;
  }
  return floor;
}

function applyImageToSlot(canvas: fabric.Canvas, url: string, slot: PanelRect) {
  const opts = url.startsWith("data:") ? undefined : { crossOrigin: "anonymous" as const };
  fabric.Image.fromURL(
    url,
    (img) => {
      const iw = img.width ?? slot.w;
      const ih = img.height ?? slot.h;
      const scale = Math.max(slot.w / iw, slot.h / ih);
      img.set({ originX: "left", originY: "top", scaleX: scale, scaleY: scale, left: slot.x - (iw * scale - slot.w) / 2, top: slot.y - (ih * scale - slot.h) / 2 });
      replaceSlotObject(canvas, img, slot);
    },
    opts
  );
}

// Full-bleed background image behind everything (bands, photo-slot, text) —
// locked in place (not selectable), so it can't be accidentally dragged like
// the front-panel illustration can. Spans the whole canvas (back+spine+front)
// the same way the solid accent color does.
function applyBackgroundImage(canvas: fabric.Canvas, layout: CoverLayout, url: string) {
  const opts = url.startsWith("data:") ? undefined : { crossOrigin: "anonymous" as const };
  fabric.Image.fromURL(
    url,
    (img) => {
      const iw = img.width ?? layout.totalW;
      const ih = img.height ?? layout.totalH;
      const scale = Math.max(layout.totalW / iw, layout.totalH / ih);
      img.set({
        originX: "left",
        originY: "top",
        left: -((iw * scale - layout.totalW) / 2),
        top: -((ih * scale - layout.totalH) / 2),
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        data: { role: "bg-image" },
      });
      const existing = canvas.getObjects().find((o: any) => o.data?.role === "bg-image");
      if (existing) canvas.remove(existing);
      canvas.add(img);
      canvas.moveTo(img, 1); // above the solid accent color (index 0)
      canvas.renderAll();
    },
    opts
  );
}

// ─── Cross-format shared state (front / back+spine / background) ──────────

// Approximate "which panel is this object in" by its raw left coordinate —
// panels are 350px wide, objects don't straddle the boundary in practice, so
// this doesn't need origin-aware center-point math.
function isInFrontRange(left: number | undefined, layout: CoverLayout): boolean {
  const x = left ?? 0;
  return x >= layout.front.x - 0.01 && x < layout.front.x + layout.front.w;
}

// Splits a flat array of Fabric object JSON descriptors (background objects
// already excluded by the caller) into front vs back+spine buckets. Front
// positions come back relative to the front panel's own x-origin, since that
// offset differs between ebook (x=0) and print (x=DISPLAY_W+spineW) layouts —
// callers add the *current* format's front.x back on restore.
function splitObjectsByPanel(objects: any[], layout: CoverLayout) {
  const nonBg = objects.filter((o) => o.data?.role !== "accent" && o.data?.role !== "bg-image");
  const front = nonBg
    .filter((o) => isInFrontRange(o.left, layout))
    .map((o) => ({ ...o, left: (o.left ?? 0) - layout.front.x }));
  const backSpine = nonBg.filter((o) => !isInFrontRange(o.left, layout));
  return { front, backSpine };
}

// Draws the given template on an offscreen scratch canvas to get "fresh"
// front/back+spine object descriptors, for whichever panel isn't cached yet
// (first time a given format is visited this session) — avoids duplicating
// each template's font/color choices outside of its own apply() closure.
function buildFreshPanelObjects(ctx: TemplateCtx, template: Template, layout: CoverLayout) {
  const scratch = new fabric.StaticCanvas(undefined, { width: layout.totalW, height: layout.totalH });
  template.apply(scratch as unknown as fabric.Canvas, ctx);
  const all = ((scratch.toJSON(["data"]) as any).objects ?? []) as any[];
  scratch.dispose();
  return splitObjectsByPanel(all, layout);
}

// Regenerates the background (color + optional image) fresh at the current
// layout's dimensions — reuses addAccentBg/applyBackgroundImage, which are
// already parameterized by layout for exactly this reason, rather than
// trying to reposition/rescale a cached background object across formats.
function applyBackground(
  canvas: fabric.Canvas,
  layout: CoverLayout,
  bg: { color: string; imageUrl?: string } | null,
  fallbackColor: string
) {
  addAccentBg(canvas, layout, bg?.color ?? fallbackColor);
  const accent = canvas.getObjects().find((o: any) => o.data?.role === "accent");
  if (accent) canvas.sendToBack(accent);
  if (bg?.imageUrl) applyBackgroundImage(canvas, layout, bg.imageUrl);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  subtitle?: string | null;
  description?: string | null;
  authorBio?: string | null;
  isbn?: string | null;
  pageCount?: number | null;
  format: CoverFormat;
  existingCoverUrl?: string | null;
  coverImageLibrary?: { url: string; uploadedAt: string }[];
  onSaved: (patch: { coverUrl?: string; backCoverUrl?: string }) => void;
  onLibraryChange?: (library: { url: string; uploadedAt: string }[]) => void;
  token?: string;
}

export default function CoverDesignerCanvas({
  bookId,
  bookTitle,
  bookAuthor,
  subtitle,
  description,
  authorBio,
  isbn,
  pageCount,
  format,
  coverImageLibrary = [],
  onSaved,
  onLibraryChange,
  token,
}: Props) {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const ownCoverInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const prevFormatRef = useRef<CoverFormat>(format);
  // Front design (image/title/author/subtitle/band) is ONE shared entity
  // across all three formats; back+spine (blurb/bio/spine-label/barcode) is
  // shared between softcover/hardcover only (ebook has no back). Both are
  // cached as plain object-descriptor arrays (Fabric's own toJSON shape per
  // object), positions for front stored relative to the front panel's own
  // x-origin since that offset differs between ebook (x=0) and print
  // (x=DISPLAY_W+spineW). Background (accent color + optional image) is
  // tracked separately as a plain value, not Fabric JSON, and regenerated
  // fresh at whatever the current format's dimensions are — reusing
  // addAccentBg/applyBackgroundImage, which are already parameterized by
  // layout for exactly this reason.
  const frontStateRef = useRef<any[] | null>(null);
  const backSpineStateRef = useRef<any[] | null>(null);
  const backgroundRef = useRef<{ color: string; imageUrl?: string } | null>(null);
  const pauseHistoryRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeTab, setActiveTab] = useState<"templates" | "own">("templates");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [ownCoverError, setOwnCoverError] = useState("");
  const [ownCoverDims, setOwnCoverDims] = useState<{ w: number; h: number } | null>(null);
  const [activeObj, setActiveObj] = useState<fabric.Object | null>(null);

  const ctx: TemplateCtx = useMemo(
    () => ({
      layout: computeCoverLayout(format, pageCount),
      title: bookTitle,
      author: bookAuthor,
      subtitle: subtitle || undefined,
      description: description || undefined,
      bio: authorBio || undefined,
      isbn,
    }),
    [format, pageCount, bookTitle, bookAuthor, subtitle, description, authorBio, isbn]
  );

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  const templateIndex = TEMPLATES.findIndex((t) => t.id === template.id);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || pauseHistoryRef.current) return;
    const json = JSON.stringify(canvas.toJSON(["data"]));
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  // Init canvas once
  useEffect(() => {
    if (!canvasEl.current) return;
    const canvas = new fabric.Canvas(canvasEl.current, { width: ctx.layout.totalW, height: ctx.layout.totalH });
    canvasRef.current = canvas;

    canvas.on("object:added", saveSnapshot);
    canvas.on("object:removed", saveSnapshot);
    canvas.on("object:modified", saveSnapshot);
    canvas.on("selection:created", (e) => setActiveObj(e.selected?.[0] ?? null));
    canvas.on("selection:updated", (e) => setActiveObj(e.selected?.[0] ?? null));
    canvas.on("selection:cleared", () => setActiveObj(null));

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); undoCanvas(); }
        if (e.key === "y") { e.preventDefault(); redoCanvas(); }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvas.getActiveObject() as any;
        if (!active || active.isEditing) return; // let text editing handle its own backspace
        e.preventDefault();
        canvas.getActiveObjects().forEach((obj) => {
          const role = (obj as any).data?.role;
          if (role === "accent" || role === "bg-image") return; // background isn't deletable
          canvas.remove(obj);
        });
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    };
    window.addEventListener("keydown", onKey);

    template.apply(canvas, ctx);
    canvas.renderAll();
    historyRef.current = [];
    historyIndexRef.current = -1;
    saveSnapshot();

    const initAccent = canvas.getObjects().find((o: any) => o.data?.role === "accent") as any;
    backgroundRef.current = { color: (initAccent?.fill as string) ?? "#1a1a2e" };

    return () => {
      window.removeEventListener("keydown", onKey);
      canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize whenever format/pageCount changes the layout. Only rebuild content
  // when the FORMAT itself actually changed. The front panel (image/title/
  // author/subtitle/band) is ONE shared design across all three formats; the
  // back+spine panel (blurb/bio/spine-label/barcode) is shared between
  // М'яка/Тверда; the background (color + optional image) is shared
  // everywhere. Previously this unconditionally re-ran template.apply() (or,
  // briefly today, cached a whole canvas PER format) — neither preserved the
  // "edit the front once, it shows up everywhere" requirement; switching away
  // from a format and back silently lost or diverged its design.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const formatChanged = prevFormatRef.current !== format;

    if (formatChanged) {
      const leavingLayout = computeCoverLayout(prevFormatRef.current, pageCount);
      const currentObjects = ((canvas.toJSON(["data"]) as any).objects ?? []) as any[];
      const { front, backSpine } = splitObjectsByPanel(currentObjects, leavingLayout);
      frontStateRef.current = front;
      if (leavingLayout.back) backSpineStateRef.current = backSpine;

      const accent = currentObjects.find((o: any) => o.data?.role === "accent") as any;
      const bgImage = currentObjects.find((o: any) => o.data?.role === "bg-image") as any;
      backgroundRef.current = {
        color: (accent?.fill as string) ?? backgroundRef.current?.color ?? "#1a1a2e",
        imageUrl: (bgImage?.src as string) ?? undefined,
      };
    }

    canvas.setWidth(ctx.layout.totalW);
    canvas.setHeight(ctx.layout.totalH);

    if (formatChanged) {
      pauseHistoryRef.current = true;

      const needFresh = !frontStateRef.current || (!!ctx.layout.back && !backSpineStateRef.current);
      const fresh = needFresh ? buildFreshPanelObjects(ctx, template, ctx.layout) : null;

      const frontRelative = frontStateRef.current ?? fresh!.front;
      const frontObjs = frontRelative.map((o: any) => ({ ...o, left: (o.left ?? 0) + ctx.layout.front.x }));
      const backSpineObjs = ctx.layout.back ? (backSpineStateRef.current ?? fresh!.backSpine) : [];

      canvas.loadFromJSON(JSON.stringify({ objects: [...frontObjs, ...backSpineObjs] }), () => {
        applyBackground(canvas, ctx.layout, backgroundRef.current, "#1a1a2e");
        canvas.renderAll();
        pauseHistoryRef.current = false;
        historyRef.current = [];
        historyIndexRef.current = -1;
        saveSnapshot();
      });
    } else {
      canvas.renderAll();
    }

    prevFormatRef.current = format;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.layout.totalW, ctx.layout.totalH, format]);

  const undoCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const json = historyRef.current[historyIndexRef.current];
    pauseHistoryRef.current = true;
    canvas.loadFromJSON(json, () => {
      canvas.renderAll();
      pauseHistoryRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
    });
  }, []);

  const redoCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const json = historyRef.current[historyIndexRef.current];
    pauseHistoryRef.current = true;
    canvas.loadFromJSON(json, () => {
      canvas.renderAll();
      pauseHistoryRef.current = false;
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  const applyTemplate = useCallback(
    (tpl: Template) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setTemplateId(tpl.id);
      tpl.apply(canvas, ctx);
      canvas.renderAll();
      const accent = canvas.getObjects().find((o: any) => o.data?.role === "accent") as any;
      backgroundRef.current = { color: (accent?.fill as string) ?? "#1a1a2e" };
    },
    [ctx]
  );

  const updateSelected = useCallback((patch: Record<string, unknown>) => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    obj.set(patch);
    canvas.renderAll();
    setActiveObj(obj);
  }, []);

  const toggleTextStyle = useCallback(
    (key: "fontWeight" | "fontStyle" | "underline") => {
      const canvas = canvasRef.current;
      const obj = canvas?.getActiveObject() as fabric.IText | undefined;
      if (!obj) return;
      if (key === "underline") {
        updateSelected({ underline: !obj.underline });
      } else if (key === "fontWeight") {
        updateSelected({ fontWeight: obj.fontWeight === "bold" ? "normal" : "bold" });
      } else {
        updateSelected({ fontStyle: obj.fontStyle === "italic" ? "normal" : "italic" });
      }
    },
    [updateSelected]
  );

  const panelForObject = useCallback(
    (obj: fabric.Object): PanelRect => {
      const center = obj.getCenterPoint();
      const panels = [ctx.layout.front, ctx.layout.back, ctx.layout.spine].filter((p): p is PanelRect => !!p);
      return panels.find((p) => center.x >= p.x && center.x <= p.x + p.w) ?? ctx.layout.front;
    },
    [ctx.layout]
  );

  const alignSelected = useCallback(
    (mode: "left" | "center" | "right") => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objs = canvas.getActiveObjects();
      if (objs.length === 0) return;
      objs.forEach((obj) => {
        const panel = panelForObject(obj);
        const w = obj.getScaledWidth();
        if (mode === "left") {
          obj.set({ originX: "left", left: panel.x + SAFE_MARGIN });
        } else if (mode === "right") {
          obj.set({ originX: "left", left: panel.x + panel.w - SAFE_MARGIN - w });
        } else {
          obj.set({ originX: "center", left: panel.x + panel.w / 2 });
        }
        obj.setCoords();
      });
      canvas.requestRenderAll();
      saveSnapshot();
    },
    [panelForObject, saveSnapshot]
  );

  const changeLayer = useCallback(
    (action: "front" | "back" | "forward" | "backward") => {
      const canvas = canvasRef.current;
      const obj = canvas?.getActiveObject();
      if (!canvas || !obj) return;
      const role = (obj as any).data?.role;
      if (role === "accent" || role === "bg-image") return; // background isn't reorderable

      const floor = backgroundFloorIndex(canvas);
      if (action === "front") {
        canvas.bringToFront(obj);
      } else if (action === "back") {
        canvas.moveTo(obj, floor); // stop just above the background, never behind it
      } else if (action === "forward") {
        canvas.bringForward(obj);
      } else if (canvas.getObjects().indexOf(obj) > floor) {
        canvas.sendBackwards(obj);
      }
      canvas.requestRenderAll();
      saveSnapshot();
    },
    [saveSnapshot]
  );

  const recolor = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach((o: any) => {
      if (o.data?.role === "accent") o.set("fill", color);
    });
    canvas.renderAll();
  }, []);

  const applyRandomPattern = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const group = pattern.build(ctx.layout.front);
    replaceSlotObject(canvas, group, ctx.layout.front);
  }, [ctx.layout.front]);

  const uploadAndApplyImage = useCallback(
    async (file: File, target: "slot" | "background" = "slot") => {
      if (!token) return;
      target === "background" ? setUploadingBg(true) : setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/books/${bookId}/cover-images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Upload failed");
        const { library } = await res.json();
        onLibraryChange?.(library);
        const url = library[library.length - 1]?.url;
        const canvas = canvasRef.current;
        if (url && canvas) {
          if (target === "background") applyBackgroundImage(canvas, ctx.layout, url);
          else applyImageToSlot(canvas, url, ctx.layout.front);
        }
      } catch (e: any) {
        setSaveError(e.message || "Не вдалося завантажити зображення");
      } finally {
        target === "background" ? setUploadingBg(false) : setUploading(false);
      }
    },
    [bookId, token, ctx.layout, onLibraryChange]
  );

  const removeLibraryImage = useCallback(
    async (url: string) => {
      if (!token) return;
      try {
        const res = await fetch(`/api/books/${bookId}/cover-images?url=${encodeURIComponent(url)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { library } = await res.json();
        onLibraryChange?.(library);
      } catch {
        // best-effort — leave the library as-is on failure
      }
    },
    [bookId, token, onLibraryChange]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) uploadAndApplyImage(file, "slot");
    },
    [uploadAndApplyImage]
  );

  const handleBgFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) uploadAndApplyImage(file, "background");
    },
    [uploadAndApplyImage]
  );

  // T-1926 — self-uploaded ready-made cover replaces the whole front panel.
  const handleOwnCoverUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setOwnCoverError("");
      setOwnCoverDims(null);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
          setOwnCoverDims({ w: img.naturalWidth, h: img.naturalHeight });
          if (img.naturalWidth < OWN_COVER_MIN_W || img.naturalHeight < OWN_COVER_MIN_H) {
            setOwnCoverError(
              `Зображення ${img.naturalWidth}×${img.naturalHeight}px — менше мінімуму ${OWN_COVER_MIN_W}×${OWN_COVER_MIN_H}px (150 DPI). Завантажте зображення більшого розміру.`
            );
            return;
          }
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.clear();
          fabric.Image.fromURL(dataUrl, (fabricImg) => {
            const front = ctx.layout.front;
            const scaleX = ctx.layout.totalW / (fabricImg.width ?? ctx.layout.totalW);
            const scaleY = ctx.layout.totalH / (fabricImg.height ?? ctx.layout.totalH);
            const scale = Math.max(scaleX, scaleY);
            fabricImg.set({
              left: 0,
              top: 0,
              scaleX: scale,
              scaleY: scale,
              selectable: false,
              evented: false,
              data: { role: "accent" },
            });
            canvas.add(fabricImg);
            canvas.renderAll();
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [ctx.layout]
  );

  // ── Export & save ────────────────────────────────────────────────────────

  const uploadPanel = useCallback(
    async (dataUrl: string, endpoint: string, field: "coverUrl" | "backCoverUrl") => {
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.append("file", blob, `${field}.png`);
      const res = await fetch(`/api/books/${bookId}/${endpoint}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Upload failed");
      const body = await res.json();
      const url = body[field] as string;
      return `${url.split("?")[0]}?t=${Date.now()}`;
    },
    [bookId, token]
  );

  const saveToBook = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setSaveError("");
    try {
      const { front, back } = ctx.layout;
      const patch: { coverUrl?: string; backCoverUrl?: string } = {};

      const frontDataUrl = canvas.toDataURL({
        format: "png",
        multiplier: EXPORT_SCALE,
        left: front.x,
        top: front.y,
        width: front.w,
        height: front.h,
      });
      patch.coverUrl = await uploadPanel(frontDataUrl, "upload-cover", "coverUrl");

      if (back) {
        const backDataUrl = canvas.toDataURL({
          format: "png",
          multiplier: EXPORT_SCALE,
          left: back.x,
          top: back.y,
          width: back.w,
          height: back.h,
        });
        patch.backCoverUrl = await uploadPanel(backDataUrl, "upload-back-cover", "backCoverUrl");
      }

      onSaved(patch);
    } catch (e: any) {
      setSaveError(e.message || "Помилка збереження обкладинки");
    } finally {
      setSaving(false);
    }
  }, [ctx.layout, uploadPanel, onSaved]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Canvas */}
      <div className="flex flex-1 min-w-0 flex-col items-center gap-3">
        <div className="max-w-full overflow-x-auto rounded-lg border-2 border-gray-200 shadow-md">
          <canvas ref={canvasEl} />
        </div>
        <p className="text-xs text-gray-400">Клікніть на назву, підзаголовок, автора чи анотацію, щоб редагувати текст прямо на обкладинці</p>

        {activeObj?.type === "textbox" && (
          <div className="flex w-full max-w-xs items-center justify-center gap-1 rounded-lg border bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => toggleTextStyle("fontWeight")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="Жирний"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => toggleTextStyle("fontStyle")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="Курсив"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onClick={() => toggleTextStyle("underline")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="Підкреслення"
            >
              <Underline size={15} />
            </button>
            <div className="mx-1 h-5 w-px bg-gray-300" />
            <button
              type="button"
              onClick={() => updateSelected({ textAlign: "left" })}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="По лівому краю"
            >
              <AlignLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => updateSelected({ textAlign: "center" })}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="По центру"
            >
              <AlignCenter size={15} />
            </button>
            <button
              type="button"
              onClick={() => updateSelected({ textAlign: "right" })}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="По правому краю"
            >
              <AlignRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => updateSelected({ textAlign: "justify" })}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="На всю ширину"
            >
              <AlignJustify size={15} />
            </button>
          </div>
        )}

        {activeObj?.type === "textbox" && (
          <div className="flex w-full max-w-xs items-center gap-2">
            <select
              value={(activeObj as fabric.Textbox).fontFamily || FONTS[0]}
              onChange={(e) => updateSelected({ fontFamily: e.target.value })}
              className="h-7 flex-1 rounded border border-gray-200 bg-white px-1.5 text-xs"
              title="Шрифт"
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <input
              type="color"
              value={typeof (activeObj as any)?.fill === "string" ? ((activeObj as any).fill as string) : "#000000"}
              onChange={(e) => updateSelected({ fill: e.target.value })}
              className="h-7 w-9 shrink-0 cursor-pointer rounded border border-gray-200"
              title="Колір тексту"
            />
          </div>
        )}

        {(activeObj as any)?.data?.role === "band" && (
          <div className="flex w-full max-w-xs items-center gap-3 rounded-lg border bg-gray-50 p-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Колір</label>
              <input
                type="color"
                value={typeof (activeObj as any)?.fill === "string" ? ((activeObj as any).fill as string) : "#000000"}
                onChange={(e) => updateSelected({ fill: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border"
              />
            </div>
            <div className="flex flex-1 items-center gap-1.5">
              <label className="shrink-0 text-xs text-gray-500">Прозорість</label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((activeObj?.opacity ?? 1) * 100)}
                onChange={(e) => updateSelected({ opacity: Number(e.target.value) / 100 })}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {activeObj && (
          <div className="flex w-full max-w-xs items-center justify-center gap-1 rounded-lg border bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => alignSelected("left")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="До безпечної зони ліворуч"
            >
              <AlignHorizontalJustifyStart size={15} />
            </button>
            <button
              type="button"
              onClick={() => alignSelected("center")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="По центру сторінки"
            >
              <AlignHorizontalJustifyCenter size={15} />
            </button>
            <button
              type="button"
              onClick={() => alignSelected("right")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="До безпечної зони праворуч"
            >
              <AlignHorizontalJustifyEnd size={15} />
            </button>
            <div className="mx-1 h-5 w-px bg-gray-300" />
            <button
              type="button"
              onClick={() => changeLayer("front")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="На передній план"
            >
              ⤒
            </button>
            <button
              type="button"
              onClick={() => changeLayer("forward")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="Перемістити вище"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => changeLayer("backward")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="Перемістити нижче"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => changeLayer("back")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="На задній план"
            >
              ⤓
            </button>
          </div>
        )}

        <div className="flex w-full max-w-xs gap-2">
          <Button variant="outline" size="sm" onClick={undoCanvas} disabled={!canUndo} className="flex-1" title="Скасувати (Ctrl+Z)">
            ↩ Undo
          </Button>
          <Button variant="outline" size="sm" onClick={redoCanvas} disabled={!canRedo} className="flex-1" title="Повторити (Ctrl+Y)">
            ↪ Redo
          </Button>
        </div>
        <Button onClick={saveToBook} loading={saving} className="w-full max-w-xs">
          Зберегти обкладинку
        </Button>
        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      </div>

      {/* Right panel */}
      <div className="w-full space-y-4 lg:w-[300px] lg:shrink-0">
        <div className="flex gap-1 rounded-lg border p-1 bg-gray-50">
          {(["templates", "own"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === "templates" ? "Шаблони" : "Своя обкладинка"}
            </button>
          ))}
        </div>

        {activeTab === "templates" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => applyTemplate(TEMPLATES[(templateIndex - 1 + TEMPLATES.length) % TEMPLATES.length])}
                className="text-gray-400 hover:text-gray-900"
                aria-label="Попередній шаблон"
              >
                ‹
              </button>
              <div className="flex flex-col items-center gap-1">
                <div className={cn("h-24 w-16 rounded border-2 border-primary", template.thumbnail)} />
                <span className="text-xs font-medium text-gray-700">{template.label}</span>
              </div>
              <button
                type="button"
                onClick={() => applyTemplate(TEMPLATES[(templateIndex + 1) % TEMPLATES.length])}
                className="text-gray-400 hover:text-gray-900"
                aria-label="Наступний шаблон"
              >
                ›
              </button>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAllTemplates(true)}>
              ▦ Список усіх макетів
            </Button>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <Button size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} loading={uploading}>
              Завантажити ілюстрацію
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={applyRandomPattern}>
              Випадковий паттерн
            </Button>

            {coverImageLibrary.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">Раніше завантажені зображення</p>
                <div className="flex flex-wrap gap-1.5">
                  {coverImageLibrary.map((img) => (
                    <div key={img.url} className="group relative h-12 w-12 overflow-hidden rounded border">
                      <button
                        type="button"
                        onClick={() => {
                          const canvas = canvasRef.current;
                          if (canvas) applyImageToSlot(canvas, img.url, ctx.layout.front);
                        }}
                        className="h-full w-full"
                      >
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLibraryImage(img.url)}
                        className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Видалити"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Колір фону</p>
              <div className="flex flex-wrap gap-1.5">
                {template.palette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => recolor(color)}
                    style={{ backgroundColor: color }}
                    className="h-6 w-6 rounded border border-gray-300"
                    aria-label={color}
                  />
                ))}
                <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-gray-300 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
                  <input type="color" onChange={(e) => recolor(e.target.value)} className="h-0 w-0 opacity-0" />
                </label>
              </div>
            </div>

            <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgFileUpload} />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => bgFileInputRef.current?.click()}
              loading={uploadingBg}
            >
              Завантажити зображення для фону
            </Button>
          </div>
        )}

        {activeTab === "own" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Завантажте готову обкладинку цілком — вона замінить усе на канві. Мінімум {OWN_COVER_MIN_W}×{OWN_COVER_MIN_H}px (150 DPI).
            </p>
            <input ref={ownCoverInputRef} type="file" accept="image/*" className="hidden" onChange={handleOwnCoverUpload} />
            <button
              type="button"
              onClick={() => ownCoverInputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 py-6 text-center hover:border-gray-400 transition-colors"
            >
              <p className="text-sm text-gray-600">Перетягніть зображення або натисніть для вибору</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG</p>
            </button>
            {ownCoverDims && !ownCoverError && (
              <p className="text-xs text-green-600">✓ {ownCoverDims.w}×{ownCoverDims.h}px — застосовано на канву</p>
            )}
            {ownCoverError && <p className="text-xs text-red-500">{ownCoverError}</p>}

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Редагувати офлайн у Photoshop</p>
              <p className="text-xs text-gray-400">
                PSD-шаблони з полями обрізу (bleed) та safe zone для поліграфії. Готуються — з'являться найближчим часом.
              </p>
              <Button size="sm" variant="outline" disabled className="w-full text-xs cursor-not-allowed">
                Завантажити PSD-шаблон (м'яка обкладинка)
              </Button>
              <Button size="sm" variant="outline" disabled className="w-full text-xs cursor-not-allowed">
                Завантажити PSD-шаблон (тверда обкладинка)
              </Button>
            </div>
          </div>
        )}
      </div>

      {showAllTemplates && (
        <CoverTemplatesModal
          templates={TEMPLATES}
          selectedId={template.id}
          onSelect={(tpl) => {
            applyTemplate(tpl);
            setShowAllTemplates(false);
          }}
          onClose={() => setShowAllTemplates(false)}
        />
      )}
    </div>
  );
}
