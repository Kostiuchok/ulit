import type { CoverTheme, CoverThemeToken } from "shared-types";

// Canvas-2D layout engine for the auto-cover templates
// (docs/dashboard-ui/cover-styles/STYLES.md). Canvas rather than HTML/SVG on
// purpose: the SAME draw call renders the on-screen preview and the
// print-resolution PNG that gets uploaded as the book's cover, with word
// wrapping measured by the real font (measureText) -- no DOM-to-image step,
// no second layout implementation that could disagree with the preview.
//
// Units follow the spec: font sizes / vertical distances are % of the cover
// height H, horizontal ones % of the width W. Strokes are given in px at the
// Figma component width (400).

export type Tok = CoverThemeToken;
export type Align = "left" | "center";

export interface TextSpec {
  family: string;
  weight: number;
  italic?: boolean;
  size: number; // % of H
  lineHeight?: number;
  token: Tok;
  align: Align;
  upper?: boolean;
  letterSpacing?: number; // em
}

export type Node =
  | { t: "text"; text: string; spec: TextSpec; padX?: number; isTitle?: boolean }
  | { t: "shape"; shape: "rule" | "diamond" | "star8" | "square"; w: number; h: number; token: Tok; bleed?: boolean }
  | { t: "row"; gap: number; children: Node[] }
  | {
      t: "stack";
      gap: number;
      children: Node[];
      pad?: [number, number, number, number]; // top %H, right %W, bottom %H, left %W
      fill?: Tok;
      stroke?: { token: Tok; px: number };
      align?: Align;
      bleed?: boolean; // ignore the parent's horizontal padding (full cover width)
    }
  | { t: "spacer"; h: number }
  | { t: "gradient"; h: number; bleed?: boolean }
  | { t: "image"; img: CanvasImageSource; w: number; ratio: number; round?: boolean }
  | { t: "custom"; w: number; h: number; draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void };

export type Decor =
  | { shape: "rect"; token: Tok; x: number; y: number; w: number; h: number; opacity?: number }
  | { shape: "rect-stroke"; token: Tok; stroke: number; x: number; y: number; w: number; h: number }
  | { shape: "ellipse"; token: Tok; x: number; y: number; w: number; h: number; opacity?: number; blur?: number }
  | { shape: "ellipse-stroke"; token: Tok; stroke: number; x: number; y: number; w: number; h: number }
  | { shape: "star8"; token: Tok; size: number; positions: [number, number][] }
  | { shape: "geometry"; token: Tok }
  | { shape: "vyshyvanka"; bands: { y: number; h: number }[] }
  | { shape: "stripes"; token: Tok; stripe: number; period: number }
  | { shape: "photo"; img: CanvasImageSource | null; focal: [number, number] };

export interface CoverDoc {
  decor: Decor[];
  pad: [number, number, number, number];
  justify: "space-between" | "start" | "end" | "center";
  align: Align;
  children: Node[];
  maxTitleLines: number;
  // Content must end above this % of H (texture-3's circles start at 71%).
  maxContentBottom?: number;
  // % of H that must stay free of content (photo templates: the text plate
  // grows upward with a long title but never swallows the whole photo).
  reserve?: number;
}

export interface RenderResult {
  // Title needed more lines than the template allows, or the text block
  // didn't fit its area -- the UI suggests a "Мінімал" template.
  overflow: boolean;
}

interface Env {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  theme: CoverTheme;
  titleLines: number;
  // Auto-fit factor applied to every text size (1 = as designed).
  scale: number;
}

const FALLBACK: Record<string, string> = {
  "Playfair Display": "Georgia, serif",
  Lora: "Georgia, serif",
  "Cormorant Garamond": "Georgia, serif",
  "PT Serif": "Georgia, serif",
  "Yeseva One": "Georgia, serif",
};

export function fontString(spec: Pick<TextSpec, "family" | "weight" | "italic">, px: number): string {
  return `${spec.italic ? "italic " : ""}${spec.weight} ${px}px "${spec.family}", ${FALLBACK[spec.family] ?? "Arial, sans-serif"}`;
}

