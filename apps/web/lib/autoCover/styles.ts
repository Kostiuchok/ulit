import type { Genre } from "shared-types";
import type { CoverDoc, Node, TextSpec, Tok, Align } from "./engine";

// The 14 auto-cover templates -- parameters transcribed from
// docs/dashboard-ui/cover-styles/STYLES.md §2 (Figma "Cover styles v1",
// node 88:14). Each template is a function of the book's texts so an empty
// subtitle simply isn't in the tree (no blank gap left behind).

export interface CoverTexts {
  title: string;
  author: string;
  subtitle?: string | null;
}

export type CoverStyleGroup = "Класик" | "Мінімал" | "Текстури" | "Патерн" | "Фото";

export const COVER_STYLE_GROUPS: CoverStyleGroup[] = ["Класик", "Мінімал", "Текстури", "Патерн", "Фото"];

export interface CoverStyle {
  id: string;
  group: CoverStyleGroup;
  variant: string;
  photo?: "flowers" | "city";
  build: (texts: CoverTexts, photo: CanvasImageSource | null) => CoverDoc;
}

const ulit = (token: Tok, align: Align): Node => ({
  t: "text",
  text: "ULIT",
  spec: { family: "Unbounded", weight: 600, size: 1.41, letterSpacing: 0.3, token, align, lineHeight: 1.2 },
  role: "brand",
});

const txt = (text: string, spec: TextSpec, extra?: { padX?: number; isTitle?: boolean; role?: string }): Node => ({
  t: "text",
  text,
  spec,
  ...extra,
});

const title = (t: CoverTexts, spec: TextSpec, padX?: number): Node =>
  txt(t.title, spec, { padX, isTitle: true, role: "title" });

// The author line -- tagged, so the cover editor knows which text layer
// follows the book's author.
const author = (t: CoverTexts, spec: TextSpec, extra?: { padX?: number }): Node =>
  txt(t.author, spec, { ...extra, role: "author" });

// Nodes for an optional subtitle -- empty when the book has none.
const sub = (t: CoverTexts, spec: TextSpec, padX?: number): Node[] =>
  t.subtitle?.trim() ? [txt(t.subtitle.trim(), spec, { padX, role: "subtitle" })] : [];

