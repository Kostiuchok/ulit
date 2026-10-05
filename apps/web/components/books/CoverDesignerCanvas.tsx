"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { fabric } from "fabric";
import JsBarcode from "jsbarcode";
import qrcode from "qrcode-generator";
import Link from "next/link";
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
  Minus,
  Plus,
} from "lucide-react";
import {
  PRINT_TRIM_SIZE_MM,
  MIN_SPINE_TEXT_PAGES,
  COVER_SAFE_ZONE_MIN_MM,
  COVER_SAFE_ZONE_MAX_MM,
  isSpineTooThinForText,
  spineThicknessMm,
} from "shared-types";
import { Button } from "../ui/button";
import { SaveActionButton } from "../ui/SaveActionButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../../lib/utils";
import { CoverTemplatesModal } from "./CoverTemplatesModal";
import {
  computeCoverLayout,
  type CoverFormat,
  type CoverLayout,
  type PanelRect,
} from "../../lib/coverLayout";

// Re-exported for CoverDesigner.tsx/CoverTemplatesModal.tsx/cover/page.tsx's
// own type-only imports of these -- the runtime implementation itself now
// lives in lib/coverLayout.ts (see that file's comment for why).
export type { CoverFormat, CoverLayout, PanelRect };

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
const FONT_SIZE_MIN = 6;
const FONT_SIZE_MAX = 300;
const clampFontSize = (v: number) => Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(v)));

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
    // No placeholder copy -- an empty annotation is an empty (invisible)
    // textbox, never filler text that could end up on a printed cover.
    const blurbObj = new fabric.Textbox(ctx.description || "", {
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


const TEXT_ROLE_LABELS: Record<string, string> = {
  "text-title": "Назва книги",
  "text-subtitle": "Підзаголовок",
  "text-author": "Автор",
  "text-blurb": "Анотація",
  "text-bio": "Біографія",
  "text-spine": "Корінець",
};

// Layers panel (WF-SPEC 08 п.3): how each canvas object is named there.
const LAYER_LABELS: Record<string, string> = {
  ...TEXT_ROLE_LABELS,
  "text-spine": "Текст корінця",
  "photo-slot": "Ілюстрація",
  shape: "Прямокутник",
  band: "Плашка шаблону",
  pattern: "Патерн",
  "bg-image": "Фонове зображення",
  accent: "Фон",
  barcode: "Штрихкод ISBN",
  qr: "QR-код",
};

// Text layers that mirror «Вихідні дані» until the author unlinks them.
const LINKED_TEXT_ROLES = new Set(["text-title", "text-subtitle", "text-author", "text-blurb", "text-bio"]);
const BG_LAYER_ROLES = new Set(["accent", "pattern", "bg-image", "photo-slot"]);

const BACK_TOGGLES: { role: string; label: string; linked?: boolean }[] = [
  { role: "text-blurb", label: "Анотація", linked: true },
  { role: "text-bio", label: "Біографія автора", linked: true },
  { role: "qr", label: "QR-код на сторінку книги" },
];

interface LayerRow {
  key: string;
  obj: fabric.Object;
  label: string;
  selectable: boolean;
  hidden: boolean;
  covered: boolean;
  linked: boolean;
}

function isShapeObject(o: any): boolean {
  const role = o?.data?.role;
  return role === "shape" || role === "band";
}

// A shape counts as hiding what's under it only when it's actually opaque.
function isOpaqueShape(o: any): boolean {
  return isShapeObject(o) && (o.opacity ?? 1) >= 0.99 && !!o.fill && o.fill !== "transparent";
}

// WF-SPEC 08 п.12 -- text layers that have a shape stacked ABOVE them and
// overlapping them. Template shapes always start under the text (see
// drawFrontText / addRectangle), so this only happens after the author
// explicitly reorders layers, or in a design saved before that rule.
function findCoveredTexts(canvas: fabric.Canvas): fabric.Object[] {
  const objs = canvas.getObjects();
  const covered: fabric.Object[] = [];
  objs.forEach((o: any, i) => {
    if (o.type !== "textbox" || !o.text?.trim() || o.visible === false) return;
    for (let j = i + 1; j < objs.length; j += 1) {
      const above: any = objs[j];
      if (isShapeObject(above) && above.visible !== false && o.intersectsWithObject(above)) {
        covered.push(o);
        return;
      }
    }
  });
  return covered;
}

interface BgImageTransform {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

// Same shape persisted in Book.coverDesign.background (apps/api's book.ts
// patchSchema) and CoverTemplate.design.background -- left/top/scaleX/scaleY
// are the author's own pan/zoom of the uploaded image, optional so existing
// saved designs (color+imageUrl only) keep loading fine. layoutW/layoutH/
// layoutFrontX are the layout this was captured at (see captureBackground) --
// needed to reposition the pan/zoom correctly when the format switches to a
// different total width (ebook <-> print, or spine width changing with page
// count) instead of reusing raw pixel values sized for a different canvas.
interface BackgroundDesign {
  color: string;
  imageUrl?: string;
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  layoutW?: number;
  layoutH?: number;
  layoutFrontX?: number;
}

// Same shape as BackgroundDesign minus color -- the front-panel illustration
// ("photo-slot" role), promoted (T-2081) from a front-only crop to its own
// full-wrap layer living directly above bg-image, so it can be panned across
// the ENTIRE print spread (back+spine+front) exactly like the background
// photo already could, not just within a front-sized window. Whatever
// portion currently overlaps the front panel is what shows in ebook mode --
// same front-alignment restore (computeRestoreTransform) the background uses.
interface IllustrationDesign {
  imageUrl?: string;
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  layoutW?: number;
  layoutH?: number;
  layoutFrontX?: number;
}

// Restoring a full-wrap image's (background OR illustration) pan/zoom into a
// layout with a different front-panel offset (ebook <-> print, or spine
// width changing with page count). The front panel is exactly DISPLAY_W wide
// in EVERY format -- only back/spine come and go around it -- so shifting by
// the front.x delta (scale untouched) keeps showing exactly the same crop
// over the front panel that was showing there before, instead of
// proportionally rescaling the whole wrap image by however much wider the
// print spread happens to be (which used to make ebook mode show a squashed
// view of the ENTIRE back+spine+front photo, not specifically "the part that
// was on the front"). Legacy saved designs (from before layoutFrontX
// existed) fall back to the old proportional-rescale-by-total-width
// approach -- imperfect, but harmless, and self-corrects the moment the
// author touches the image again (the next capture writes a real
// layoutFrontX).
function computeRestoreTransform(
  saved: { left?: number; top?: number; scaleX?: number; scaleY?: number; layoutW?: number; layoutFrontX?: number },
  layout: CoverLayout
): BgImageTransform {
  if (saved.layoutFrontX !== undefined) {
    const dx = layout.front.x - saved.layoutFrontX;
    return { left: saved.left! + dx, top: saved.top!, scaleX: saved.scaleX!, scaleY: saved.scaleY! };
  }
  const ratio = saved.layoutW ? layout.totalW / saved.layoutW : 1;
  return { left: saved.left! * ratio, top: saved.top!, scaleX: saved.scaleX! * ratio, scaleY: saved.scaleY! * ratio };
}

// Full-bleed image layer — covers the entire cover spread (back + spine +
// front for print, the single panel for ebook), same footprint as the solid
// accent color drawn by addAccentBg. Shared by both "bg-image" (background
// photo) and "photo-slot" (illustration) -- previously bg-image only covered
// the front panel and illustration was hard-clipped to a front-sized window
// forever; a print cover's background/illustration is one continuous
// image, not a front-only crop.
// `fitMode` "height" (background) fits the image to the cover's height,
// proportionally, letting width over/under-run -- "cover" (illustration)
// fills both dimensions, cropping whichever overflows, same as before.
// `transform` is the author's own last pan/zoom (from captureBackground/
// captureIllustration) -- passing it in re-applies exactly where they left
// it instead of recomputing the auto-centered fit, which used to silently
// reset their positioning on every format switch/reload. Omit it (a fresh
// upload, or re-picking an image with no transform recorded yet) to fall
// back to that auto-fit-and-center default.
function applyFullWrapImage(
  canvas: fabric.Canvas,
  layout: CoverLayout,
  url: string,
  role: "bg-image" | "photo-slot",
  fitMode: "cover" | "height",
  transform?: BgImageTransform
) {
  const box = { x: 0, y: 0, w: layout.totalW, h: layout.totalH };
  const opts = url.startsWith("data:") ? undefined : { crossOrigin: "anonymous" as const };
  fabric.Image.fromURL(
    url,
    (img) => {
      if (isCanvasDisposed(canvas)) return;
      const iw = img.width ?? box.w;
      const ih = img.height ?? box.h;
      const fitScale = fitMode === "height" ? box.h / ih : Math.max(box.w / iw, box.h / ih);
      img.set({
        originX: "left",
        originY: "top",
        left: transform?.left ?? box.x - (iw * fitScale - box.w) / 2,
        top: transform?.top ?? box.y - (ih * fitScale - box.h) / 2,
        scaleX: transform?.scaleX ?? fitScale,
        scaleY: transform?.scaleY ?? fitScale,
        selectable: true,
        evented: true,
        lockUniScaling: true, // resize handles stay proportional — no stretching
        data: { role },
        clipPath: new fabric.Rect({ left: box.x, top: box.y, width: box.w, height: box.h, absolutePositioned: true }),
      });
      const existing = canvas.getObjects().find((o: any) => o.data?.role === role);
      if (existing) canvas.remove(existing);
      canvas.add(img);
      normalizeBackgroundStack(canvas);
      canvas.renderAll();
    },
    opts
  );
}

function applyBackgroundImage(canvas: fabric.Canvas, layout: CoverLayout, url: string, transform?: BgImageTransform) {
  applyFullWrapImage(canvas, layout, url, "bg-image", "height", transform);
}

function applyIllustrationImage(canvas: fabric.Canvas, layout: CoverLayout, url: string, transform?: BgImageTransform) {
  applyFullWrapImage(canvas, layout, url, "photo-slot", "cover", transform);
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
// raw canvas position. Position is only used as a fallback for objects with
// no recognized role, e.g. extra images/text the author added freely with no
// fixed "panel" of their own.
// "photo-slot" (the illustration) is NOT in this set (T-2081) -- it's now a
// full-wrap layer captured/restored via captureIllustration/applyIllustration,
// same as "bg-image", excluded from this front/backSpine split entirely
// rather than bucketed as a front object.
const FRONT_ROLES = new Set(["text-title", "text-subtitle", "text-author", "band"]);
const BACK_SPINE_ROLES = new Set(["text-blurb", "text-bio", "text-spine", "barcode", "qr"]);

// Splits a flat array of Fabric object JSON descriptors (background/
// illustration objects already excluded by the caller) into front vs
// back+spine buckets. Front positions come back relative to the front
// panel's own x-origin, since that offset differs between ebook (x=0) and
// print (x=DISPLAY_W+spineW) layouts — callers add the *current* format's
// front.x back on restore.
function splitObjectsByPanel(objects: any[], layout: CoverLayout) {
  const nonBg = objects.filter(
    (o) => o.data?.role !== "accent" && o.data?.role !== "bg-image" && o.data?.role !== "photo-slot"
  );
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
// or a saved template) onto the CURRENT format's front panel. Any front
// object carrying its own clipPath (e.g. a future front-only overlay) gets
// that clip window rebuilt at the current front rect too, so a stale clip
// frozen at a different format's coordinates can never silently coincide
// with the wrong panel. "photo-slot" and "bg-image" never reach this
// function at all (T-2081) -- both are full-wrap layers with their clipPath
// rebuilt from scratch every time via applyBackground/applyIllustration.
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

// Reads the accent color + (if present) the background image's src AND its
// author-set pan/zoom off a flat array of live/serialized canvas objects —
// shared by captureDesignState and the format-switch "leaving format"
// snapshot so a custom background position survives both a save and a plain
// tab switch, not just one of them. The background now spans the whole
// cover (layout's origin is always (0,0) regardless of format — see
// computeCoverLayout), so left/top are stored as plain absolute canvas
// coordinates, no per-panel offset needed. layoutW/layoutH/layoutFrontX
// record the layout this was captured at, so applyBackground can reposition
// the pan/zoom correctly if restored into a layout with a different front
// offset (ebook <-> print, or spine width changing with page count).
function captureBackground(currentObjects: any[], layout: CoverLayout, fallbackColor: string): BackgroundDesign {
  const accent = currentObjects.find((o: any) => o.data?.role === "accent") as any;
  const bgImage = currentObjects.find((o: any) => o.data?.role === "bg-image") as any;
  return {
    color: (accent?.fill as string) ?? fallbackColor,
    imageUrl: (bgImage?.src as string) ?? undefined,
    left: bgImage?.left,
    top: bgImage?.top,
    scaleX: bgImage?.scaleX,
    scaleY: bgImage?.scaleY,
    layoutW: bgImage ? layout.totalW : undefined,
    layoutH: bgImage ? layout.totalH : undefined,
    layoutFrontX: bgImage ? layout.front.x : undefined,
  };
}

// Same idea as captureBackground, for the "photo-slot" illustration layer.
// Returns {} (no imageUrl) when no illustration is present -- applyIllustration
// treats a missing imageUrl as "nothing to restore", same as applyBackground.
function captureIllustration(currentObjects: any[], layout: CoverLayout): IllustrationDesign {
  const slot = currentObjects.find((o: any) => o.data?.role === "photo-slot") as any;
  if (!slot) return {};
  return {
    imageUrl: slot.src as string,
    left: slot.left,
    top: slot.top,
    scaleX: slot.scaleX,
    scaleY: slot.scaleY,
    layoutW: layout.totalW,
    layoutH: layout.totalH,
    layoutFrontX: layout.front.x,
  };
}

function captureDesignState(canvas: fabric.Canvas, layout: CoverLayout, cachedBackSpine: any[] | null) {
  const currentObjects = ((canvas.toJSON(["data"]) as any).objects ?? []) as any[];
  const { front, backSpine: liveBackSpine } = splitObjectsByPanel(currentObjects, layout);
  const backSpine = layout.back ? liveBackSpine : (cachedBackSpine ?? []);
  const background = captureBackground(currentObjects, layout, "#1a1a2e");
  const illustration = captureIllustration(currentObjects, layout);
  return { front, backSpine, background, illustration };
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
// trying to reposition a cached background object across formats.
function applyBackground(canvas: fabric.Canvas, layout: CoverLayout, bg: BackgroundDesign | null, fallbackColor: string) {
  addAccentBg(canvas, layout, bg?.color ?? fallbackColor);
  const accent = canvas.getObjects().find((o: any) => o.data?.role === "accent");
  if (accent) canvas.sendToBack(accent);
  if (bg?.imageUrl) {
    const hasTransform =
      bg.left !== undefined && bg.top !== undefined && bg.scaleX !== undefined && bg.scaleY !== undefined;
    const transform = hasTransform ? computeRestoreTransform(bg, layout) : undefined;
    applyBackgroundImage(canvas, layout, bg.imageUrl, transform);
  }
}

// Same idea as applyBackground, for the "photo-slot" illustration layer.
function applyIllustration(canvas: fabric.Canvas, layout: CoverLayout, ill: IllustrationDesign | null) {
  if (!ill?.imageUrl) return;
  const hasTransform =
    ill.left !== undefined && ill.top !== undefined && ill.scaleX !== undefined && ill.scaleY !== undefined;
  const transform = hasTransform ? computeRestoreTransform(ill, layout) : undefined;
  applyIllustrationImage(canvas, layout, ill.imageUrl, transform);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface CoverTemplateEntry {
  id: string;
  name: string;
  createdAt: string;
  design: { front: any[]; backSpine: any[]; background: BackgroundDesign; illustration?: IllustrationDesign };
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
  savedDesign?: { front: any[]; backSpine: any[]; background: BackgroundDesign; illustration?: IllustrationDesign } | null;
  coverImageLibrary?: { url: string; uploadedAt: string; kind?: "slot" | "background" }[];
  // T-2060 п.8 -- "незалежно від даних книги" (Ridero pattern). Default true
  // (synced) when the caller doesn't pass it, matching the DB default for
  // Book.coverIndependentFromBookData (false = synced).
  syncFromBookData?: boolean;
  // Public page of the book -- the optional QR code on the back cover.
  bookUrl?: string | null;
  // Saving a PUBLISHED book's cover stages it for admin approval (cover.ts)
  // and starts the 90-day re-change lock; the bottom bar says so up front.
  isPublished?: boolean;
  // Set while that lock is active -- saving is disabled until this date.
  lockedUntilLabel?: string | null;
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
  bookUrl,
  isPublished = false,
  lockedUntilLabel,
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
  // layout for exactly this reason. The illustration ("photo-slot") is
  // tracked the same way as background (T-2081) -- it's a full-wrap layer
  // now too, not a front object.
  const frontStateRef = useRef<any[] | null>(null);
  const backSpineStateRef = useRef<any[] | null>(null);
  const backgroundRef = useRef<BackgroundDesign | null>(null);
  const illustrationRef = useRef<IllustrationDesign | null>(null);
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
  const [panelTab, setPanelTab] = useState<"selected" | "design">("design");
  const [layersVersion, setLayersVersion] = useState(0);
  const [unlinkPrompt, setUnlinkPrompt] = useState<fabric.Object | null>(null);
  const isLinkedTextRef = useRef<(o: any) => boolean>(() => false);
  const [myTemplates, setMyTemplates] = useState<CoverTemplateEntry[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverSaved, setCoverSaved] = useState(false);
  const [coverDirty, setCoverDirty] = useState(false);
  const coverReadyRef = useRef(false);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
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
  const [coveredTexts, setCoveredTexts] = useState<string[]>([]);

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
      setCoveredTexts(
        findCoveredTexts(canvas).map((o: any) => TEXT_ROLE_LABELS[o.data?.role] ?? "Текст")
      );
      setLayersVersion((v) => v + 1);
      const json = JSON.stringify(canvas.toJSON(["data"]));
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
      if (coverReadyRef.current) {
        setCoverDirty(true);
        setCoverSaved(false);
      }
    });
  }, []);

  // Init canvas once
  useEffect(() => {
    if (!canvasEl.current) return;
    // preserveObjectStacking -- Fabric's default behavior temporarily
    // bumps the active object to the very top of the stack while selected,
    // which visibly jumped elements (e.g. the background image) in front of
    // everything else on the cover just from clicking them. true keeps every
    // object at its real z-index regardless of selection.
    const canvas = new fabric.Canvas(canvasEl.current, {
      width: ctx.layout.totalW,
      height: ctx.layout.totalH,
      preserveObjectStacking: true,
    });
    canvasRef.current = canvas;

    // WF-SPEC 08 п.4 -- clicking where text is VISIBLE selects the text. A
    // see-through shape stacked above a text layer used to swallow the click
    // (live bug: template rectangle selected instead of the title under it).
    // An opaque shape above text still wins -- that text genuinely isn't
    // visible there (and the overlap warning below offers the one-click fix).
    const defaultFindTarget = canvas.findTarget.bind(canvas);
    (canvas as any).findTarget = (e: any, skipGroup: boolean) => {
      const target: any = defaultFindTarget(e, skipGroup);
      if (!target || !isShapeObject(target) || isOpaqueShape(target)) return target;
      // Don't hijack a drag on the shape's own resize/rotate handles.
      if (canvas.getActiveObject() === target && target.__corner) return target;
      const pointer = canvas.getPointer(e, true);
      const objs = canvas.getObjects();
      for (let i = objs.indexOf(target) - 1; i >= 0; i -= 1) {
        const o: any = objs[i];
        if (isOpaqueShape(o) && o.containsPoint(pointer)) break;
        if (o.type === "textbox" && o.selectable !== false && o.visible !== false && o.text?.trim() && o.containsPoint(pointer)) {
          return o;
        }
      }
      return target;
    };

    canvas.on("object:added", saveSnapshot);
    canvas.on("object:removed", saveSnapshot);
    canvas.on("object:modified", saveSnapshot);
    // Layers panel: saveSnapshot is paused during loads (template apply,
    // format switch, undo), so the list gets its own unconditional refresh.
    const bumpLayers = () => setLayersVersion((v) => v + 1);
    canvas.on("object:added", bumpLayers);
    canvas.on("object:removed", bumpLayers);
    // Typing into a text that mirrors «Вихідні дані» asks whether to unlink
    // it (WF-SPEC 08 п.6) instead of silently diverging.
    canvas.on("text:changed", (e: any) => {
      if (e.target && isLinkedTextRef.current(e.target)) setUnlinkPrompt(e.target);
    });
    // Selecting something else while mid-crop would strand the image
    // unclipped with a stray outline rect -- snap crop mode closed first.
    const exitCropIfSelectingElsewhere = (next: fabric.Object | null) => {
      if (cropTargetRef.current && next !== cropTargetRef.current) exitCropMode();
    };
    canvas.on("selection:created", (e) => {
      const next = e.selected?.[0] ?? null;
      exitCropIfSelectingElsewhere(next);
      setActiveObj(next);
      if (next) setPanelTab("selected");
    });
    canvas.on("selection:updated", (e) => {
      const next = e.selected?.[0] ?? null;
      exitCropIfSelectingElsewhere(next);
      setActiveObj(next);
      if (next) setPanelTab("selected");
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
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const active = canvas.getActiveObject() as any;
        if (!active || active.isEditing) return; // let text cursor movement happen normally
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        canvas.getActiveObjects().forEach((obj) => {
          obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy });
          obj.setCoords();
        });
        canvas.requestRenderAll();
        saveSnapshot();
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
      illustrationRef.current = savedDesign.illustration ?? null;
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
        applyIllustration(canvas, ctx.layout, illustrationRef.current);
        canvas.renderAll();
        historyRef.current = [];
        historyIndexRef.current = -1;
        saveSnapshot();
        queueMicrotask(() => {
          coverReadyRef.current = true;
        });
      });
    } else {
      template.apply(canvas, ctx);
      canvas.renderAll();
      historyRef.current = [];
      historyIndexRef.current = -1;
      saveSnapshot();
      queueMicrotask(() => {
        coverReadyRef.current = true;
      });

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

      backgroundRef.current = captureBackground(currentObjects, leavingLayout, backgroundRef.current?.color ?? "#1a1a2e");
      illustrationRef.current = captureIllustration(currentObjects, leavingLayout);
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
        applyIllustration(canvas, ctx.layout, illustrationRef.current);
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

  // T7 -- scale the canvas to the available tablet/desktop width so the
  // wrap (back+spine+front) never forces a page-level horizontal scroll.
  // Fabric stays at logical layout pixels; CSS transform is visual only.
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const apply = () => {
      const w = host.clientWidth;
      setCanvasScale(w > 0 ? Math.min(1, w / ctx.layout.totalW) : 1);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, [ctx.layout.totalW]);

  useEffect(() => {
    canvasRef.current?.calcOffset();
  }, [canvasScale, ctx.layout.totalW, ctx.layout.totalH]);

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
      "text-blurb": description || "",
    };
    let changed = false;
    canvas.getObjects().forEach((o: any) => {
      const role = o.data?.role;
      const next = roleToText[role];
      if (next !== undefined && !o.data?.unlinked && o.text !== next) {
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
    // Under every text layer by default (WF-SPEC 08 п.11) -- a new shape
    // must never bury the title; the author can still raise it explicitly.
    const lowestText = canvas.getObjects().findIndex((o) => o.type === "textbox");
    if (lowestText >= 0) canvas.moveTo(rect, Math.max(backgroundFloorIndex(canvas), lowestText));
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

    // Hover highlight -- a bright outline around whichever element is under
    // the cursor, so an author can tell what's clickable before clicking it.
    // Uses the clipPath's own rect (not the object's raw bounding box) for
    // photo-slot/bg-image, since those two are usually panned/zoomed larger
    // than their visible crop window -- outlining the unclipped image would
    // draw well outside what's actually visible on the cover.
    function boundsForHover(obj: any) {
      const clip = obj.clipPath;
      if (clip && clip.left !== undefined) {
        return { left: clip.left, top: clip.top, width: clip.width, height: clip.height };
      }
      const r = obj.getBoundingRect(true, true);
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }

    function drawHoverOutline(obj: any) {
      clearGuides();
      const { left, top, width, height } = boundsForHover(obj);
      const c = fCanvas.contextTop as CanvasRenderingContext2D;
      c.save();
      c.strokeStyle = "#00c2ff";
      c.lineWidth = 2;
      c.setLineDash([]);
      c.strokeRect(left, top, width, height);
      c.restore();
    }

    function onMouseOver(e: fabric.IEvent) {
      const obj = e.target as any;
      if (!obj || obj === fCanvas.getActiveObject()) return;
      const role = obj.data?.role;
      if (role === "accent" || role === "pattern") return; // non-interactive layers never get a hover cue
      drawHoverOutline(obj);
    }

    canvas.on("object:moving", onMoving);
    canvas.on("mouse:up", clearGuides);
    canvas.on("mouse:over", onMouseOver);
    canvas.on("mouse:out", clearGuides);

    return () => {
      canvas.off("object:moving", onMoving);
      canvas.off("mouse:up", clearGuides);
      canvas.off("mouse:over", onMouseOver);
      canvas.off("mouse:out", clearGuides);
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
    if (!obj || (obj.data?.role !== "photo-slot" && obj.data?.role !== "bg-image")) return;

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

  const raiseCoveredTexts = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    findCoveredTexts(canvas).forEach((o) => canvas.bringToFront(o));
    canvas.requestRenderAll();
    saveSnapshot();
  }, [saveSnapshot]);

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
            applyIllustrationImage(canvas, ctx.layout, url);
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
      setCoverDirty(false);
      setCoverSaved(true);
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
    loadMyTemplates();
  }, [loadMyTemplates]);

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
      illustrationRef.current = design.illustration ?? null;
      if (design.background.imageUrl) setBgImageUrl(design.background.imageUrl);

      const frontObjs = repositionFrontObjects(design.front, ctx.layout.front);
      const backSpineObjs = ctx.layout.back ? design.backSpine : [];

      pauseHistoryRef.current = true;
      return new Promise<void>((resolve) => {
        canvas.loadFromJSON(JSON.stringify({ objects: [...frontObjs, ...backSpineObjs] }), () => {
          if (canvasRef.current !== canvas) { resolve(); return; } // T-2067 -- stale callback after unmount
          applyBackground(canvas, ctx.layout, backgroundRef.current, "#1a1a2e");
          applyIllustration(canvas, ctx.layout, illustrationRef.current);
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

  // ── Layers panel / selection (WF-SPEC 08 п.3-6) ──────────────────────────
  const isLinkedText = useCallback(
    (o: any): boolean => !!o && syncFromBookData && LINKED_TEXT_ROLES.has(o.data?.role) && !o.data?.unlinked,
    [syncFromBookData]
  );
  isLinkedTextRef.current = isLinkedText;

  const selectLayer = useCallback((obj: fabric.Object) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    setActiveObj(obj);
    setPanelTab("selected");
  }, []);

  // Rebuilt whenever the canvas changes (layersVersion is bumped by the
  // object:added/removed/modified listeners) -- top of the list is the top
  // of the z-order.
  const layerGroups = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas) return [] as { title: string; rows: LayerRow[] }[];
    const covered = new Set(findCoveredTexts(canvas));
    const spine = ctx.layout.spine;
    const rows: (LayerRow & { group: string })[] = [];
    canvas.getObjects().forEach((o: any, i) => {
      const role: string | undefined = o.data?.role;
      if (role === "crop-outline") return;
      const selectable = o.selectable !== false && o.evented !== false;
      let label = role ? LAYER_LABELS[role] : undefined;
      if (!label) {
        if (!selectable) return; // decorative, role-less (logo, ISBN caption)
        label = o.type === "textbox" ? "Текст" : o.type === "image" ? "Зображення" : "Елемент";
      }
      let group = "";
      if (spine) {
        const cx = o.getCenterPoint().x;
        if (role && BG_LAYER_ROLES.has(role)) group = "Фон та ілюстрація";
        else if (role === "text-spine") group = "Корінець";
        else if (cx < spine.x) group = "Задня сторона";
        else if (cx > spine.x + spine.w) group = "Лицева сторона";
        else group = "Корінець";
      }
      rows.push({
        key: `${i}-${role ?? o.type}`,
        obj: o,
        label,
        selectable,
        hidden: o.visible === false,
        covered: covered.has(o),
        linked: isLinkedText(o),
        group,
      });
    });
    rows.reverse();
    if (!spine) return [{ title: "", rows }];
    return ["Лицева сторона", "Корінець", "Задня сторона", "Фон та ілюстрація"]
      .map((title) => ({ title, rows: rows.filter((r) => r.group === title) }))
      .filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersVersion, activeObj, ctx.layout, isLinkedText]);

  const selectedRole: string | undefined = (activeObj as any)?.data?.role;
  const selectedLabel = activeObj
    ? `${(selectedRole && LAYER_LABELS[selectedRole]) || (activeObj.type === "textbox" ? "Текст" : "Елемент")}${
        activeObj.type === "textbox" ? " · текст" : ""
      }`
    : "";

  // "Відв'язати від Вихідних даних?" -- replaces the old book-wide
  // "редагувати незалежно" checkbox with a per-layer decision made at the
  // moment the author actually edits a linked text.
  const confirmUnlink = useCallback(() => {
    const obj: any = unlinkPrompt;
    if (!obj) return;
    obj.set("data", { ...(obj.data ?? {}), unlinked: true });
    setUnlinkPrompt(null);
    setLayersVersion((v) => v + 1);
    saveSnapshot();
  }, [unlinkPrompt, saveSnapshot]);

  const revertLinkedText = useCallback(() => {
    const canvas = canvasRef.current;
    const obj: any = unlinkPrompt;
    if (!canvas || !obj) return;
    const bookText: Record<string, string> = {
      "text-title": bookTitle,
      "text-author": bookAuthor,
      "text-subtitle": subtitle || "",
      "text-bio": authorBio || "",
      "text-blurb": description || "",
    };
    if (obj.isEditing) obj.exitEditing();
    obj.set({ text: bookText[obj.data?.role] ?? obj.text });
    canvas.requestRenderAll();
    setUnlinkPrompt(null);
  }, [unlinkPrompt, bookTitle, bookAuthor, subtitle, authorBio, description]);

  // "Задня сторона: що показувати" -- annotation/bio are toggled via
  // `visible` (an invisible object is skipped by both render and export);
  // the QR code is added/removed as its own image layer.
  const backBlockShown = (role: string): boolean => {
    const obj: any = canvasRef.current?.getObjects().find((o: any) => o.data?.role === role);
    return !!obj && obj.visible !== false;
  };

  const toggleBackBlock = useCallback(
    (role: string) => {
      const canvas = canvasRef.current;
      const back = ctx.layout.back;
      if (!canvas || !back) return;
      const existing: any = canvas.getObjects().find((o: any) => o.data?.role === role);
      if (role === "qr") {
        if (existing) {
          canvas.remove(existing);
        } else if (bookUrl) {
          try {
            const qr = qrcode(0, "M");
            qr.addData(bookUrl);
            qr.make();
            fabric.Image.fromURL(qr.createDataURL(6, 12), (img) => {
              if (isCanvasDisposed(canvas)) return;
              const size = 56;
              img.set({
                left: back.x + back.w - SAFE_MARGIN - size,
                top: back.y + back.h - SAFE_MARGIN - size,
                scaleX: size / (img.width || size),
                scaleY: size / (img.height || size),
                data: { role: "qr" },
              });
              canvas.add(img);
              canvas.requestRenderAll();
            });
          } catch {
            // A URL too long for a QR code simply doesn't get one.
          }
        }
      } else if (existing) {
        existing.set({ visible: existing.visible === false });
        if (canvas.getActiveObject() === existing && existing.visible === false) canvas.discardActiveObject();
      }
      canvas.requestRenderAll();
      setLayersVersion((v) => v + 1);
      saveSnapshot();
    },
    [ctx.layout.back, bookUrl, saveSnapshot]
  );

  const spineMm =
    format === "ebook" ? 0 : spineThicknessMm(pageCount && pageCount > 0 ? pageCount : 150, format === "hardcover");
  const exportPx = {
    w: Math.round((effectiveTrimMm.widthMm / 25.4) * EXPORT_DPI),
    h: Math.round((effectiveTrimMm.heightMm / 25.4) * EXPORT_DPI),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row">
        {/* ── Шари (WF-SPEC 08 п.3) ─────────────────────────────────────── */}
        <div className="w-full shrink-0 space-y-2 xl:w-[220px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Шари</p>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addRectangle}>
              + Фігура
            </Button>
          </div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border bg-gray-50 p-1.5">
            {layerGroups.length === 0 && <p className="p-2 text-xs text-gray-400">Завантаження…</p>}
            {layerGroups.map((group) => (
              <div key={group.title || "all"}>
                {group.title && (
                  <p className="px-1.5 pb-0.5 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-400">
                    {group.title}
                  </p>
                )}
                {group.rows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    disabled={!row.selectable}
                    onClick={() => selectLayer(row.obj)}
                    title={row.selectable ? row.label : `${row.label} — не редагується напряму`}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs",
                      row.obj === activeObj
                        ? "bg-blue-100 font-medium text-blue-900"
                        : row.covered
                          ? "bg-amber-100 text-amber-900"
                          : row.selectable
                            ? "text-gray-700 hover:bg-white"
                            : "cursor-default text-gray-400"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    {row.hidden && <span className="shrink-0 text-[0.625rem] text-gray-400">приховано</span>}
                    {row.covered && <span className="shrink-0" title="Фігура перекриває цей текст">⚠</span>}
                    {row.linked && (
                      <span className="shrink-0" title="Пов'язано з «Вихідними даними» — оновлюється автоматично">
                        🔗
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[0.6875rem] leading-snug text-gray-400">
            Зверху — шари, що лежать над іншими. 🔗 — текст береться з «Вихідних даних».
          </p>
        </div>

        {/* ── Полотно ───────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium",
              activeObj ? "bg-blue-600 text-white" : "text-gray-400"
            )}
          >
            {activeObj ? selectedLabel : "Клікніть елемент, щоб змінити його"}
          </span>
        <div ref={canvasHostRef} className="w-full max-w-full">
          <div
            className="mx-auto rounded-lg border-2 border-gray-200 shadow-md"
            style={{
              width: ctx.layout.totalW * canvasScale,
              height: ctx.layout.totalH * canvasScale,
              overflow: "hidden",
            }}
          >
          <div
            className="relative origin-top-left"
            style={{
              width: ctx.layout.totalW,
              height: ctx.layout.totalH,
              transform: `scale(${canvasScale})`,
            }}
          >
            <canvas ref={canvasEl} />
            {/* Non-printing guides marking the spine (торець книжки) fold lines,
                so the author can judge its real thickness and whether text fits
                there -- a plain DOM overlay rather than fabric objects, so it
                never has to be re-added after every loadFromJSON (format
                switch, undo/redo, template apply) and can never leak into an
                export (fabric's excludeFromExport is respected by toJSON but
                not by toDataURL, so a canvas object here would need explicit
                removal before every render). */}
            {[ctx.layout.front, ctx.layout.back].map(
              (p, i) =>
                p && (
                  <div
                    key={i}
                    className="pointer-events-none absolute border border-dashed border-blue-500/60"
                    style={{
                      left: p.x + SAFE_MARGIN,
                      top: p.y + SAFE_MARGIN,
                      width: p.w - SAFE_MARGIN * 2,
                      height: p.h - SAFE_MARGIN * 2,
                    }}
                  />
                )
            )}
            {ctx.layout.spine && ctx.layout.spine.w > 0 && (
              <>
                <div
                  className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-orange-500/80"
                  style={{ left: ctx.layout.spine.x }}
                />
                <div
                  className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-orange-500/80"
                  style={{ left: ctx.layout.spine.x + ctx.layout.spine.w }}
                />
              </>
            )}
          </div>
          </div>
        </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.6875rem] text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-5 border-t-2 border-dashed border-blue-500" />
              безпечна зона {COVER_SAFE_ZONE_MIN_MM}–{COVER_SAFE_ZONE_MAX_MM} мм — текст тримайте всередині
            </span>
            {format !== "ebook" && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0 w-5 border-t-2 border-dashed border-orange-500" />
                корінець {spineMm.toFixed(1)} мм{format === "hardcover" ? " (тверда палітурка)" : ""} · текст на
                корінці — від {MIN_SPINE_TEXT_PAGES} сторінок
              </span>
            )}
          </div>
        {format !== "ebook" &&
          pageCount != null &&
          pageCount > 0 &&
          isSpineTooThinForText(pageCount, format === "hardcover") && (
            <p
              role="status"
              className="w-full max-w-lg rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              Книга має {pageCount} {pageCount === 1 ? "сторінку" : "сторінок"} (корінець ~
              {spineThicknessMm(pageCount, format === "hardcover").toFixed(1)} мм). Текст на корінці
              підтримується лише від {MIN_SPINE_TEXT_PAGES} сторінок (вимога Amazon KDP). Надрукувати
              книгу все одно можна — лишити корінець без тексту.
            </p>
          )}
        {coveredTexts.length > 0 && (
          <div
            role="status"
            className="flex w-full max-w-lg flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            <span className="flex-1">
              Фігура перекриває текст {coveredTexts.map((t) => `«${t}»`).join(", ")}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={raiseCoveredTexts}>
              Перенести текст наверх
            </Button>
          </div>
        )}
        </div>

        {/* ── Права панель: «Вибране» / «Дизайн» (WF-SPEC 08 п.2) ────────── */}
        <div className="w-full space-y-3 xl:w-[340px] xl:shrink-0">
          <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
            {(["selected", "design"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPanelTab(tab)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                  panelTab === tab ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab === "selected" ? "Вибране" : "Дизайн"}
              </button>
            ))}
          </div>

          {panelTab === "selected" && (
            <div className="space-y-3">
              {!activeObj && !croppingSlot && (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-gray-400">
                  Клікніть елемент на обкладинці або в списку шарів, щоб змінити його.
                </p>
              )}

              {activeObj && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{selectedLabel}</p>
                  {isLinkedText(activeObj) && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[0.6875rem] font-medium text-blue-700 ring-1 ring-blue-200">
                      🔗 Вихідні дані
                    </span>
                  )}
                </div>
              )}

              {activeObj && unlinkPrompt === activeObj && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">Відв&apos;язати від Вихідних даних?</p>
                  <p>Цей текст на обкладинці перестане оновлюватися разом із «Вихідними даними».</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="h-7 text-xs" onClick={confirmUnlink}>
                      Відв&apos;язати й змінити
                    </Button>
                    <Button asChild type="button" variant="outline" size="sm" className="h-7 text-xs">
                      <Link href={`/dashboard/books/${bookId}/output-data`} onClick={revertLinkedText}>
                        Змінити у «Вихідних даних»
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

        {activeObj?.type === "textbox" && (
          <div className="space-y-2 rounded-lg border bg-gray-50 p-2">
            <p className="text-xs font-medium text-gray-500">Текст</p>
            <div className="flex flex-wrap items-center gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => toggleTextStyle("fontWeight")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Жирний">
                <Bold size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => toggleTextStyle("fontStyle")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Курсив">
                <Italic size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => toggleTextStyle("underline")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Підкреслення">
                <Underline size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => toggleTextStyle("linethrough")} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Закреслення">
                <Strikethrough size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={toggleAllCaps} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="Всі літери великі">
                <CaseUpper size={15} />
              </Button>
              <div className="mx-0.5 h-5 w-px bg-gray-300" />
              <Button type="button" variant="ghost" size="icon" onClick={() => updateSelected({ textAlign: "left" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="По лівому краю">
                <AlignLeft size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => updateSelected({ textAlign: "center" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="По центру">
                <AlignCenter size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => updateSelected({ textAlign: "right" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="По правому краю">
                <AlignRight size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => updateSelected({ textAlign: "justify" })} className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900" title="На всю ширину">
                <AlignJustify size={15} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={(activeObj as fabric.Textbox).fontFamily || FONTS[0]}
                onValueChange={(v) => updateSelected({ fontFamily: v })}
              >
                <SelectTrigger className="h-7 flex-1 rounded border-gray-200 bg-white px-1.5 text-xs" title="Шрифт">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="color"
                value={typeof (activeObj as any)?.fill === "string" ? ((activeObj as any).fill as string) : "#000000"}
                onChange={(e) => updateSelected({ fill: e.target.value })}
                className="h-7 w-9 shrink-0 cursor-pointer rounded border border-gray-200"
                title="Колір тексту"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-20 shrink-0 text-xs text-gray-500">Розмір</label>
              <div className="flex flex-1 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateSelected({
                      fontSize: clampFontSize(((activeObj as fabric.Textbox).fontSize ?? 16) - 1),
                    })
                  }
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900"
                  title="Зменшити розмір шрифту"
                >
                  <Minus size={13} />
                </Button>
                <input
                  type="number"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={Math.round((activeObj as fabric.Textbox).fontSize ?? 16)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    updateSelected({ fontSize: clampFontSize(v) });
                  }}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    updateSelected({ fontSize: clampFontSize(Number.isFinite(v) ? v : 16) });
                  }}
                  className="h-7 w-14 rounded border border-gray-200 bg-white px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  title="Розмір шрифту"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateSelected({
                      fontSize: clampFontSize(((activeObj as fabric.Textbox).fontSize ?? 16) + 1),
                    })
                  }
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900"
                  title="Збільшити розмір шрифту"
                >
                  <Plus size={13} />
                </Button>
              </div>
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

        {(["photo-slot", "bg-image"].includes((activeObj as any)?.data?.role) || croppingSlot) && (
          <Button variant="outline" size="sm" className="w-full" onClick={toggleCropMode}>
            {croppingSlot ? "✓ Застосувати кадрування" : "Кадрувати зображення"}
          </Button>
        )}

              {activeObj && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Вирівняти на обкладинці · порядок шарів</p>
        {activeObj && (
          <div className="flex w-full items-center justify-center gap-1 rounded-lg border bg-gray-50 p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => alignSelected("left")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="До безпечної зони ліворуч"
            >
              <AlignHorizontalJustifyStart size={15} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => alignSelected("center")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="По центру сторінки"
            >
              <AlignHorizontalJustifyCenter size={15} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => alignSelected("right")}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-white hover:text-gray-900"
              title="До безпечної зони праворуч"
            >
              <AlignHorizontalJustifyEnd size={15} />
            </Button>
            <div className="mx-1 h-5 w-px bg-gray-300" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => changeLayer("front")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="На передній план"
            >
              ⤒
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => changeLayer("forward")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="Перемістити вище"
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => changeLayer("backward")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="Перемістити нижче"
            >
              ↓
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => changeLayer("back")}
              className="flex h-7 w-7 items-center justify-center rounded text-sm text-gray-600 hover:bg-white hover:text-gray-900"
              title="На задній план"
            >
              ⤓
            </Button>
          </div>
        )}
                </div>
              )}

              {format !== "ebook" && (
                <div className="space-y-1.5 rounded-lg border bg-gray-50 p-2">
                  <p className="text-xs font-medium text-gray-500">Задня сторона: що показувати</p>
                  {BACK_TOGGLES.map((t) => (
                    <label key={t.role} className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={backBlockShown(t.role)}
                        disabled={t.role === "qr" && !bookUrl}
                        onChange={() => toggleBackBlock(t.role)}
                      />
                      {t.label}
                      {t.linked && syncFromBookData && <span title="Береться з «Вихідних даних»">🔗</span>}
                    </label>
                  ))}
                  <p className="text-[0.6875rem] leading-snug text-gray-400">
                    Порожній блок (без анотації чи біографії у «Вихідних даних») на обкладинку не потрапляє.
                  </p>
                </div>
              )}
            </div>
          )}

          {panelTab === "design" && (
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Шаблони</p>
        {(
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const canvas = canvasRef.current;
                          if (canvas) applyIllustrationImage(canvas, ctx.layout, img.url);
                        }}
                        className="h-full w-full p-0"
                      >
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLibraryImage(img.url)}
                        className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-[10px] text-white opacity-0 transition-opacity hover:bg-black/60 hover:text-white group-hover:opacity-100"
                        aria-label="Видалити"
                      >
                        ×
                      </Button>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={selectBgImage}
                      className="h-6 w-6 overflow-hidden rounded border-2 border-gray-900 p-0"
                      aria-label="Завантажене фонове зображення"
                      title="Завантажене фонове зображення"
                    >
                      <img src={bgImageUrl} alt="" className="h-full w-full object-cover" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeBgImage}
                      className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-[9px] text-white hover:bg-red-600 hover:text-white"
                      aria-label="Прибрати фонове зображення"
                      title="Прибрати фонове зображення"
                    >
                      ×
                    </Button>
                  </div>
                )}
                {template.palette.map((color) => (
                  <Button
                    key={color}
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => recolor(color)}
                    style={{ backgroundColor: color }}
                    className="h-6 w-6 rounded border border-gray-300 p-0 hover:opacity-80"
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            applyBackgroundImage(canvas, ctx.layout, img.url);
                            setBgImageUrl(img.url);
                          }}
                          className="h-full w-full p-0"
                        >
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLibraryImage(img.url)}
                          className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-[10px] text-white opacity-0 transition-opacity hover:bg-black/60 hover:text-white group-hover:opacity-100"
                          aria-label="Видалити"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
              {myTemplates.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Мої шаблони</p>
              )}
        {myTemplates.length > 0 && (
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
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Своя обкладинка</p>
        {(
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
            {/* WF-SPEC 08 п.8 -- three verdicts: red = below the minimum
                (rejected above), amber = usable but under the 300 DPI print
                target, green = fine. */}
            {ownCoverDims && !ownCoverError && (ownCoverDims.w < exportPx.w || ownCoverDims.h < exportPx.h) && (
              <p className="text-xs text-amber-600">
                ⚠ {ownCoverDims.w}×{ownCoverDims.h}px — застосовано, але для друку може бути нечітко (бажано від{" "}
                {exportPx.w}×{exportPx.h}px)
              </p>
            )}
            {ownCoverDims && !ownCoverError && ownCoverDims.w >= exportPx.w && ownCoverDims.h >= exportPx.h && (
              <p className="text-xs text-green-600">✓ {ownCoverDims.w}×{ownCoverDims.h}px — підходить, застосовано</p>
            )}
            {ownCoverError && <p className="text-xs text-red-500">{ownCoverError}</p>}

          </div>
        )}
            </div>
          )}
        </div>
      </div>

      {/* ── Нижня панель: одна головна дія (WF-SPEC 08 п.13) ─────────────── */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-wrap items-center gap-3 rounded-b-xl border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={undoCanvas} disabled={!canUndo} title="Скасувати (Ctrl+Z)">
            ↩ Undo
          </Button>
          <Button variant="outline" size="sm" onClick={redoCanvas} disabled={!canRedo} title="Повторити (Ctrl+Y)">
            ↪ Redo
          </Button>
        </div>
        <span className="text-xs text-gray-400">
          Збережеться як PNG {exportPx.w}×{exportPx.h} px (300 DPI)
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {saveError && <span className="text-xs text-red-500">{saveError}</span>}
          {lockedUntilLabel ? (
            <span className="text-xs text-gray-500">🔒 Наступна зміна обкладинки можлива з {lockedUntilLabel}</span>
          ) : (
            <>
              {coverDirty && <span className="text-xs text-amber-700">● Є незбережені зміни</span>}
              {isPublished && (
                <span className="text-xs text-gray-500">
                  Книга опублікована: піде на затвердження · використовує ліміт 90 днів
                </span>
              )}
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Більше дій" className="h-9 w-9">
                ⋯
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={savingTemplate} onClick={saveAsTemplate}>
                Зберегти як шаблон
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTemplate(template)}>Скинути до шаблону</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SaveActionButton
            state={saving ? "saving" : coverSaved && !coverDirty ? "saved" : "idle"}
            idleLabel="Зберегти"
            onClick={saveToBook}
            disabled={!!lockedUntilLabel}
            title={lockedUntilLabel ? `Наступна зміна можлива з ${lockedUntilLabel}` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