function strWidth(ctx: CanvasRenderingContext2D, s: string, lsPx: number): number {
  return ctx.measureText(s).width + (lsPx ? lsPx * s.length : 0);
}

// Word wrap; a single word wider than the line is broken by characters --
// text is never clipped or dropped.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, lsPx: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (strWidth(ctx, candidate, lsPx) <= maxW) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (strWidth(ctx, line, lsPx) > maxW && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && strWidth(ctx, line.slice(0, cut), lsPx) > maxW) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface Measured {
  w: number;
  h: number;
  lines?: string[];
  px?: number;
  lsPx?: number;
  children?: Measured[];
}

function textMetrics(env: Env, node: Extract<Node, { t: "text" }>, availW: number) {
  const { ctx, H, W } = env;
  const px = (node.spec.size / 100) * H * env.scale;
  const lsPx = (node.spec.letterSpacing ?? 0) * px;
  ctx.font = fontString(node.spec, px);
  const text = node.spec.upper ? node.text.toUpperCase() : node.text;
  const padX = ((node.padX ?? 0) / 100) * W;
  const lines = wrap(ctx, text, Math.max(10, availW - padX * 2), lsPx);
  return { px, lsPx, lines, padX };
}

function measure(env: Env, node: Node, availW: number): Measured {
  const { W, H } = env;
  switch (node.t) {
    case "text": {
      const { px, lsPx, lines } = textMetrics(env, node, availW);
      if (node.isTitle) env.titleLines = Math.max(env.titleLines, lines.length);
      const widest = Math.max(0, ...lines.map((l) => strWidth(env.ctx, l, lsPx)));
      return { w: Math.min(availW, widest), h: lines.length * px * (node.spec.lineHeight ?? 1.25), lines, px, lsPx };
    }
    case "shape":
      return { w: node.bleed ? W : (node.w / 100) * W, h: Math.max(1, (node.h / 100) * H) };
    case "spacer":
      return { w: 0, h: (node.h / 100) * H };
    case "gradient":
      return { w: W, h: (node.h / 100) * H };
    case "image": {
      const w = (node.w / 100) * W;
      return { w, h: w * node.ratio };
    }
    case "custom":
      return { w: (node.w / 100) * W, h: (node.h / 100) * H };
    case "row": {
      const gap = (node.gap / 100) * W;
      let used = 0;
      const children: Measured[] = [];
      node.children.forEach((c, i) => {
        const m = measure(env, c, availW - used);
        children.push(m);
        used += m.w + (i < node.children.length - 1 ? gap : 0);
      });
      return { w: used, h: Math.max(0, ...children.map((c) => c.h)), children };
    }
    case "stack": {
      const outerW = node.bleed ? W : availW;
      const [pt, pr, pb, pl] = node.pad ?? [0, 0, 0, 0];
      const innerW = outerW - ((pr + pl) / 100) * W;
      const gap = (node.gap / 100) * H;
      const children = node.children.map((c) => measure(env, c, innerW));
      const h =
        children.reduce((s, c) => s + c.h, 0) + gap * Math.max(0, children.length - 1) + ((pt + pb) / 100) * H;
      return { w: outerW, h, children };
    }
  }
}