export const COVER_STYLES: CoverStyle[] = [
  {
    id: "classic-1-frame",
    group: "Класик",
    variant: "Рамка",
    build: (t) => ({
      decor: [
        { shape: "rect-stroke", token: "line", stroke: 1, x: 4, y: 2.5, w: 92, h: 95 },
        { shape: "rect-stroke", token: "accent", stroke: 2, x: 6, y: 3.75, w: 88, h: 92.5 },
      ],
      pad: [10, 14, 8.12, 14],
      justify: "space-between",
      align: "center",
      maxTitleLines: 5,
      children: [
        author(t, { family: "Lora", weight: 500, size: 2.19, letterSpacing: 0.14, upper: true, token: "textSecondary", align: "center" }),
        {
          t: "stack",
          gap: 2.81,
          align: "center",
          children: [
            { t: "shape", shape: "diamond", w: 3, h: 2.81, token: "accent" },
            title(t, { family: "Playfair Display", weight: 700, size: 6.25, lineHeight: 1.12, token: "textPrimary", align: "center" }),
            { t: "shape", shape: "rule", w: 14, h: 0.16, token: "accent" },
            ...sub(t, { family: "Lora", weight: 400, italic: true, size: 2.66, token: "textSecondary", align: "center" }),
          ],
        },
        ulit("textSecondary", "center"),
      ],
    }),
  },
  {
    id: "classic-2-ornament",
    group: "Класик",
    variant: "Орнамент",
    build: (t) => ({
      decor: [{ shape: "star8", token: "line", size: 3.5, positions: [[6, 3.75], [90.5, 3.75], [6, 94.06], [90.5, 94.06]] }],
      pad: [9.38, 12, 8.12, 12],
      justify: "space-between",
      align: "center",
      maxTitleLines: 5,
      children: [
        author(t, { family: "Cormorant Garamond", weight: 600, italic: true, size: 3.28, token: "textSecondary", align: "center" }),
        {
          t: "stack",
          gap: 3.75,
          align: "center",
          children: [
            {
              t: "row",
              gap: 2.5,
              children: [
                { t: "shape", shape: "rule", w: 13, h: 0.16, token: "line" },
                { t: "shape", shape: "diamond", w: 2, h: 1.88, token: "accent" },
                { t: "shape", shape: "star8", w: 11.5, h: 7.19, token: "accent" },
                { t: "shape", shape: "diamond", w: 2, h: 1.88, token: "accent" },
                { t: "shape", shape: "rule", w: 13, h: 0.16, token: "line" },
              ],
            },
            title(t, { family: "Cormorant Garamond", weight: 700, size: 7.5, lineHeight: 1.0, token: "textPrimary", align: "center" }),
            ...sub(t, { family: "Lora", weight: 400, size: 1.88, letterSpacing: 0.22, upper: true, token: "textSecondary", align: "center" }),
          ],
        },
        ulit("textSecondary", "center"),
      ],
    }),
  },
  {
    id: "classic-3-band",
    group: "Класик",
    variant: "Стрічка",
    build: (t) => ({
      decor: [{ shape: "rect", token: "accent", x: 0, y: 0, w: 100, h: 1.56 }],
      pad: [9.38, 0, 6.25, 0],
      justify: "space-between",
      align: "center",
      maxTitleLines: 5,
      children: [
        author(t, { family: "PT Serif", weight: 400, size: 2.66, token: "textPrimary", align: "center" }, { padX: 10 }),
        {
          t: "stack",
          gap: 0,
          fill: "bgAlt",
          bleed: true,
          align: "center",
          children: [
            { t: "shape", shape: "rule", w: 100, h: 0.31, token: "accent", bleed: true },
            {
              t: "stack",
              gap: 1.88,
              pad: [4.69, 10, 4.69, 10],
              align: "center",
              children: [
                title(t, { family: "PT Serif", weight: 700, italic: true, size: 5.94, lineHeight: 1.12, token: "textPrimary", align: "center" }),
                ...sub(t, { family: "PT Serif", weight: 400, size: 2.34, token: "textSecondary", align: "center" }),
              ],
            },
            { t: "shape", shape: "rule", w: 100, h: 0.31, token: "accent", bleed: true },
          ],
        },
        ulit("textSecondary", "center"),
      ],
    }),
  },
  {
    id: "minimal-1-bigtype",
    group: "Мінімал",
    variant: "Великий шрифт",
    build: (t) => ({
      decor: [],
      pad: [6.88, 10, 5.62, 10],
      justify: "space-between",
      align: "left",
      maxTitleLines: 7,
      children: [
        {
          t: "stack",
          gap: 3.1,
          children: [
            title(t, { family: "Unbounded", weight: 700, size: 6.88, lineHeight: 1.06, token: "textPrimary", align: "left" }),
            ...sub(t, { family: "Inter", weight: 400, size: 2.66, token: "textSecondary", align: "left" }),
          ],
        },
        {
          t: "stack",
          gap: 2.5,
          children: [
            {
              t: "row",
              gap: 2.5,
              children: [
                { t: "shape", shape: "square", w: 3.5, h: 2.19, token: "accent" },
                author(t, { family: "Inter", weight: 600, size: 2.66, token: "textPrimary", align: "left" }),
              ],
            },
            ulit("textSecondary", "left"),
          ],
        },
      ],
    }),
  },
  {
    id: "minimal-2-offgrid",
    group: "Мінімал",
    variant: "Зсув",
    build: (t) => ({
      decor: [
        { shape: "rect", token: "accent", x: 10, y: 0, w: 16, h: 46.88 },
        { shape: "rect", token: "line", x: 17.75, y: 46.88, w: 0.5, h: 53.12 },
      ],
      pad: [6.88, 9, 6.25, 34],
      justify: "space-between",
      align: "left",
      maxTitleLines: 8,
      children: [
        author(t, { family: "Montserrat", weight: 600, size: 2.03, letterSpacing: 0.18, upper: true, token: "textSecondary", align: "left" }),
        {
          t: "stack",
          gap: 2.5,
          children: [
            title(t, { family: "Montserrat", weight: 800, size: 5.62, lineHeight: 1.1, token: "textPrimary", align: "left" }),
            ...sub(t, { family: "Montserrat", weight: 400, size: 2.34, token: "textSecondary", align: "left" }),
            { t: "spacer", h: 1.5 },
            ulit("textSecondary", "left"),
          ],
        },
      ],
    }),
  },
  {
    id: "minimal-3-oneline",
    group: "Мінімал",
    variant: "Одна лінія",
    build: (t) => ({
      decor: [],
      pad: [8.75, 0, 6.88, 0],
      justify: "space-between",
      align: "center",
      maxTitleLines: 6,
      children: [
        author(t, { family: "Raleway", weight: 500, size: 2.03, letterSpacing: 0.28, upper: true, token: "textSecondary", align: "center" }, { padX: 12 }),
        {
          t: "stack",
          gap: 4.4,
          align: "center",
          children: [
            title(t, { family: "Raleway", weight: 600, size: 5.31, lineHeight: 1.18, token: "textPrimary", align: "center" }, 12),
            { t: "shape", shape: "rule", w: 100, h: 0.31, token: "accent", bleed: true },
            ...sub(t, { family: "Raleway", weight: 400, italic: true, size: 2.5, token: "textSecondary", align: "center" }, 12),
          ],
        },
        ulit("textSecondary", "center"),
      ],
    }),
  },
  {
    id: "texture-1-glow",
    group: "Текстури",
    variant: "Сяйво",
    build: (t) => ({
      decor: [
        { shape: "ellipse", token: "pattern", blur: 14.06, x: -40, y: -23.44, w: 100, h: 56.25 },
        { shape: "ellipse", token: "bgAlt", blur: 15.62, x: 15, y: 23.44, w: 105, h: 46.88 },
        { shape: "ellipse", token: "accent", opacity: 0.9, blur: 12.5, x: 47.5, y: -18.75, w: 75, h: 46.88 },
      ],
      pad: [6.88, 11, 6.25, 11],
      justify: "end",
      align: "left",
      maxTitleLines: 5,
      // The accent blob owns the top-right; text stays on the bg/bg-alt haze.
      children: [
        {
          t: "stack",
          gap: 2.2,
          children: [
            author(t, { family: "Lora", weight: 600, size: 2.03, letterSpacing: 0.16, upper: true, token: "textSecondary", align: "left" }),
            title(t, { family: "Playfair Display", weight: 700, italic: true, size: 6.56, lineHeight: 1.08, token: "textPrimary", align: "left" }),
            ...sub(t, { family: "Lora", weight: 400, size: 2.5, token: "textSecondary", align: "left" }),
            { t: "spacer", h: 1.5 },
            ulit("textSecondary", "left"),
          ],
        },
      ],
    }),
  },
  {
    id: "texture-2-duotone",
    group: "Текстури",
    variant: "Дуотон",
    build: (t) => ({
      decor: [
        { shape: "rect", token: "bgAlt", x: 0, y: 0, w: 100, h: 62.5 },
        { shape: "rect", token: "pattern", x: 0, y: 36.88, w: 57.5, h: 25.62 },
        { shape: "ellipse", token: "accent", x: 37.5, y: 10.94, w: 72.5, h: 45.31 },
        { shape: "ellipse", token: "bg", x: 59, y: 24.38, w: 29.5, h: 18.44 },
        { shape: "rect", token: "line", x: 8, y: 6.25, w: 37.5, h: 0.47 },
        { shape: "rect", token: "line", x: 8, y: 8.44, w: 27.5, h: 0.47 },
        { shape: "rect", token: "line", x: 8, y: 10.62, w: 17.5, h: 0.47 },
      ],
      pad: [0, 0, 0, 0],
      justify: "end",
      align: "left",
      maxTitleLines: 6,
      children: [
        {
          t: "stack",
          gap: 2,
          fill: "bg",
          pad: [5.6, 10, 5.6, 10],
          children: [
            author(t, { family: "Rubik", weight: 500, size: 2.19, token: "textSecondary", align: "left" }),
            title(t, { family: "Rubik", weight: 700, size: 5.62, lineHeight: 1.1, token: "textPrimary", align: "left" }),
            ...sub(t, { family: "Rubik", weight: 400, size: 2.34, token: "textSecondary", align: "left" }),
            { t: "spacer", h: 1.5 },
            ulit("textSecondary", "left"),
          ],
        },
      ],
    }),
  },
  {
    id: "texture-3-softcircles",
    group: "Текстури",
    variant: "М'які кола",
    build: (t) => ({
      decor: [
        { shape: "ellipse", token: "bgAlt", opacity: 0.9, x: 32.5, y: 72.19, w: 85, h: 53.12 },
        { shape: "ellipse", token: "pattern", opacity: 0.85, x: -20, y: 81.25, w: 65, h: 40.62 },
        { shape: "ellipse", token: "accent", x: 70.5, y: 71.25, w: 24, h: 15 },
        { shape: "ellipse-stroke", token: "accent", stroke: 1.5, x: 7.5, y: 72.81, w: 47.5, h: 29.69 },
        { shape: "ellipse", token: "accent", x: 21.5, y: 93.12, w: 5, h: 3.12 },
      ],
      pad: [6.88, 11, 6.25, 11],
      justify: "start",
      align: "left",
      maxTitleLines: 6,
      maxContentBottom: 71,
      children: [
        {
          t: "stack",
          gap: 2.2,
          children: [
            ulit("textSecondary", "left"),
            { t: "spacer", h: 4 },
            author(t, { family: "Comfortaa", weight: 700, size: 2.19, token: "textSecondary", align: "left" }),
            title(t, { family: "Comfortaa", weight: 700, size: 5, lineHeight: 1.14, token: "textPrimary", align: "left" }),
            ...sub(t, { family: "Comfortaa", weight: 400, size: 2.5, token: "textSecondary", align: "left" }),
          ],
        },
      ],
    }),
  },
  {
    id: "pattern-1-geometry",
    group: "Патерн",
    variant: "Геометрія",
    build: (t) => ({
      decor: [{ shape: "geometry", token: "pattern" }],
      pad: [6.25, 9, 6.25, 9],
      justify: "center",
      align: "left",
      maxTitleLines: 7,
      children: [
        {
          t: "stack",
          gap: 1.9,
          fill: "surface",
          stroke: { token: "accent", px: 3 },
          pad: [5, 7.5, 5, 7.5],
          children: [
            author(t, { family: "Montserrat", weight: 600, size: 1.88, letterSpacing: 0.16, upper: true, token: "textOnSurface", align: "left" }),
            title(t, { family: "Montserrat", weight: 700, size: 4.84, lineHeight: 1.12, token: "textOnSurface", align: "left" }),
            { t: "shape", shape: "rule", w: 10, h: 0.47, token: "accent" },
            ...sub(t, { family: "Montserrat", weight: 400, size: 2.34, token: "textOnSurface", align: "left" }),
            { t: "spacer", h: 1.5 },
            ulit("textOnSurface", "left"),
          ],
        },
      ],
    }),
  },
  {
    id: "pattern-2-vyshyvanka",
    group: "Патерн",
    variant: "Вишиванка",
    build: (t) => ({
      decor: [{ shape: "vyshyvanka", bands: [{ y: 3.75, h: 13.12 }, { y: 83.12, h: 13.12 }] }],
      pad: [21.25, 11, 20.62, 11],
      justify: "space-between",
      align: "center",
      maxTitleLines: 6,
      children: [
        author(t, { family: "Lora", weight: 400, italic: true, size: 2.66, token: "textSecondary", align: "center" }),
        {
          t: "stack",
          gap: 2.2,
          align: "center",
          children: [
            title(t, { family: "Yeseva One", weight: 400, size: 5.31, lineHeight: 1.12, token: "textPrimary", align: "center" }),
            ...sub(t, { family: "Lora", weight: 400, size: 1.88, letterSpacing: 0.22, upper: true, token: "textSecondary", align: "center" }),
          ],
        },
        ulit("textSecondary", "center"),
      ],
    }),
  },
  {
    id: "pattern-3-stripes",
    group: "Патерн",
    variant: "Смуги",
    build: (t) => ({
      decor: [{ shape: "stripes", token: "pattern", stripe: 3.25, period: 7.5 }],
      pad: [0, 0, 0, 0],
      justify: "center",
      align: "center",
      maxTitleLines: 6,
      children: [
        {
          t: "stack",
          gap: 0,
          fill: "bg",
          bleed: true,
          align: "center",
          children: [
            { t: "shape", shape: "rule", w: 100, h: 0.94, token: "accent", bleed: true },
            {
              t: "stack",
              gap: 2.2,
              pad: [5.3, 10, 5.3, 10],
              align: "center",
              children: [
                author(t, { family: "Oswald", weight: 400, size: 2.5, letterSpacing: 0.12, upper: true, token: "textSecondary", align: "center" }),
                title(t, { family: "Oswald", weight: 700, size: 6.88, lineHeight: 1.08, upper: true, token: "textPrimary", align: "center" }),
                ...sub(t, { family: "Inter", weight: 400, size: 2.34, token: "textSecondary", align: "center" }),
                ulit("textSecondary", "center"),
              ],
            },
            { t: "shape", shape: "rule", w: 100, h: 0.94, token: "accent", bleed: true },
          ],
        },
      ],
    }),
  },
  {
    id: "photo-1-flowers",
    group: "Фото",
    variant: "Квіти",
    photo: "flowers",
    build: (t, photo) => ({
      decor: [{ shape: "photo", img: photo, focal: [0.5, 0.3] }],
      pad: [0, 0, 0, 0],
      justify: "end",
      align: "center",
      maxTitleLines: 4,
      reserve: 32,
      // Text only ever sits on the solid bg plate; the fade above it is decorative.
      children: [
        { t: "gradient", h: 20.31 },
        {
          t: "stack",
          gap: 1.9,
          fill: "bg",
          bleed: true,
          pad: [0.6, 11, 6.25, 11],
          align: "center",
          children: [
            author(t, { family: "Lora", weight: 500, size: 2.03, letterSpacing: 0.18, upper: true, token: "textSecondary", align: "center" }),
            title(t, { family: "Cormorant Garamond", weight: 700, italic: true, size: 7.19, lineHeight: 1.0, token: "textPrimary", align: "center" }),
            { t: "shape", shape: "rule", w: 10, h: 0.31, token: "accent" },
            ...sub(t, { family: "Lora", weight: 400, italic: true, size: 2.5, token: "textSecondary", align: "center" }),
            { t: "spacer", h: 1.5 },
            ulit("textSecondary", "center"),
          ],
        },
      ],
    }),
  },
  {
    id: "photo-2-city",
    group: "Фото",
    variant: "Місто",
    photo: "city",
    build: (t, photo) => ({
      decor: [{ shape: "photo", img: photo, focal: [0.5, 0.5] }],
      pad: [0, 0, 0, 0],
      justify: "space-between",
      align: "left",
      maxTitleLines: 5,
      reserve: 32,
      children: [
        {
          t: "stack",
          gap: 0,
          fill: "bg",
          bleed: true,
          pad: [3.1, 8, 2.8, 8],
          children: [
            author(t, { family: "Inter", weight: 600, size: 2.03, letterSpacing: 0.16, upper: true, token: "textPrimary", align: "left" }),
          ],
        },
        {
          t: "stack",
          gap: 0,
          fill: "bg",
          bleed: true,
          children: [
            { t: "shape", shape: "rule", w: 100, h: 0.78, token: "accent", bleed: true },
            {
              t: "stack",
              gap: 1.9,
              pad: [4.1, 8, 4.7, 8],
              children: [
                title(t, { family: "Russo One", weight: 400, size: 5.31, lineHeight: 1.12, token: "textPrimary", align: "left" }),
                ...sub(t, { family: "Inter", weight: 400, size: 2.34, token: "textSecondary", align: "left" }),
                { t: "spacer", h: 1.5 },
                ulit("textSecondary", "left"),
              ],
            },
          ],
        },
      ],
    }),
  },
];

