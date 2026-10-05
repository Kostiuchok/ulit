// Auto-cover colour theme (docs/dashboard-ui/cover-styles/STYLES.md §1):
// the author picks ONE colour (`base`); every token the 14 templates paint
// with is derived from it here. A line-for-line port of the reference
// derive.py in that folder -- including Python's colorsys HLS maths, so the
// output matches tokens.json hex-for-hex (asserted in
// apps/api/src/__tests__/cover-theme.test.ts).

type Rgb = [number, number, number];

export interface CoverTheme {
  base: string;
  bg: string;
  bgAlt: string;
  surface: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textOnAccent: string;
  textOnSurface: string;
  line: string;
  pattern: string;
  // Light base == dark text. Drives the photo templates' tint/wash opacity.
  isLight: boolean;
  photoTint: number;
  photoWash: number;
}

export type CoverThemeToken = Exclude<keyof CoverTheme, "isLight" | "photoTint" | "photoWash">;

export const DEFAULT_COVER_BASE_COLOR = "#1F3A5F";

export const coverBaseColorPattern = /^#[0-9a-fA-F]{6}$/;

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

function rgbToHex(c: Rgb): string {
  return (
    "#" +
    c
      .map((v) =>
        Math.round(Math.max(0, Math.min(1, v)) * 255)
          .toString(16)
          .padStart(2, "0")
          .toUpperCase()
      )
      .join("")
  );
}