function star8Path(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner = 0.5) {
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function diamondPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

function drawTextLines(
  env: Env,
  node: Extract<Node, { t: "text" }>,
  m: Measured,
  x: number,
  y: number,
  availW: number,
  align: Align
) {
  const { ctx, theme, W } = env;
  const px = m.px!;
  const lsPx = m.lsPx!;
  const lh = px * (node.spec.lineHeight ?? 1.25);
  const padX = ((node.padX ?? 0) / 100) * W;
  ctx.font = fontString(node.spec, px);
  ctx.fillStyle = theme[node.spec.token];
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  m.lines!.forEach((line, i) => {
    const lw = strWidth(ctx, line, lsPx) - lsPx; // no trailing tracking
    const lx = align === "center" ? x + (availW - lw) / 2 : x + padX;
    const ly = y + i * lh + lh / 2 + px * 0.35;
    if (!lsPx) {
      ctx.fillText(line, lx, ly);
      return;
    }
    // Manual tracking -- ctx.letterSpacing isn't available everywhere.
    let cx = lx;
    for (const ch of line) {
      ctx.fillText(ch, cx, ly);
      cx += ctx.measureText(ch).width + lsPx;
    }
  });
}

function draw(env: Env, node: Node, m: Measured, x: number, y: number, availW: number, align: Align) {
  const { ctx, W, H, theme } = env;
  switch (node.t) {
    case "text":
      drawTextLines(env, node, m, x, y, availW, node.spec.align ?? align);
      return;
    case "shape": {
      const sx = node.bleed ? 0 : align === "center" ? x + (availW - m.w) / 2 : x;
      ctx.fillStyle = theme[node.token];
      if (node.shape === "diamond") {
        diamondPath(ctx, sx, y, m.w, m.h);
        ctx.fill();
      } else if (node.shape === "star8") {
        star8Path(ctx, sx + m.w / 2, y + m.h / 2, m.w / 2);
        ctx.fill();
      } else {
        ctx.fillRect(sx, y, m.w, m.h);
      }
      return;
    }
    case "gradient": {
      const g = ctx.createLinearGradient(0, y, 0, y + m.h);
      g.addColorStop(0, `${theme.bg}00`);
      g.addColorStop(1, theme.bg);
      ctx.fillStyle = g;
      // +1px so no hairline shows between the fade and the plate below.
      ctx.fillRect(0, y, W, m.h + 1);
      return;
    }
    case "image": {
      const ix = align === "center" ? x + (availW - m.w) / 2 : x;
      ctx.save();
      if (node.round) {
        ctx.beginPath();
        ctx.ellipse(ix + m.w / 2, y + m.h / 2, m.w / 2, m.h / 2, 0, 0, Math.PI * 2);
        ctx.clip();
      }
      try {
        ctx.drawImage(node.img, ix, y, m.w, m.h);
      } catch {
        // A broken image must not take the whole cover down.
      }
      ctx.restore();
      return;
    }
    case "custom": {
      const cx = align === "center" ? x + (availW - m.w) / 2 : x;
      node.draw(ctx, cx, y, m.w, m.h);
      return;
    }
    case "spacer":
      return;
    case "row": {
      const gap = (node.gap / 100) * W;
      let cx = align === "center" ? x + (availW - m.w) / 2 : x;
      node.children.forEach((c, i) => {
        const cm = m.children![i];
        draw(env, c, cm, cx, y + (m.h - cm.h) / 2, cm.w, "left");
        cx += cm.w + gap;
      });
      return;
    }
    case "stack": {
      const ox = node.bleed ? 0 : x;
      const [pt, , , pl] = node.pad ?? [0, 0, 0, 0];
      const pr = node.pad?.[1] ?? 0;
      if (node.fill) {
        ctx.fillStyle = theme[node.fill];
        ctx.fillRect(ox, y, m.w, m.h);
      }
      if (node.stroke) {
        const sw = (node.stroke.px * W) / 400;
        ctx.strokeStyle = theme[node.stroke.token];
        ctx.lineWidth = sw;
        ctx.strokeRect(ox + sw / 2, y + sw / 2, m.w - sw, m.h - sw);
      }
      const innerX = ox + (pl / 100) * W;
      const innerW = m.w - ((pl + pr) / 100) * W;
      const gap = (node.gap / 100) * H;
      let cy = y + (pt / 100) * H;
      node.children.forEach((c, i) => {
        const cm = m.children![i];
        draw(env, c, cm, innerX, cy, innerW, node.align ?? align);
        cy += cm.h + gap;
      });
      return;
    }
  }
}

function drawDecor(env: Env, d: Decor) {
  const { ctx, W, H, theme } = env;
  const X = (v: number) => (v / 100) * W;
  const Y = (v: number) => (v / 100) * H;
  ctx.save();
  switch (d.shape) {
    case "rect":
      ctx.globalAlpha = d.opacity ?? 1;
      ctx.fillStyle = theme[d.token];
      ctx.fillRect(X(d.x), Y(d.y), X(d.w), Y(d.h));
      break;
    case "rect-stroke": {
      const sw = (d.stroke * W) / 400;
      ctx.strokeStyle = theme[d.token];
      ctx.lineWidth = sw;
      ctx.strokeRect(X(d.x) + sw / 2, Y(d.y) + sw / 2, X(d.w) - sw, Y(d.h) - sw);
      break;
    }
    case "ellipse": {
      const rx = X(d.w) / 2;
      const ry = Y(d.h) / 2;
      const cx = X(d.x) + rx;
      const cy = Y(d.y) + ry;
      ctx.globalAlpha = d.opacity ?? 1;
      if (d.blur) {
        // A blurred blob as a radial gradient (same look as the spec's
        // feGaussianBlur, without ctx.filter, which Safari lacks).
        const b = Y(d.blur);
        const R = rx + b;
        ctx.translate(cx, cy);
        ctx.scale(1, (ry + b) / R);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        const solid = Math.max(0, (rx - b * 1.2) / R);
        g.addColorStop(0, theme[d.token]);
        g.addColorStop(solid, theme[d.token]);
        g.addColorStop((solid + 1) / 2, `${theme[d.token]}80`);
        g.addColorStop(1, `${theme[d.token]}00`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = theme[d.token];
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "ellipse-stroke": {
      const sw = (d.stroke * W) / 400;
      ctx.strokeStyle = theme[d.token];
      ctx.lineWidth = sw;
      ctx.beginPath();
      ctx.ellipse(X(d.x) + X(d.w) / 2, Y(d.y) + Y(d.h) / 2, X(d.w) / 2, Y(d.h) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "star8": {
      ctx.fillStyle = theme[d.token];
      const r = X(d.size) / 2;
      for (const [px, py] of d.positions) {
        star8Path(ctx, X(px) + r, Y(py) + r, r);
        ctx.fill();
      }
      break;
    }
    case "geometry": {
      // Rapport: circles on even (i+j), diamonds on odd; step 10% of W.
      ctx.fillStyle = theme[d.token];
      const step = X(10);
      const ox = X(5);
      const oy = Y(3.12);
      for (let j = 0; oy + j * step < H + step; j += 1) {
        for (let i = 0; ox + i * step < W + step; i += 1) {
          const cx = ox + i * step;
          const cy = oy + j * step;
          if ((i + j) % 2 === 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, X(1.5), 0, Math.PI * 2);
            ctx.fill();
          } else {
            const r = X(1.75);
            diamondPath(ctx, cx - r, cy - r, r * 2, r * 2);
            ctx.fill();
          }
        }
      }
      break;
    }
    case "vyshyvanka": {
      // Cross-stitch bands: 1%-of-W cells, a 17x17 diamond motif repeated
      // every 18 cells, dotted border rows above and below.
      const cell = W / 100;
      const C = 8;
      for (const band of d.bands) {
        const top = Y(band.y);
        const rows = Math.max(21, Math.round(Y(band.h) / cell));
        const motifTop = Math.floor((rows - 17) / 2);
        const put = (col: number, row: number, tok: Tok) => {
          ctx.fillStyle = theme[tok];
          ctx.fillRect(Math.round(col * cell), Math.round(top + row * cell), Math.ceil(cell), Math.ceil(cell));
        };
        for (let col = 0; col < 100; col += 2) {
          put(col, 0, "line");
          put(col, rows - 1, "line");
        }
        // Motif centres at 50 +/- k*18 (cell columns), centred on the cover.
        for (let k = -3; k <= 3; k += 1) {
          const centre = 50 + k * 18 - 0.5;
          for (let i = 0; i < 17; i += 1) {
            for (let j = 0; j < 17; j += 1) {
              const dx = Math.abs(i - C);
              const dy = Math.abs(j - C);
              const dist = dx + dy;
              const a =
                dist === 8 || (dist === 5 && (dx === 0 || dy === 0)) || (dist === 6 && (dx === 1 || dy === 1));
              const b = dist <= 2 || (dist === 4 && dx === dy);
              if (!a && !b) continue;
              const col = centre - C + i;
              if (col < -1 || col > 100) continue;
              put(col, motifTop + j, a ? "accent" : "line");
            }
          }
          // Small vertical cross in the one-cell gap between motifs.
          const gapCol = centre + 9;
          if (gapCol > 0 && gapCol < 99) {
            for (let j = -1; j <= 1; j += 1) put(gapCol, motifTop + C + j, "line");
          }
        }
      }
      break;
    }
    case "stripes": {
      ctx.strokeStyle = theme[d.token];
      ctx.lineWidth = X(d.stripe);
      const period = X(d.period) * Math.SQRT2;
      ctx.beginPath();
      for (let x = -H; x < W + H; x += period) {
        ctx.moveTo(x, H);
        ctx.lineTo(x + H, 0);
      }
      ctx.stroke();
      break;
    }
    case "photo": {
      if (d.img) {
        // object-fit: cover around the focal point.
        const iw = (d.img as HTMLCanvasElement).width;
        const ih = (d.img as HTMLCanvasElement).height;
        const scale = Math.max(W / iw, H / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = Math.min(0, Math.max(W - dw, W / 2 - dw * d.focal[0]));
        const dy = Math.min(0, Math.max(H - dh, H / 2 - dh * d.focal[1]));
        ctx.drawImage(d.img, dx, dy, dw, dh);
      }
      // tint: the photo takes on the base hue; wash: evens out the tone.
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = theme.photoTint;
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = theme.photoWash;
      ctx.fillRect(0, 0, W, H);
      break;
    }
  }
  ctx.restore();
}

export function renderDoc(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  theme: CoverTheme,
  doc: CoverDoc
): RenderResult {
  const env: Env = { ctx, W, H, theme, titleLines: 0, scale: 1 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  for (const d of doc.decor) drawDecor(env, d);

  const [pt, pr, pb, pl] = doc.pad;
  const x = (pl / 100) * W;
  const availW = W - ((pl + pr) / 100) * W;
  const top = (pt / 100) * H;
  const limit = doc.maxContentBottom != null ? (doc.maxContentBottom / 100) * H : H - (pb / 100) * H;
  const availH = limit - top;

  // Auto-fit: a title too long for the template shrinks ALL the text
  // together (down to 55%) until the block fits -- text is never clipped and
  // never leaves its area. The caller still gets overflow=true so the UI can
  // suggest a roomier template.
  let measured: Measured[] = [];
  let total = 0;
  let designLines = 0;
  for (let scale = 1; scale >= 0.549; scale -= 0.05) {
    env.scale = scale;
    env.titleLines = 0;
    measured = doc.children.map((c) => measure(env, c, availW));
    total = measured.reduce((sum, m) => sum + m.h, 0);
    if (scale === 1) designLines = env.titleLines;
    if (total <= availH - ((doc.reserve ?? 0) / 100) * H + 1) break;
  }
  const free = availH - total;

  let y = top;
  let gap = 0;
  if (free > 0) {
    if (doc.justify === "end") y = top + free;
    else if (doc.justify === "center") y = top + free / 2;
    else if (doc.justify === "space-between" && measured.length > 1) gap = free / (measured.length - 1);
    else if (doc.justify === "space-between") y = top + free / 2;
  } else if (doc.justify === "end") {
    // Too tall: keep the bottom anchored, like the spec's "grows upward".
    y = top + free;
  }
  let bottom = y;
  doc.children.forEach((c, i) => {
    draw(env, c, measured[i], x, y, availW, doc.align);
    y += measured[i].h;
    bottom = y;
    y += gap;
  });
  ctx.restore();

  const overflow = env.scale < 1 || free < -1 || bottom > limit + 1 || designLines > doc.maxTitleLines;
  return { overflow };
}