export const DEFAULT_COVER_STYLE_ID = "classic-1-frame";
// The most forgiving template for a very long title (STYLES.md §0).
export const LONG_TITLE_FALLBACK_STYLE_ID = "minimal-1-bigtype";

export function findCoverStyle(id: string | null | undefined): CoverStyle {
  return COVER_STYLES.find((s) => s.id === id) ?? COVER_STYLES[0];
}

export function coverStyleLabel(s: CoverStyle): string {
  return `${s.group} · ${s.variant}`;
}

// STYLES.md §3's genre map, re-keyed onto the app's actual GENRES list
// (which is coarser than the spec's own genre names).
const GENRE_TO_STYLE: Record<Genre, string> = {
  "Проза": "photo-2-city",
  "Поезія": "photo-1-flowers",
  "Драматургія": "classic-3-band",
  "Наукова фантастика": "texture-1-glow",
  "Фентезі": "texture-1-glow",
  "Детектив": "photo-2-city",
  "Роман": "classic-1-frame",
  "Повість": "classic-1-frame",
  "Оповідання": "classic-1-frame",
  "Нон-фікшн": "minimal-1-bigtype",
  "Мемуари": "classic-2-ornament",
  "Бізнес": "minimal-1-bigtype",
  "Самодопомога": "texture-2-duotone",
  "Дитяча": "pattern-1-geometry",
  "Інше": "classic-1-frame",
};