function luminance(c: Rgb): number {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

function contrastRgb(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// WCAG 2.x contrast ratio between two #RRGGBB colours.
export function coverContrast(a: string, b: string): number {
  return contrastRgb(hexToRgb(a), hexToRgb(b));
}

function mod1(v: number): number {
  return ((v % 1) + 1) % 1;
}

function hueToChannel(m1: number, m2: number, hue: number): number {
  const h = mod1(hue);
  if (h < 1 / 6) return m1 + (m2 - m1) * h * 6;
  if (h < 0.5) return m2;
  if (h < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - h) * 6;
  return m1;
}

// h in degrees, s/l in 0..1 (clamped, like the reference).
function hsl(hDeg: number, s: number, l: number): Rgb {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  const ll = Math.max(0, Math.min(1, l));
  const ss = Math.max(0, Math.min(1, s));
  if (ss === 0) return [ll, ll, ll];
  const m2 = ll <= 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const m1 = 2 * ll - m2;
  return [hueToChannel(m1, m2, h + 1 / 3), hueToChannel(m1, m2, h), hueToChannel(m1, m2, h - 1 / 3)];
}

function toHsl(c: Rgb): [number, number, number] {
  const [r, g, b] = c;
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const sumc = maxc + minc;
  const rangec = maxc - minc;
  const l = sumc / 2;
  if (minc === maxc) return [0, 0, l];
  const s = l <= 0.5 ? rangec / sumc : rangec / (2 - maxc - minc);
  const rc = (maxc - r) / rangec;
  const gc = (maxc - g) / rangec;
  const bc = (maxc - b) / rangec;
  let h: number;
  if (r === maxc) h = bc - gc;
  else if (g === maxc) h = 2 + rc - bc;
  else h = 4 + gc - rc;
  return [mod1(h / 6) * 360, s, l];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => a[i] * (1 - t) + b[i] * t) as Rgb;
}

export function deriveCoverTheme(baseHex: string): CoverTheme {
  const base = hexToRgb(coverBaseColorPattern.test(baseHex) ? baseHex : DEFAULT_COVER_BASE_COLOR);
  let [h, s, l] = toHsl(base);
  const lightText = hsl(h, Math.min(s, 0.25), 0.97);
  const darkText = hsl(h, Math.min(s, 0.45), 0.11);

  const isLight = contrastRgb(darkText, base) >= contrastRgb(lightText, base);
  const tp = isLight ? darkText : lightText;
  const d = isLight ? -1 : 1;

  // bg = base; mid-tones get nudged AWAY from the text colour until 4.5:1.
  let bg = base;
  let L = l;
  let k = 0;
  while (contrastRgb(tp, bg) < 4.5 && k < 40) {
    L += isLight ? 0.01 : -0.01;
    bg = hsl(h, s, L);
    k += 1;
  }
  if (k) [h, s, l] = toHsl(bg);

  let alt: Rgb | null = null;
  const passes: [number, number[]][] = [
    [d, [0.16, 0.15, 0.14, 0.13, 0.12]],
    [-d, [0.12, 0.13, 0.14, 0.15, 0.16]],
    [d, [0.1, 0.08, 0.06]],
  ];
  for (const [dd, range] of passes) {
    for (const dl of range) {
      const c = hsl(h, s * 0.95, l + dd * dl);
      if (contrastRgb(tp, c) >= 4.5) {
        alt = c;
        break;
      }
    }
    if (alt) break;
  }
  if (!alt) alt = hsl(h, s * 0.95, l - d * 0.06);

  const pattern = hsl(h, s, l + d * 0.07);

  const ah = h >= 180 && h < 300 ? (h + 180) % 360 : (h + 35) % 360;
  const as = Math.max(0.45, Math.min(0.75, s + 0.1));
  let al = isLight ? 0.3 : 0.68;
  let accent = hsl(ah, as, al);
  const onAccent = (a: Rgb) => (contrastRgb(darkText, a) >= contrastRgb(lightText, a) ? darkText : lightText);
  k = 0;
  while ((contrastRgb(accent, bg) < 3 || contrastRgb(onAccent(accent), accent) < 4.5) && k < 25) {
    al += 0.02 * (isLight ? -1 : 1);
    accent = hsl(ah, as, al);
    k += 1;
  }

  // The reference checks contrast on float colours; what gets painted is the
  // 8-bit hex, which for a few mid-tone bases rounds a 4.50 pair down to
  // 4.49. Same algorithm, then a final guard on the quantized values: bg
  // moves one more step away from the text, text-secondary one step back
  // toward text-primary.
  const q = (c: Rgb) => hexToRgb(rgbToHex(c));
  k = 0;
  while (contrastRgb(q(tp), q(bg)) < 4.5 && k < 10) {
    l += isLight ? 0.01 : -0.01;
    bg = hsl(h, s, l);
    k += 1;
  }

  let ts = tp;
  let tsStep = 0;
  for (let i = 0; i < 60; i += 2) {
    const c = mix(tp, bg, i / 100);
    if (contrastRgb(c, bg) >= 4.5 && contrastRgb(c, alt) >= 4.5) {
      ts = c;
      tsStep = i;
    } else break;
  }
  while (tsStep > 0 && (contrastRgb(q(ts), q(bg)) < 4.5 || contrastRgb(q(ts), q(alt)) < 4.5)) {
    tsStep -= 2;
    ts = mix(tp, bg, tsStep / 100);
  }

  const line = mix(tp, bg, 0.45);
  const surface = isLight ? hsl(h, Math.min(s, 0.35), 0.985) : hsl(h, Math.min(s, 0.3), 0.96);
  const onSurface = hsl(h, Math.min(s, 0.45), 0.12);

  return {
    base: rgbToHex(base),
    bg: rgbToHex(bg),
    bgAlt: rgbToHex(alt),
    surface: rgbToHex(surface),
    accent: rgbToHex(accent),
    textPrimary: rgbToHex(tp),
    textSecondary: rgbToHex(ts),
    textOnAccent: rgbToHex(onAccent(accent)),
    textOnSurface: rgbToHex(onSurface),
    line: rgbToHex(line),
    pattern: rgbToHex(pattern),
    isLight,
    photoTint: isLight ? 0.8 : 0.9,
    photoWash: isLight ? 0.55 : 0.3,
  };
}

// The only text/background pairs a template is allowed to use (STYLES.md
// "Правило композиції") -- every one must clear WCAG AA for ANY base.
export function coverThemeTextContrasts(t: CoverTheme): Record<string, number> {
  return {
    "text-primary/bg": coverContrast(t.textPrimary, t.bg),
    "text-primary/bg-alt": coverContrast(t.textPrimary, t.bgAlt),
    "text-secondary/bg": coverContrast(t.textSecondary, t.bg),
    "text-secondary/bg-alt": coverContrast(t.textSecondary, t.bgAlt),
    "text-on-accent/accent": coverContrast(t.textOnAccent, t.accent),
    "text-on-surface/surface": coverContrast(t.textOnSurface, t.surface),
  };
}
