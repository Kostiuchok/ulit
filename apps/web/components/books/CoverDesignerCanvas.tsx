"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { fabric } from "fabric";
import JsBarcode from "jsbarcode";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  CaseUpper,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
} from "lucide-react";
import { PRINT_TRIM_SIZE_MM } from "shared-types";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { CoverTemplatesModal } from "./CoverTemplatesModal";

// Front-panel display vs export -- geometry derived from the BOOK's actual
// print trim size (trimMm prop, resolveBookPrintFormat in shared-types;
// falls back to the platform default PRINT_TRIM_SIZE_MM only when the book
// has none yet). DISPLAY_W is a fixed UI pixel anchor representing whatever
// the current trimMm's widthMm is; every other geometry constant below is
// derived from that per-book trim, not a fixed mm size, since trim ratios
// genuinely vary (pocket ~0.605 to large ~0.759) and previously every
// book's cover was designed/exported at the same fixed ratio regardless.
const DISPLAY_W = 350;
const EXPORT_DPI = 300;
// T-1926 — minimum accepted size for a self-uploaded cover (matches print requirements: 150 DPI)
const OWN_COVER_MIN_DPI = 150;

function deriveGeometry(trimMm: { widthMm: number; heightMm: number }) {
  const displayH = Math.round(DISPLAY_W * (trimMm.heightMm / trimMm.widthMm));
  const exportTargetW = Math.round((trimMm.widthMm / 25.4) * EXPORT_DPI);
  const exportScale = exportTargetW / DISPLAY_W;
  const ownCoverMinW = Math.round((trimMm.widthMm / 25.4) * OWN_COVER_MIN_DPI);
  const ownCoverMinH = Math.round((trimMm.heightMm / 25.4) * OWN_COVER_MIN_DPI);
  // DISPLAY_W represents trimMm.widthMm -- used to convert a real-world
  // spine thickness (mm) into display px.
  const pxPerMm = DISPLAY_W / trimMm.widthMm;
  return { displayW: DISPLAY_W, displayH, exportScale, ownCoverMinW, ownCoverMinH, pxPerMm };
}

// Inset from a panel's raw edge for "safe zone" alignment — keeps text clear
// of the trim/bleed area near the physical edge of a printed cover.
const SAFE_MARGIN = 24;