export function coverStyleForGenre(genre: string | null | undefined): string | null {
  return genre && genre in GENRE_TO_STYLE ? GENRE_TO_STYLE[genre as Genre] : null;
}

// Google Fonts (all with a Cyrillic subset) the templates use, with exactly
// the weights/styles referenced above.
export const COVER_FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?" +
  [
    "Playfair+Display:ital,wght@0,700;1,700",
    "Lora:ital,wght@0,400;0,500;0,600;1,400",
    "Cormorant+Garamond:ital,wght@0,700;1,600;1,700",
    "PT+Serif:ital,wght@0,400;1,700",
    "Unbounded:wght@600;700",
    "Inter:wght@400;600",
    "Montserrat:wght@400;600;700;800",
    "Raleway:ital,wght@0,500;0,600;1,400",
    "Rubik:wght@400;500;700",
    "Comfortaa:wght@400;700",
    "Yeseva+One",
    "Oswald:wght@400;700",
    "Russo+One",
  ]
    .map((f) => `family=${f}`)
    .join("&") +
  "&display=swap";

export const COVER_FONT_FACES: { family: string; weight: number; italic?: boolean }[] = [
  { family: "Playfair Display", weight: 700 },
  { family: "Playfair Display", weight: 700, italic: true },
  { family: "Lora", weight: 400 },
  { family: "Lora", weight: 500 },
  { family: "Lora", weight: 600 },
  { family: "Lora", weight: 400, italic: true },
  { family: "Cormorant Garamond", weight: 700 },
  { family: "Cormorant Garamond", weight: 600, italic: true },
  { family: "Cormorant Garamond", weight: 700, italic: true },
  { family: "PT Serif", weight: 400 },
  { family: "PT Serif", weight: 700, italic: true },
  { family: "Unbounded", weight: 600 },
  { family: "Unbounded", weight: 700 },
  { family: "Inter", weight: 400 },
  { family: "Inter", weight: 600 },
  { family: "Montserrat", weight: 400 },
  { family: "Montserrat", weight: 600 },
  { family: "Montserrat", weight: 700 },
  { family: "Montserrat", weight: 800 },
  { family: "Raleway", weight: 500 },
  { family: "Raleway", weight: 600 },
  { family: "Raleway", weight: 400, italic: true },
  { family: "Rubik", weight: 400 },
  { family: "Rubik", weight: 500 },
  { family: "Rubik", weight: 700 },
  { family: "Comfortaa", weight: 400 },
  { family: "Comfortaa", weight: 700 },
  { family: "Yeseva One", weight: 400 },
  { family: "Oswald", weight: 400 },
  { family: "Oswald", weight: 700 },
  { family: "Russo One", weight: 400 },
];