// Standard system fonts only — rendered by the viewer's own browser/OS (like
// any CSS font-family), never embedded/redistributed as a file, so this
// carries no font-licensing risk. All have solid Cyrillic coverage.
const FONTS = ["Georgia", "Arial", "Helvetica", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New"];

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

function computeSpineWidthPx(format: CoverFormat, pageCount: number | null | undefined, pxPerMm: number): number {
  const pages = pageCount && pageCount > 0 ? pageCount : DEFAULT_PAGE_COUNT;
  const spineMm = pages * 0.1 + (format === "hardcover" ? 4 : 0);
  return Math.max(6, Math.round(spineMm * pxPerMm));
}

export function computeCoverLayout(
  format: CoverFormat,
  pageCount?: number | null,
  trimMm: { widthMm: number; heightMm: number } = PRINT_TRIM_SIZE_MM
): CoverLayout {
  const { displayH: DISPLAY_H, pxPerMm } = deriveGeometry(trimMm);
  if (format === "ebook") {
    return { format, totalW: DISPLAY_W, totalH: DISPLAY_H, front: { x: 0, y: 0, w: DISPLAY_W, h: DISPLAY_H } };
  }
  const spineW = computeSpineWidthPx(format, pageCount, pxPerMm);
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

// T-2067 follow-up -- fabric.Image.fromURL() is async; if the canvas backing
// it is disposed (component unmount, or the offscreen scratch canvas in
// buildFreshPanelObjects being disposed synchronously right after
// template.apply() schedules these loads) before the image finishes loading,
// its resolved callback still fires and touching the canvas (add/renderAll)
// crashes deep in Fabric internals (clearContext on a null context, same
// root cause the loadFromJSON call sites were already guarded against).
// getContext() is public Fabric API returning contextContainer, which
// dispose() nulls out -- reliable disposal signal without reaching into
// version-specific internals.
function isCanvasDisposed(canvas: fabric.Canvas): boolean {
  return !canvas.getContext();
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
          if (isCanvasDisposed(canvas)) return;
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
            if (isCanvasDisposed(canvas)) return;
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

// Three independent background layers, bottom to top: solid accent color,
// then an optional pattern, then an optional photo (either the front-panel
// illustration slot or the separately-uploaded background photo -- both are
// "the image" from the author's point of view, illustration just wins the
// tie since it's the more deliberate choice). Each role is optional; any
// combination can be present simultaneously. normalizeBackgroundStack pins
// whichever of these exist to indices 0..n-1 in this order, leaving every
// other object's relative order above them untouched.
const BACKGROUND_LAYER_ORDER = ["accent", "pattern", "bg-image", "photo-slot"] as const;

function normalizeBackgroundStack(canvas: fabric.Canvas) {
  const objs = canvas.getObjects();
  let idx = 0;
  for (const role of BACKGROUND_LAYER_ORDER) {
    const obj = objs.find((o: any) => o.data?.role === role);
    if (obj) canvas.moveTo(obj, idx++);
  }
}

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
  normalizeBackgroundStack(canvas);
  canvas.renderAll();
}

function replacePatternObject(canvas: fabric.Canvas, group: fabric.Object) {
  group.set({ selectable: false, evented: false, data: { role: "pattern" } });
  const existing = canvas.getObjects().find((o: any) => o.data?.role === "pattern");
  if (existing) canvas.remove(existing);
  canvas.add(group);
  normalizeBackgroundStack(canvas);
  canvas.renderAll();
}

function removeBackgroundLayer(canvas: fabric.Canvas, role: "pattern" | "bg-image") {
  const obj = canvas.getObjects().find((o: any) => o.data?.role === role);
  if (obj) canvas.remove(obj);
  canvas.renderAll();
}

// Background layers (accent color, pattern, bg-image, photo-slot) always sit
// contiguously at the bottom of the stack — everything else must stay above
// this floor so text and rects can never end up hidden behind the
// background.
function backgroundFloorIndex(canvas: fabric.Canvas): number {
  const objs = canvas.getObjects();
  let floor = 0;
  for (const o of objs) {
    const role = (o as any).data?.role;
    if ((BACKGROUND_LAYER_ORDER as readonly string[]).includes(role)) floor++;
    else break;
  }
  return floor;
}

function applyImageToSlot(canvas: fabric.Canvas, url: string, slot: PanelRect) {
  const opts = url.startsWith("data:") ? undefined : { crossOrigin: "anonymous" as const };
  fabric.Image.fromURL(
    url,
    (img) => {
      if (isCanvasDisposed(canvas)) return;
      const iw = img.width ?? slot.w;
      const ih = img.height ?? slot.h;
      const scale = Math.max(slot.w / iw, slot.h / ih);
      img.set({ originX: "left", originY: "top", scaleX: scale, scaleY: scale, left: slot.x - (iw * scale - slot.w) / 2, top: slot.y - (ih * scale - slot.h) / 2 });
      replaceSlotObject(canvas, img, slot);
    },
    opts
  );
}

// Background image behind the front panel only (bands, photo-slot, text) —
// locked in place (not selectable), so it can't be accidentally dragged like
// the front-panel illustration can. For ebook layouts the front panel IS the
// whole canvas, so this covers everything same as before; for softcover/
// hardcover it's clipped to the front panel (x=front.x..front.x+front.w) so
// it doesn't bleed onto the spine/back — those keep only the solid accent
// color (still full-width, drawn separately by addAccentBg) plus whatever
// text the author places there. Uploading a cover photo is meant to dress up
// the e-book/print-front face, not double as full print-wrap art.
function applyBackgroundImage(canvas: fabric.Canvas, layout: CoverLayout, url: string) {
  const { front } = layout;
  const opts = url.startsWith("data:") ? undefined : { crossOrigin: "anonymous" as const };
  fabric.Image.fromURL(
    url,
    (img) => {
      if (isCanvasDisposed(canvas)) return;
      const iw = img.width ?? front.w;
      const ih = img.height ?? front.h;
      const scale = Math.max(front.w / iw, front.h / ih);
      img.set({
        originX: "left",
        originY: "top",
        left: front.x - (iw * scale - front.w) / 2,
        top: front.y - (ih * scale - front.h) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        data: { role: "bg-image" },
        clipPath: new fabric.Rect({ left: front.x, top: front.y, width: front.w, height: front.h, absolutePositioned: true }),
      });
      const existing = canvas.getObjects().find((o: any) => o.data?.role === "bg-image");
      if (existing) canvas.remove(existing);
      canvas.add(img);
      normalizeBackgroundStack(canvas);
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

// Roles are classified primarily by their semantic `data.role` tag, not by
// raw canvas position — the "photo-slot" illustration can be freely panned
// and zoomed by the author inside its locked clipPath crop, which can push
// its actual Fabric `.left` far outside the visible front-panel x-range even
// though it still renders cropped-and-correct on screen. Classifying it (and
// every other system-drawn role) by position caused it to intermittently get
// bucketed into back+spine instead of front, which is what desynced the
// front/back/dashboard covers. Position is only used as a fallback for
// objects with no recognized role, e.g. extra images/text the author added
// freely with no fixed "panel" of their own.
const FRONT_ROLES = new Set(["text-title", "text-subtitle", "text-author", "band", "photo-slot"]);
const BACK_SPINE_ROLES = new Set(["text-blurb", "text-bio", "text-spine", "barcode"]);

// Splits a flat array of Fabric object JSON descriptors (background objects
// already excluded by the caller) into front vs back+spine buckets. Front
// positions come back relative to the front panel's own x-origin, since that
// offset differs between ebook (x=0) and print (x=DISPLAY_W+spineW) layouts —
// callers add the *current* format's front.x back on restore.
function splitObjectsByPanel(objects: any[], layout: CoverLayout) {
  const nonBg = objects.filter((o) => o.data?.role !== "accent" && o.data?.role !== "bg-image");
  const isFront = (o: any) => {
    const role = o.data?.role;
    if (role && FRONT_ROLES.has(role)) return true;
    if (role && BACK_SPINE_ROLES.has(role)) return false;
    return isInFrontRange(o.left, layout);
  };
  const front = nonBg
    .filter(isFront)
    .map((o) => ({ ...o, left: (o.left ?? 0) - layout.front.x }));
  const backSpine = nonBg.filter((o) => !isFront(o));
  return { front, backSpine };
}

// Restores front-panel objects (front-relative left, from splitObjectsByPanel
// or a saved template) onto the CURRENT format's front panel. A "photo-slot"
// illustration (and any other front object with a lockUniScaling crop
// clipPath, e.g. a future front-only overlay) carries an absolutePositioned
// clipPath rect that was frozen at whichever format's front-panel coordinates
// were active when it was captured/serialized — shifting only `.left` left
// the clip window itself stale. Since ebook's front panel and print's BACK
// panel happen to share the exact same rect ({x:0,y:0,w:DISPLAY_W,h:DISPLAY_H}),
// a stale clip window silently coincided with the back panel instead of
// clipping to nothing — the illustration then rendered wherever its own
// (correctly repositioned) pixels happened to fall relative to that stale
// window, which is why it visually ended up looking like it was on the back
// panel (or hidden behind the background) after switching format/reloading a
// saved design. The background-image layer never had this bug because it's
// excluded from this front/backSpine split entirely and gets its clipPath
// rebuilt from scratch every time via applyBackground/applyBackgroundImage.
function repositionFrontObjects(objs: any[], front: PanelRect): any[] {
  return objs.map((o) => {
    const repositioned = { ...o, left: (o.left ?? 0) + front.x };
    if (o.clipPath) {
      repositioned.clipPath = { ...o.clipPath, left: front.x, top: front.y, width: front.w, height: front.h };
    }
    return repositioned;
  });
}

// Snapshots what should be persisted as the book's editable cover design.
// Front and background always exist in the current live canvas regardless of
// format, so they're read live; back+spine only exists in print layouts —
// when saving from ebook (no back panel on canvas at all), fall back to
// whatever back+spine was last cached this session instead of persisting an
// empty back+spine and losing it.
// updateSelected/toggleAllCaps/toggleTextShadow/updateTextShadow all mutate
// the active fabric.Object in place (fabric has no immutable-update API) and
// hand the *same* reference back to setActiveObj. React's useState bails out
// on a same-reference update, so sidebar controls bound to activeObj (e.g.
// the stroke-width range input's `value`) never re-rendered -- the canvas
// visibly updated (fabric's own renderAll, independent of React) but the
// slider thumb stayed frozen. Cloning the reference (prototype preserved, so
// .type / property reads still behave the same) gives React something new
// to diff against.
function touchActiveObj<T extends object>(obj: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
}

function captureDesignState(canvas: fabric.Canvas, layout: CoverLayout, cachedBackSpine: any[] | null) {
  const currentObjects = ((canvas.toJSON(["data"]) as any).objects ?? []) as any[];
  const { front, backSpine: liveBackSpine } = splitObjectsByPanel(currentObjects, layout);
  const backSpine = layout.back ? liveBackSpine : (cachedBackSpine ?? []);
  const accent = currentObjects.find((o: any) => o.data?.role === "accent") as any;
  const bgImage = currentObjects.find((o: any) => o.data?.role === "bg-image") as any;
  const background = {
    color: (accent?.fill as string) ?? "#1a1a2e",
    imageUrl: (bgImage?.src as string) ?? undefined,
  };
  return { front, backSpine, background };
}

// Draws the given template on an offscreen scratch canvas to get "fresh"
// front/back+spine object descriptors, for whichever panel isn't cached yet
// (first time a given format is visited this session) — avoids duplicating
// each template's font/color choices outside of its own apply() closure.
function buildFreshPanelObjects(ctx: TemplateCtx, template: Template, layout: CoverLayout) {
  const scratch = new fabric.StaticCanvas(null, { width: layout.totalW, height: layout.totalH });
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

interface CoverTemplateEntry {
  id: string;
  name: string;
  createdAt: string;
  design: { front: any[]; backSpine: any[]; background: { color: string; imageUrl?: string } };
}

interface Props {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  subtitle?: string | null;
  description?: string | null;
  authorBio?: string | null;
  isbn?: string | null;
  pageCount?: number | null;
  // Real physical trim size (T-2057/genre-derived or manually overridden,
  // resolveBookPrintFormat in shared-types) -- drives the canvas's own
  // aspect ratio so the on-screen/exported cover actually matches what the
  // book will be printed at, instead of always the platform-wide fallback
  // regardless of the book's real format (pocket/standard/enlarged/large
  // ratios genuinely differ, ~0.605 to ~0.759). Falls back to
  // PRINT_TRIM_SIZE_MM when absent (no genre chosen yet).
  trimMm?: { widthMm: number; heightMm: number } | null;
  format: CoverFormat;
  existingCoverUrl?: string | null;
  savedDesign?: { front: any[]; backSpine: any[]; background: { color: string; imageUrl?: string } } | null;
  coverImageLibrary?: { url: string; uploadedAt: string; kind?: "slot" | "background" }[];
  // T-2060 п.8 -- "незалежно від даних книги" (Ridero pattern). Default true
  // (synced) when the caller doesn't pass it, matching the DB default for
  // Book.coverIndependentFromBookData (false = synced).
  syncFromBookData?: boolean;
  onSaved: (patch: { coverUrl?: string; backCoverUrl?: string; spineUrl?: string }) => void;
  onLibraryChange?: (library: { url: string; uploadedAt: string; kind?: "slot" | "background" }[]) => void;
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
  trimMm,
  format,
  savedDesign,
  coverImageLibrary = [],
  syncFromBookData = true,
  onSaved,
  onLibraryChange,
  token,
}: Props) {
  // Split the shared upload library by which button it came from -- an
  // image uploaded for the background must re-apply to the background when
  // picked again later, not to the front illustration (the only thing the
  // single combined gallery used to do). Entries saved before `kind`
  // existed default to "slot".
  const slotLibrary = coverImageLibrary.filter((img) => (img.kind ?? "slot") === "slot");
  const bgLibrary = coverImageLibrary.filter((img) => img.kind === "background");

  const effectiveTrimMm =
    trimMm && trimMm.widthMm > 0 && trimMm.heightMm > 0 ? trimMm : PRINT_TRIM_SIZE_MM;
  const geometry = useMemo(
    () => deriveGeometry(effectiveTrimMm),
    [effectiveTrimMm.widthMm, effectiveTrimMm.heightMm]
  );

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
  const snapshotScheduledRef = useRef(false);
  // Crop mode: temporarily removes the photo-slot image's clipPath so the
  // full image is visible/draggable beyond the slot, with a dashed outline
  // (a real fabric.Rect, excludeFromExport: true so it never leaks into
  // undo history/coverDesign JSON) marking where the clip will snap back to.
  const cropSlotRef = useRef<PanelRect | null>(null);
  const cropTargetRef = useRef<fabric.Object | null>(null);
  const cropOutlineRef = useRef<fabric.Rect | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeTab, setActiveTab] = useState<"templates" | "own" | "mine">("templates");
  const [myTemplates, setMyTemplates] = useState<CoverTemplateEntry[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  // Remembers the last uploaded background image so it stays offered as a
  // swatch next to the color options even after the author switches to a
  // plain color -- lets them toggle back and forth instead of losing the
  // upload the moment they pick a color.
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [ownCoverError, setOwnCoverError] = useState("");
  const [ownCoverDims, setOwnCoverDims] = useState<{ w: number; h: number } | null>(null);
  const [activeObj, setActiveObj] = useState<fabric.Object | null>(null);
  const [croppingSlot, setCroppingSlot] = useState(false);

  const ctx: TemplateCtx = useMemo(
    () => ({
      layout: computeCoverLayout(format, pageCount, effectiveTrimMm),
      title: bookTitle,
      author: bookAuthor,
      subtitle: subtitle || undefined,
      description: description || undefined,
      bio: authorBio || undefined,
      isbn,
    }),
    [format, pageCount, effectiveTrimMm.widthMm, effectiveTrimMm.heightMm, bookTitle, bookAuthor, subtitle, description, authorBio, isbn]
  );

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  const templateIndex = TEMPLATES.findIndex((t) => t.id === template.id);

  // A single user gesture often fires more than one fabric event that each
  // want a snapshot -- e.g. recolor() both removes the bg-image object
  // (object:removed listener below) AND calls saveSnapshot() itself, or
  // loadFromJSON-based restores add several objects in a row. Without
  // coalescing, those push multiple near-duplicate history entries per
  // gesture, so one Undo click can land on a snapshot that's identical to
  // the one before it and look like nothing happened -- reported as "Undo
  // doesn't undo one step at a time" on softcover/hardcover, where the
  // back+spine panel makes multi-object operations more common. Batch every
  // saveSnapshot() call within the same synchronous burst (any handler
  // chain, not just React state) into a single history entry via a
  // microtask, since a later, separate user gesture can never run inside
  // that same microtask flush.
  const saveSnapshot = useCallback(() => {
    if (pauseHistoryRef.current || snapshotScheduledRef.current) return;
    snapshotScheduledRef.current = true;
    queueMicrotask(() => {
      snapshotScheduledRef.current = false;
      const canvas = canvasRef.current;
      if (!canvas || pauseHistoryRef.current) return;
      const json = JSON.stringify(canvas.toJSON(["data"]));
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
    });
  }, []);

  // Init canvas once
  useEffect(() => {
    if (!canvasEl.current) return;
    const canvas = new fabric.Canvas(canvasEl.current, { width: ctx.layout.totalW, height: ctx.layout.totalH });
    canvasRef.current = canvas;

    canvas.on("object:added", saveSnapshot);
    canvas.on("object:removed", saveSnapshot);
    canvas.on("object:modified", saveSnapshot);
    // Selecting something else while mid-crop would strand the image
    // unclipped with a stray outline rect -- snap crop mode closed first.
    const exitCropIfSelectingElsewhere = (next: fabric.Object | null) => {
      if (cropTargetRef.current && next !== cropTargetRef.current) exitCropMode();
    };
    canvas.on("selection:created", (e) => {
      const next = e.selected?.[0] ?? null;
      exitCropIfSelectingElsewhere(next);
      setActiveObj(next);
    });
    canvas.on("selection:updated", (e) => {
      const next = e.selected?.[0] ?? null;
      exitCropIfSelectingElsewhere(next);
      setActiveObj(next);
    });
    canvas.on("selection:cleared", () => {
      exitCropIfSelectingElsewhere(null);
      setActiveObj(null);
    });

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

    if (savedDesign && (savedDesign.front.length > 0 || savedDesign.backSpine.length > 0)) {
      // Restore the author's last-saved design instead of the blank
      // template — same front/back+spine/background restore logic the
      // format-switch effect below uses, seeded from the backend instead of
      // an in-session ref.
      frontStateRef.current = savedDesign.front;
      backSpineStateRef.current = savedDesign.backSpine;
      backgroundRef.current = savedDesign.background;
      if (savedDesign.background.imageUrl) setBgImageUrl(savedDesign.background.imageUrl);

      const needFresh = !frontStateRef.current || (!!ctx.layout.back && !backSpineStateRef.current);
      const fresh = needFresh ? buildFreshPanelObjects(ctx, template, ctx.layout) : null;
      const frontRelative = frontStateRef.current ?? fresh!.front;
      const frontObjs = repositionFrontObjects(frontRelative, ctx.layout.front);
      const backSpineObjs = ctx.layout.back ? (backSpineStateRef.current ?? fresh!.backSpine) : [];

      canvas.loadFromJSON(JSON.stringify({ objects: [...frontObjs, ...backSpineObjs] }), () => {
        // T-2067 -- loadFromJSON loads images asynchronously; if the author
        // navigates away before this callback fires, this effect's cleanup
        // has already run canvas.dispose() + canvasRef.current = null, and
        // rendering into a disposed canvas crashes deep in Fabric internals
        // (clearContext on a null context) as an uncaught client-side
        // exception -- bail out if this callback is stale.
        if (canvasRef.current !== canvas) return;
        applyBackground(canvas, ctx.layout, backgroundRef.current, "#1a1a2e");
        canvas.renderAll();
        historyRef.current = [];
        historyIndexRef.current = -1;
        saveSnapshot();
      });
    } else {
      template.apply(canvas, ctx);
      canvas.renderAll();
      historyRef.current = [];
      historyIndexRef.current = -1;
      saveSnapshot();

      const initAccent = canvas.getObjects().find((o: any) => o.data?.role === "accent") as any;
      backgroundRef.current = { color: (initAccent?.fill as string) ?? "#1a1a2e" };
    }

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
      const leavingLayout = computeCoverLayout(prevFormatRef.current, pageCount, effectiveTrimMm);
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
      const frontObjs = repositionFrontObjects(frontRelative, ctx.layout.front);
      const backSpineObjs = ctx.layout.back ? (backSpineStateRef.current ?? fresh!.backSpine) : [];

      canvas.loadFromJSON(JSON.stringify({ objects: [...frontObjs, ...backSpineObjs] }), () => {
        // T-2067 -- same stale-callback-after-unmount race as the init effect above.
        if (canvasRef.current !== canvas) return;
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

  // T-2060 п.8 -- "Вихідні дані" is the canonical text source (title/author/
  // subtitle/annotation/bio); by default the cover's own text objects stay
  // mirrored to it live. Updates in place (by `data.role`) rather than
  // rebuilding the canvas, so the author's own styling/position/color edits
  // on those same text objects survive. Deliberately does NOT add a text
  // object that doesn't already exist (e.g. a subtitle typed in after the
  // cover was first created with none) -- that would need re-running the
  // template's layout logic and risks clobbering a manually repositioned
  // cover; author adds it manually via the toolbar instead, same as any
  // other cover text. Skipped entirely once the author checks "редагувати
  // незалежно" (syncFromBookData=false) -- their edits then diverge freely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !syncFromBookData) return;
    const roleToText: Record<string, string> = {
      "text-title": bookTitle,
      "text-author": bookAuthor,
      "text-subtitle": subtitle || "",
      "text-bio": authorBio || "",
      "text-blurb": description || "Анотація до книги…",
    };
    let changed = false;
    canvas.getObjects().forEach((o: any) => {
      const role = o.data?.role;
      const next = roleToText[role];
      if (next !== undefined && o.text !== next) {
        o.set({ text: next });
        changed = true;
      }
    });
    if (changed) {
      canvas.renderAll();
      saveSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookTitle, bookAuthor, subtitle, description, authorBio, syncFromBookData]);

  const undoCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const json = historyRef.current[historyIndexRef.current];
    pauseHistoryRef.current = true;
    canvas.loadFromJSON(json, () => {
      if (canvasRef.current !== canvas) return; // T-2067 -- stale callback after unmount
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
      if (canvasRef.current !== canvas) return; // T-2067 -- stale callback after unmount
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
    setActiveObj(touchActiveObj(obj));
  }, []);

  const toggleTextStyle = useCallback(
    (key: "fontWeight" | "fontStyle" | "underline" | "linethrough") => {
      const canvas = canvasRef.current;
      const obj = canvas?.getActiveObject() as fabric.IText | undefined;
      if (!obj) return;
      if (key === "underline") {
        updateSelected({ underline: !obj.underline });
      } else if (key === "linethrough") {
        updateSelected({ linethrough: !obj.linethrough });
      } else if (key === "fontWeight") {
        updateSelected({ fontWeight: obj.fontWeight === "bold" ? "normal" : "bold" });
      } else {
        updateSelected({ fontStyle: obj.fontStyle === "italic" ? "normal" : "italic" });
      }
    },
    [updateSelected]
  );

  // Fabric has no CSS-like text-transform -- "all caps" has to mutate the
  // actual string. Keeps the real casing in data.caseOriginal so toggling
  // back off restores it; editing the text while caps is on only affects
  // what's visible (the newly typed part won't have a separately-tracked
  // "true" casing) -- an accepted simplification, not a full case-tracking
  // text engine.
  const toggleAllCaps = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject() as fabric.Textbox | undefined;
    if (!canvas || !obj || obj.type !== "textbox") return;
    const data = (obj as any).data ?? {};
    if (data.allCaps) {
      obj.set({ text: data.caseOriginal ?? obj.text, data: { ...data, allCaps: false, caseOriginal: null } });
    } else {
      obj.set({ text: (obj.text ?? "").toUpperCase(), data: { ...data, allCaps: true, caseOriginal: obj.text } });
    }
    canvas.renderAll();
    setActiveObj(touchActiveObj(obj));
    saveSnapshot();
  }, [saveSnapshot]);

  const toggleTextShadow = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject() as any;
    if (!canvas || !obj) return;
    obj.set({ shadow: obj.shadow ? null : new fabric.Shadow({ color: "rgba(0,0,0,0.6)", blur: 6, offsetX: 2, offsetY: 2 }) });
    canvas.renderAll();
    setActiveObj(touchActiveObj(obj));
    saveSnapshot();
  }, [saveSnapshot]);

  const updateTextShadow = useCallback((patch: { blur?: number; opacity?: number }) => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject() as any;
    if (!canvas || !obj || !obj.shadow) return;
    const blur = patch.blur ?? obj.shadow.blur ?? 6;
    const match = /rgba?\([^,]+,[^,]+,[^,]+,?\s*([\d.]+)?\)/.exec(obj.shadow.color || "");
    const currentOpacity = match?.[1] ? Number(match[1]) : 0.6;
    const opacity = patch.opacity ?? currentOpacity;
    obj.set({ shadow: new fabric.Shadow({ color: `rgba(0,0,0,${opacity})`, blur, offsetX: 2, offsetY: 2 }) });
    canvas.renderAll();
    setActiveObj(touchActiveObj(obj));
  }, []);

  const addRectangle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const panel = ctx.layout.front;
    const w = Math.min(140, panel.w * 0.4);
    const h = Math.min(90, panel.h * 0.25);
    const rect = new fabric.Rect({
      left: panel.x + panel.w / 2 - w / 2,
      top: panel.y + panel.h / 2 - h / 2,
      width: w,
      height: h,
      fill: "#ffffff",
      stroke: "#111111",
      strokeWidth: 1,
      opacity: 1,
      data: { role: "shape" },
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
    setActiveObj(rect);
    saveSnapshot();
  }, [ctx.layout, saveSnapshot]);

  const panelForObject = useCallback(
    (obj: fabric.Object): PanelRect => {
      const center = obj.getCenterPoint();
      const panels = [ctx.layout.front, ctx.layout.back, ctx.layout.spine].filter((p): p is PanelRect => !!p);
      return panels.find((p) => center.x >= p.x && center.x <= p.x + p.w) ?? ctx.layout.front;
    },
    [ctx.layout]
  );

  // Center-snap guides while dragging -- an object magnetizes to the
  // horizontal/vertical center of whichever panel (front/back/spine) it's
  // currently over, same "center" the alignSelected buttons target, with a
  // thin guide line while snapped. Drawn on canvas.contextTop (Fabric's own
  // overlay context, meant exactly for this kind of transient UI) instead of
  // as real fabric objects -- guides must never leak into saveSnapshot()/
  // undo history or the exported front/back/spine PNG crops.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const SNAP = 6;
    // contextTop/clearContext exist on fabric.Canvas at runtime but aren't
    // in the bundled type defs -- narrow cast at the boundary.
    const fCanvas = canvas as any;

    function clearGuides() {
      fCanvas.clearContext(fCanvas.contextTop);
    }

    function drawGuides(snapX: boolean, snapY: boolean, panel: PanelRect) {
      clearGuides();
      const c = fCanvas.contextTop as CanvasRenderingContext2D;
      c.save();
      c.strokeStyle = "#ff3d9a";
      c.lineWidth = 1;
      c.setLineDash([4, 4]);
      if (snapX) {
        const x = panel.x + panel.w / 2;
        c.beginPath();
        c.moveTo(x, panel.y);
        c.lineTo(x, panel.y + panel.h);
        c.stroke();
      }
      if (snapY) {
        const y = panel.y + panel.h / 2;
        c.beginPath();
        c.moveTo(panel.x, y);
        c.lineTo(panel.x + panel.w, y);
        c.stroke();
      }
      c.restore();
    }

    function onMoving(e: fabric.IEvent) {
      const obj = e.target;
      if (!obj) return;
      const panel = panelForObject(obj);
      const center = obj.getCenterPoint();
      const dx = panel.x + panel.w / 2 - center.x;
      const dy = panel.y + panel.h / 2 - center.y;
      const snapX = Math.abs(dx) < SNAP;
      const snapY = Math.abs(dy) < SNAP;
      if (snapX) obj.left = (obj.left ?? 0) + dx;
      if (snapY) obj.top = (obj.top ?? 0) + dy;
      if (snapX || snapY) {
        obj.setCoords();
        drawGuides(snapX, snapY, panel);
      } else {
        clearGuides();
      }
    }

    canvas.on("object:moving", onMoving);
    canvas.on("mouse:up", clearGuides);

    return () => {
      canvas.off("object:moving", onMoving);
      canvas.off("mouse:up", clearGuides);
      // T-2067 round 3 -- this cleanup runs on every unmount, and the main
      // init effect's cleanup (canvas.dispose()) always runs before this one
      // (declared earlier in the component, and React tears down effects in
      // declaration order). clearGuides() unconditionally touched the
      // already-disposed canvas's contextTop -- clearContext on a null
      // context, same crash as the other T-2067 sites, except this one fired
      // on EVERY navigation away from the cover editor, not just a timing
      // race, since it's plain synchronous cleanup ordering, not an async
      // callback landing late. This was the actual repro behind "still
      // crashes after round 2" -- the loadFromJSON/fromURL guards were real
      // fixes for real (rarer) races, just not this one.
      if (isCanvasDisposed(canvas)) return;
      clearGuides();
    };
  }, [panelForObject]);

  const exitCropMode = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = cropTargetRef.current as any;
    const slot = cropSlotRef.current;
    if (canvas && obj && slot) {
      obj.set({
        clipPath: new fabric.Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, absolutePositioned: true }),
      });
    }
    if (canvas && cropOutlineRef.current) {
      canvas.remove(cropOutlineRef.current);
      cropOutlineRef.current = null;
    }
    cropSlotRef.current = null;
    cropTargetRef.current = null;
    canvas?.renderAll();
    setCroppingSlot(false);
  }, []);

  const toggleCropMode = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (croppingSlot) {
      exitCropMode();
      saveSnapshot();
      return;
    }

    const obj = canvas.getActiveObject() as any;
    if (!obj || obj.data?.role !== "photo-slot") return;

    const clip = obj.clipPath as fabric.Rect | undefined;
    const slot: PanelRect = clip
      ? { x: clip.left ?? 0, y: clip.top ?? 0, w: clip.width ?? 0, h: clip.height ?? 0 }
      : panelForObject(obj);
    cropSlotRef.current = slot;
    cropTargetRef.current = obj;
    obj.set({ clipPath: undefined });

    const outline = new fabric.Rect({
      left: slot.x,
      top: slot.y,
      width: slot.w,
      height: slot.h,
      fill: "transparent",
      stroke: "#ff3d9a",
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      data: { role: "crop-outline" },
    });
    canvas.add(outline);
    canvas.bringToFront(outline);
    cropOutlineRef.current = outline;

    canvas.renderAll();
    setCroppingSlot(true);
  }, [croppingSlot, panelForObject, exitCropMode, saveSnapshot]);

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

  // Picking a color switches the background back to solid -- the uploaded
  // image (if any) stays remembered in bgImageUrl so its swatch keeps
  // offering a one-click way back, it's just not the active layer anymore.
  // Color is its own independent layer now (T-9, three-layer background) --
  // picking a swatch only ever touches the accent fill. It used to also
  // remove the bg-image, which was the actual bug being fixed: the color
  // is supposed to show through only where the layers above it don't cover
  // it, not replace them.
  const recolor = useCallback((color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach((o: any) => {
      if (o.data?.role === "accent") o.set("fill", color);
    });
    canvas.renderAll();
    saveSnapshot();
  }, [saveSnapshot]);

  const removePattern = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    removeBackgroundLayer(canvas, "pattern");
    saveSnapshot();
  }, [saveSnapshot]);

  const removeBgImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    removeBackgroundLayer(canvas, "bg-image");
    saveSnapshot();
  }, [saveSnapshot]);

  const selectBgImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImageUrl) return;
    applyBackgroundImage(canvas, ctx.layout, bgImageUrl);
    saveSnapshot();
  }, [bgImageUrl, ctx.layout, saveSnapshot]);

  const applyRandomPattern = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const group = pattern.build(ctx.layout.front);
    replacePatternObject(canvas, group);
  }, [ctx.layout.front]);

  const uploadAndApplyImage = useCallback(
    async (file: File, target: "slot" | "background" = "slot") => {
      if (!token) return;
      target === "background" ? setUploadingBg(true) : setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/books/${bookId}/cover-images?kind=${target}`, {
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
          if (target === "background") {
            applyBackgroundImage(canvas, ctx.layout, url);
            setBgImageUrl(url);
          } else {
            applyImageToSlot(canvas, url, ctx.layout.front);
          }
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
          if (img.naturalWidth < geometry.ownCoverMinW || img.naturalHeight < geometry.ownCoverMinH) {
            setOwnCoverError(
              `Зображення ${img.naturalWidth}×${img.naturalHeight}px — менше мінімуму ${geometry.ownCoverMinW}×${geometry.ownCoverMinH}px (150 DPI). Завантажте зображення більшого розміру.`
            );
            return;
          }
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.clear();
          fabric.Image.fromURL(dataUrl, (fabricImg) => {
            if (isCanvasDisposed(canvas)) return;
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
    async (dataUrl: string, endpoint: string, field: "coverUrl" | "backCoverUrl" | "spineUrl") => {
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
    if (croppingSlot) exitCropMode(); // outline is excludeFromExport but toDataURL rasterizes it anyway
    setSaving(true);
    setSaveError("");
    try {
      const { front, back, spine } = ctx.layout;
      const patch: { coverUrl?: string; backCoverUrl?: string; spineUrl?: string } = {};

      const frontDataUrl = canvas.toDataURL({
        format: "png",
        multiplier: geometry.exportScale,
        left: front.x,
        top: front.y,
        width: front.w,
        height: front.h,
      });
      patch.coverUrl = await uploadPanel(frontDataUrl, "upload-cover", "coverUrl");

      if (back) {
        const backDataUrl = canvas.toDataURL({
          format: "png",
          multiplier: geometry.exportScale,
          left: back.x,
          top: back.y,
          width: back.w,
          height: back.h,
        });
        patch.backCoverUrl = await uploadPanel(backDataUrl, "upload-back-cover", "backCoverUrl");
      }

      // Spine panel only exists for softcover/hardcover layouts -- exporting it
      // separately is what lets the 3D preview show the real spine art/title
      // instead of a generic placeholder (T-1963 sibling bug).
      if (spine) {
        const spineDataUrl = canvas.toDataURL({
          format: "png",
          multiplier: geometry.exportScale,
          left: spine.x,
          top: spine.y,
          width: spine.w,
          height: spine.h,
        });
        patch.spineUrl = await uploadPanel(spineDataUrl, "upload-spine", "spineUrl");
      }

      const coverDesign = captureDesignState(canvas, ctx.layout, backSpineStateRef.current);
      await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ coverDesign }),
      });

      onSaved(patch);
    } catch (e: any) {
      setSaveError(e.message || "Помилка збереження обкладинки");
    } finally {
      setSaving(false);
    }
  }, [ctx.layout, geometry.exportScale, uploadPanel, onSaved, bookId, token, croppingSlot, exitCropMode]);

  // Author-level cover templates (distinct from the built-in TEMPLATES array
  // and from AuthorStyleSet, which is manuscript typography, not covers) --
  // "Мої шаблони": a design an author already built once, reusable across
  // any of their other books. Stores the same {front, backSpine, background}
  // shape captureDesignState already produces for Book.coverDesign.
  const loadMyTemplates = useCallback(async () => {
    if (!token) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/cover-templates", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const { templates } = await res.json();
      setMyTemplates(templates);
    } finally {
      setLoadingTemplates(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "mine" && myTemplates.length === 0 && !loadingTemplates) {
      loadMyTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const saveAsTemplate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !token) return;
    // Must restore the photo-slot clipPath before capturing -- otherwise a
    // template saved mid-crop would paste the image unclipped into whatever
    // book it's later applied to.
    if (croppingSlot) exitCropMode();
    const name = window.prompt("Назва шаблону:");
    if (!name || !name.trim()) return;
    setSavingTemplate(true);
    setSaveError("");
    try {
      const design = captureDesignState(canvas, ctx.layout, backSpineStateRef.current);
      const res = await fetch("/api/cover-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), design }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Помилка збереження шаблону");
      const { template } = await res.json();
      setMyTemplates((prev) => [template, ...prev]);
    } catch (e: any) {
      setSaveError(e.message || "Помилка збереження шаблону");
    } finally {
      setSavingTemplate(false);
    }
  }, [ctx.layout, token, croppingSlot, exitCropMode]);

  const applyStoredDesign = useCallback(
    (design: CoverTemplateEntry["design"]) => {
      const canvas = canvasRef.current;
      if (!canvas) return Promise.resolve();
      frontStateRef.current = design.front;
      backSpineStateRef.current = design.backSpine;
      backgroundRef.current = design.background;
      if (design.background.imageUrl) setBgImageUrl(design.background.imageUrl);

      const frontObjs = repositionFrontObjects(design.front, ctx.layout.front);
      const backSpineObjs = ctx.layout.back ? design.backSpine : [];

      pauseHistoryRef.current = true;
      return new Promise<void>((resolve) => {
        canvas.loadFromJSON(JSON.stringify({ objects: [...frontObjs, ...backSpineObjs] }), () => {
          if (canvasRef.current !== canvas) { resolve(); return; } // T-2067 -- stale callback after unmount
          applyBackground(canvas, ctx.layout, backgroundRef.current, "#1a1a2e");
          canvas.renderAll();
          pauseHistoryRef.current = false;
          saveSnapshot();
          resolve();
        });
      });
    },
    [ctx.layout, saveSnapshot]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      if (!token) return;
      await fetch(`/api/cover-templates/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setMyTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [token]
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Canvas */}
      <div className="flex flex-1 min-w-0 flex-col items-center gap-3">
        <div className="max-w-full overflow-x-auto rounded-lg border-2 border-gray-200 shadow-md">
          <div className="relative" style={{ width: ctx.layout.totalW, height: ctx.layout.totalH }}>
            <canvas ref={canvasEl} />
            {/* Non-printing guides marking the spine (торець книжки) fold lines,
                so the author can judge its real thickness and whether text fits
                there -- a plain DOM overlay rather than fabric objects, so it
                never has to be re-added after every loadFromJSON (format
                switch, undo/redo, template apply) and can never leak into an
                export (fabric's excludeFromExport is respected by toJSON but
                not by toDataURL, so a canvas object here would need explicit
                removal before every render). */}
            {format === "hardcover" && ctx.layout.spine && ctx.layout.spine.w > 0 && (
              <>
                <div
                  className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-pink-500/70"
                  style={{ left: ctx.layout.spine.x }}
                />
                <div
                  className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-pink-500/70"
                  style={{ left: ctx.layout.spine.x + ctx.layout.spine.w }}
                />
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400">Клікніть на назву, підзаголовок, автора чи анотацію, щоб редагувати текст прямо на обкладинці</p>

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
        <Button
          variant="outline"
          onClick={saveAsTemplate}
          loading={savingTemplate}
          className="w-full max-w-xs"
          title="Зберегти поточний дизайн, щоб застосувати його до інших своїх книжок"
        >
          Зберегти як шаблон
        </Button>
        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      </div>

      {/* Right panel */}
      <div className="w-full space-y-4 lg:w-[300px] lg:shrink-0">
        {activeObj?.type === "textbox" && (
          <div className="space-y-2 rounded-lg border bg-gray-50 p-2">
            <p className="text-xs font-medium text-gray-500">Текст</p>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => toggleTextStyle("fontWeight")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Жирний">
                <Bold size={15} />
              </button>
              <button type="button" onClick={() => toggleTextStyle("fontStyle")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Курсив">
                <Italic size={15} />
              </button>
              <button type="button" onClick={() => toggleTextStyle("underline")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Підкреслення">
                <Underline size={15} />
              </button>
              <button type="button" onClick={() => toggleTextStyle("linethrough")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Закреслення">
                <Strikethrough size={15} />
              </button>
              <button type="button" onClick={toggleAllCaps} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Всі літери великі">
                <CaseUpper size={15} />
              </button>
              <div className="mx-0.5 h-5 w-px bg-gray-300" />
              <button type="button" onClick={() => updateSelected({ textAlign: "left" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="По лівому краю">
                <AlignLeft size={15} />
              </button>
              <button type="button" onClick={() => updateSelected({ textAlign: "center" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="По центру">
                <AlignCenter size={15} />
              </button>
              <button type="button" onClick={() => updateSelected({ textAlign: "right" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="По правому краю">
                <AlignRight size={15} />
              </button>
              <button type="button" onClick={() => updateSelected({ textAlign: "justify" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="На всю ширину">
                <AlignJustify size={15} />
              </button>
            </div>

            <div className="flex items-center gap-2">
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

            <div className="space-y-1.5 border-t pt-2">
              <button
                type="button"
                onClick={toggleTextShadow}
                className="w-full rounded-md border bg-white py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {(activeObj as any)?.shadow ? "✕ Прибрати тінь" : "Тінь тексту"}
              </button>
              {(activeObj as any)?.shadow && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-xs text-gray-500">Розмитість</label>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={(activeObj as any).shadow?.blur ?? 6}
                      onChange={(e) => updateTextShadow({ blur: Number(e.target.value) })}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-20 shrink-0 text-xs text-gray-500">Прозорість</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={
                        /rgba?\([^,]+,[^,]+,[^,]+,?\s*([\d.]+)?\)/.exec((activeObj as any).shadow?.color || "")?.[1]
                          ? Number(/rgba?\([^,]+,[^,]+,[^,]+,?\s*([\d.]+)?\)/.exec((activeObj as any).shadow?.color || "")![1])
                          : 0.6
                      }
                      onChange={(e) => updateTextShadow({ opacity: Number(e.target.value) })}
                      className="flex-1"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeObj?.type === "rect" && (activeObj as any)?.data?.role === "band" && (
          <div className="space-y-2 rounded-lg border bg-gray-50 p-2">
            <p className="text-xs font-medium text-gray-500">Прямокутник</p>
            <div className="flex items-center gap-2">
              <label className="w-20 shrink-0 text-xs text-gray-500">Колір</label>
              <input
                type="color"
                value={typeof (activeObj as any)?.fill === "string" ? ((activeObj as any).fill as string) : "#000000"}
                onChange={(e) => updateSelected({ fill: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-gray-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-20 shrink-0 text-xs text-gray-500">Прозорість</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={activeObj?.opacity ?? 1}
                onChange={(e) => updateSelected({ opacity: Number(e.target.value) })}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {activeObj?.type === "rect" && (activeObj as any)?.data?.role === "shape" && (
          <div className="space-y-2 rounded-lg border bg-gray-50 p-2">
            <p className="text-xs font-medium text-gray-500">Прямокутник</p>
            <div className="flex items-center gap-2">
              <label className="w-20 shrink-0 text-xs text-gray-500">Заливка</label>
              <input
                type="color"
                value={typeof (activeObj as any).fill === "string" ? (activeObj as any).fill : "#ffffff"}
                onChange={(e) => updateSelected({ fill: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-gray-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-20 shrink-0 text-xs text-gray-500">Обводка</label>
              <input
                type="color"
                value={typeof (activeObj as any).stroke === "string" ? (activeObj as any).stroke : "#000000"}
                onChange={(e) => updateSelected({ stroke: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-gray-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-20 shrink-0 text-xs text-gray-500">Товщина</label>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={(activeObj as any).strokeWidth ?? 0}
                onChange={(e) => updateSelected({ strokeWidth: Number(e.target.value) })}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-20 shrink-0 text-xs text-gray-500">Прозорість</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={(activeObj as any).opacity ?? 1}
                onChange={(e) => updateSelected({ opacity: Number(e.target.value) })}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {((activeObj as any)?.data?.role === "photo-slot" || croppingSlot) && (
          <Button variant="outline" size="sm" className="w-full" onClick={toggleCropMode}>
            {croppingSlot ? "✓ Застосувати кадрування" : "Кадрувати зображення"}
          </Button>
        )}

        <Button variant="outline" size="sm" className="w-full" onClick={addRectangle}>
          + Додати фігуру
        </Button>

        <div className="flex gap-1 rounded-lg border p-1 bg-gray-50">
          {(["templates", "mine", "own"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === "templates" ? "Шаблони" : tab === "mine" ? "Мої шаблони" : "Своя обкладинка"}
            </button>
          ))}
        </div>

        {activeTab === "mine" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Дизайни, які ви зберегли з кнопки «Зберегти як шаблон» — застосуйте до цієї книжки в один клік.
            </p>
            {loadingTemplates ? (
              <p className="text-xs text-gray-400">Завантаження…</p>
            ) : myTemplates.length === 0 ? (
              <p className="text-xs text-gray-400">Поки немає збережених шаблонів.</p>
            ) : (
              <div className="space-y-2">
                {myTemplates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{tpl.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(tpl.createdAt).toLocaleDateString("uk-UA")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={applyingTemplateId === tpl.id}
                        onClick={async () => {
                          setApplyingTemplateId(tpl.id);
                          await applyStoredDesign(tpl.design);
                          setApplyingTemplateId(null);
                        }}
                      >
                        Застосувати
                      </Button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="px-1.5 text-gray-400 hover:text-red-600"
                        aria-label="Видалити шаблон"
                        title="Видалити шаблон"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "templates" && (
          <div className="space-y-4">
            {(() => {
              const prevTpl = TEMPLATES[(templateIndex - 1 + TEMPLATES.length) % TEMPLATES.length];
              const nextTpl = TEMPLATES[(templateIndex + 1) % TEMPLATES.length];
              return (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyTemplate(prevTpl)}
                    className="text-gray-400 hover:text-gray-900"
                    aria-label="Попередній шаблон"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate(prevTpl)}
                    className="flex flex-col items-center gap-1 opacity-40 transition-opacity hover:opacity-70"
                    aria-label={`Попередній: ${prevTpl.label}`}
                  >
                    <div className={cn("h-16 w-11 rounded border border-gray-300", prevTpl.thumbnail)} />
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn("h-24 w-16 rounded border-2 border-primary", template.thumbnail)} />
                    <span className="text-xs font-medium text-gray-700">{template.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyTemplate(nextTpl)}
                    className="flex flex-col items-center gap-1 opacity-40 transition-opacity hover:opacity-70"
                    aria-label={`Наступний: ${nextTpl.label}`}
                  >
                    <div className={cn("h-16 w-11 rounded border border-gray-300", nextTpl.thumbnail)} />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate(nextTpl)}
                    className="text-gray-400 hover:text-gray-900"
                    aria-label="Наступний шаблон"
                  >
                    ›
                  </button>
                </div>
              );
            })()}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAllTemplates((v) => !v)}
            >
              {showAllTemplates ? "✕ Приховати список" : "▦ Список усіх макетів"}
            </Button>
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

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <Button size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} loading={uploading}>
              Завантажити ілюстрацію
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={applyRandomPattern}>
                Випадковий паттерн
              </Button>
              <button
                type="button"
                onClick={removePattern}
                className="shrink-0 text-xs text-gray-400 hover:text-red-600"
                title="Прибрати патерн"
              >
                ✕
              </button>
            </div>

            {slotLibrary.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">Раніше завантажені зображення</p>
                <div className="flex flex-wrap gap-1.5">
                  {slotLibrary.map((img) => (
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
                {bgImageUrl && (
                  <div className="relative h-6 w-6">
                    <button
                      type="button"
                      onClick={selectBgImage}
                      className="h-6 w-6 overflow-hidden rounded border-2 border-gray-900"
                      aria-label="Завантажене фонове зображення"
                      title="Завантажене фонове зображення"
                    >
                      <img src={bgImageUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={removeBgImage}
                      className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-[9px] text-white hover:bg-red-600"
                      aria-label="Прибрати фонове зображення"
                      title="Прибрати фонове зображення"
                    >
                      ×
                    </button>
                  </div>
                )}
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

              {bgLibrary.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">Раніше завантажені фони</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bgLibrary.map((img) => (
                      <div key={img.url} className="group relative h-12 w-12 overflow-hidden rounded border">
                        <button
                          type="button"
                          onClick={() => {
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            applyBackgroundImage(canvas, ctx.layout, img.url);
                            setBgImageUrl(img.url);
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
            </div>
          </div>
        )}

        {activeTab === "own" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Завантажте готову обкладинку цілком — вона замінить усе на канві. Мінімум {geometry.ownCoverMinW}×{geometry.ownCoverMinH}px (150 DPI),
              найкращий формат — PNG. Тримайте текст і важливі елементи не менше 10–15мм від країв книги —
              ця зона обрізається або йде на згин.
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
                PSD-шаблони з полями обрізу (bleed) та safe zone для поліграфії. Готуються — з’являться найближчим часом.
              </p>
              <Button size="sm" variant="outline" disabled className="w-full text-xs cursor-not-allowed">
                Завантажити PSD-шаблон (м’яка обкладинка)
              </Button>
              <Button size="sm" variant="outline" disabled className="w-full text-xs cursor-not-allowed">
                Завантажити PSD-шаблон (тверда обкладинка)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
