# ULIT · Cover styles v1 — 14 шаблонів автообкладинки (5 груп) з однією колірною темою

Джерело дизайну: Figma `Jv1BqZkdSNnNnkEITh36Bf`, сторінка **«Cover styles v1»** (https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=88-14).
Ідея (Анатолій): автор обирає **ОДИН колір** (`base`) → з нього виводяться всі токени → кожен із 14 шаблонів перефарбовується автоматично.

* Компоненти (400×640 = 1600×2560 / 4, 1:1.6): фрейм компонентів (групи Класик · Мінімал · Текстури · Патерн · Фото; група «Фото» — https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=99-633) — https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=89-2
* Showcase «14 стилів × 4 кольори» + стрес-тест — https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=93-2
* Специфікація — https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=95-632
* Змінні: колекція **«Cover theme»** (`VariableCollectionId:88:2`), 4 режими: Синій #1F3A5F · Бордо #7A1F2B · Ліс #2F5D46 · Пісок #E8D9B5. Для фото-стилів додано `photo-tint`, `photo-wash` (FLOAT, %) і `bg-0` (bg з α 0).

> **Рішення 04.10 (WF-SPEC):** Анатолій підтвердив нову схему — 4 групи × 3 векторні шаблони, тему задає один колір автора (`base`) — і додав групу **«Фото»** (13 Квіти, 14 Місто). Разом **14 стилів**; лічильник у UI «N з 14».

## 0. Конвенції для реалізації

* Усі розміри — **у % від висоти обкладинки H** (шрифти, вертикальні відступи) або **ширини W** (горизонтальні відступи, x/w). `size: 6.25` → `0.0625 * H` (на 1600×2560 це 160 px).
* `box {x,y,w,h}`: x,w — % від W; y,h — % від H; відлік від лівого верхнього кута; від'ємні та >100 значення допустимі (виходять за край, обрізаються `overflow:hidden`).
* `token` — назва токена з розділу 1. Жодних інших кольорів у шаблонах немає (крім прозорості `opacity`).
* `layout.stack` — вертикальний flex-стек (`justify`: space-between | start | end | center), дочірні блоки у порядку `order`; декор (`decor`) — абсолютно позиціонований **під** текстом (z-order: decor → text). `inFlow:true` — елемент у потоці стеку.
* Текст переноситься по словах, **ніколи не обрізається**; якщо після верстки текстовий блок виходить за padding/безпечну зону або рядків назви > `maxTitleLines` → показати підказку «Назва довга — спробуйте Мінімал» (WF-SPEC 06d п.7). Найстійкіший до довгих назв — `minimal-2-offgrid` / `minimal-1-bigtype`.
* Шрифти — Google Fonts з кирилицею: Playfair Display, Lora, Cormorant Garamond, PT Serif, Unbounded, Inter, Montserrat, Raleway, Rubik, Comfortaa, Yeseva One, Oswald, Russo One.
* Тексти: `title` (Назва), `author` (Автор), `subtitle` (Підзаголовок, опційний — якщо порожній, блок не рендериться, gap не додається), `ulit` (знак «ULIT», опційний).

## 1. Колірна тема: токени і алгоритм виведення

| токен | роль | правило |
|---|---|---|
| `base` | колір автора (вхід) | — |
| `bg` | основний фон | = base; якщо `contrast(text-primary, bg) < 4.5` — зсуваємо L по 1% **від** тексту |
| `bg-alt` | смуги, блоки, «серпанок» | L ± 16→12% (темна база світлішає, світла темнішає), S×0.95; якщо text-primary < 4.5:1 — протилежний напрямок |
| `surface` | паперова плашка під текст | H base, S ≤ 30% (35% для світлої), L 96% (98.5% для світлої) |
| `accent` | орнамент, лінії, плями | H 180–300° → H+180 (комплемент); інакше H+35 (аналог); S = clamp(S+0.10, 0.45, 0.75); L 0.68 (темна) / 0.30 (світла); крок ±2% L, поки accent/bg ≥ 3:1 і text-on-accent ≥ 4.5:1 |
| `text-primary` | назва, автор | майже-білий (H, S≤0.25, L 0.97) або майже-чорний (H, S≤0.45, L 0.11) — що контрастніше до base |
| `text-secondary` | автор/підзаголовок | змішування text-primary → bg кроком 2%, поки ≥4.5:1 і на bg, і на bg-alt (може дорівнювати text-primary) |
| `text-on-accent` | текст на accent | білий/чорний за контрастом до accent |
| `text-on-surface` | текст на surface | H, S≤0.45, L 0.12 |
| `line` | тонкі лінії/рамки | mix(text-primary, bg, 0.45) |
| `pattern` | тон-у-тон візерунок | H, S, L(bg) ± 7% (той самий напрямок, що bg-alt) |
| `photo-tint` | непрозорість шару tint (Color · bg) у фото-стилях | темна base 0.90, світла 0.80 |
| `photo-wash` | непрозорість шару wash (Normal · bg) | темна base 0.30, світла 0.55 |
| `bg-0` | початок градієнта до bg | bg з α = 0 |

### Псевдокод (референс — `derive.py` у цій папці, протестовано на 12 кольорах)

```text
fn deriveTheme(baseHex):
  base = hexToRgb(baseHex); (h, s, l) = rgbToHsl(base)
  LIGHT_TXT = hsl(h, min(s,0.25), 0.97)
  DARK_TXT  = hsl(h, min(s,0.45), 0.11)
  textPrimary = contrast(DARK_TXT, base) >= contrast(LIGHT_TXT, base) ? DARK_TXT : LIGHT_TXT
  isLight = textPrimary == DARK_TXT              # світла база → темний текст
  d = isLight ? -1 : +1                          # напрямок зсуву L

  bg = base
  while contrast(textPrimary, bg) < 4.5:         # тільки для середніх тонів (#808080, #00A6A6 …)
      l += isLight ? +0.01 : -0.01; bg = hsl(h, s, l)

  bgAlt = first c in [hsl(h, s*0.95, l + d*x) for x in 0.16,0.15,0.14,0.13,0.12]
                ++ [hsl(h, s*0.95, l - d*x) for x in 0.12..0.16]
                ++ [hsl(h, s*0.95, l + d*x) for x in 0.10,0.08,0.06]
          where contrast(textPrimary, c) >= 4.5
  pattern = hsl(h, s, l + d*0.07)

  ah = (180 <= h < 300) ? (h+180) % 360 : (h+35) % 360
  as = clamp(s+0.10, 0.45, 0.75); al = isLight ? 0.30 : 0.68
  accent = hsl(ah, as, al)
  onAccent(a) = contrast(DARK_TXT,a) >= contrast(LIGHT_TXT,a) ? DARK_TXT : LIGHT_TXT
  repeat up to 25: if contrast(accent,bg) >= 3 and contrast(onAccent(accent),accent) >= 4.5: break
                   al += isLight ? -0.02 : +0.02; accent = hsl(ah, as, al)
  textOnAccent = onAccent(accent)

  textSecondary = textPrimary
  for t in 0.00, 0.02 … 0.58:
      c = mix(textPrimary, bg, t)
      if contrast(c,bg) >= 4.5 and contrast(c,bgAlt) >= 4.5: textSecondary = c else break

  line    = mix(textPrimary, bg, 0.45)
  surface = isLight ? hsl(h, min(s,0.35), 0.985) : hsl(h, min(s,0.30), 0.96)
  textOnSurface = hsl(h, min(s,0.45), 0.12)
  return {base, bg, bgAlt, surface, accent, textPrimary, textSecondary, textOnAccent, textOnSurface, line, pattern}

contrast(a,b) = (max(Y(a),Y(b)) + 0.05) / (min(Y(a),Y(b)) + 0.05)     # WCAG 2.x relative luminance
mix(a,b,t)    = a*(1-t) + b*t  (per sRGB channel)
hsl/rgbToHsl  = стандартні HSL (як colorsys.hls_to_rgb)
```

**Правило композиції (обов'язкове для контрасту):** текст може стояти лише на `bg`, `bg-alt` (text-primary / text-secondary), `surface` (text-on-surface) або `accent` (text-on-accent). На `pattern`, `line` та плямах `accent` — тільки через суцільну плашку. У коді додати runtime-assert: `contrast ≥ 4.5` для кожної пари текст/фон шаблону.

### Значення для 4 режимів Figma (та перевірка контрасту)

| токен | Синій #1F3A5F | Бордо #7A1F2B | Ліс #2F5D46 | Пісок #E8D9B5 |
|---|---|---|---|---|
| `base` | #1F3A5F | #7A1F2B | #2F5D46 | #E8D9B5 |
| `bg` | #1F3A5F | #7A1F2B | #2F5D46 | #E8D9B5 |
| `bg-alt` | #36609A | #B83345 | #1B3427 | #D2B879 |
| `surface` | #F2F4F8 | #F8F2F3 | #F2F8F5 | #FDFCFA |
| `accent` | #DFB57C | #E6A875 | #89CCD2 | #5A741B |
| `text-primary` | #F5F7F9 | #F9F5F6 | #F5F9F7 | #29210F |
| `text-secondary` | #D7DDE4 | #EDE0E2 | #BECEC6 | #534A34 |
| `text-on-accent` | #0F1A29 | #290F13 | #13251C | #F9F8F5 |
| `text-on-surface` | #111C2C | #2C1114 | #15291F | #2C2411 |
| `line` | #95A2B4 | #C0959B | #9CB3A8 | #7F745A |
| `pattern` | #284A7A | #962635 | #3B7558 | #E0CB9A |

| пара (контраст) | Синій #1F3A5F | Бордо #7A1F2B | Ліс #2F5D46 | Пісок #E8D9B5 |
|---|---|---|---|---|
| text-primary/bg | 10.71 | 9.46 | 7.15 | 11.38 |
| text-primary/bg-alt | 5.95 | 5.43 | 12.69 | 8.25 |
| text-primary/pattern | 8.29 | 7.39 | 5.14 | 9.97 |
| text-secondary/bg | 8.38 | 7.94 | 4.61 | 6.30 |
| text-secondary/bg-alt | 4.65 | 4.56 | 8.18 | 4.56 |
| text-on-accent/accent | 9.20 | 8.71 | 8.86 | 5.01 |
| text-on-surface/surface | 15.52 | 15.81 | 14.30 | 14.88 |
| accent/bg (graphic) | 6.04 | 4.96 | 4.19 | 3.80 |
| line/bg (graphic) | 4.43 | 3.89 | 3.40 | 3.31 |

Додатково перевірено (`tokens.json`): #FF8A00, #F2C14E, #808080, #000000, #FFFFFF, #5B2A86, #00A6A6, #D94F70 — текстові пари ≥ 4.5:1 у всіх (крім `text-primary/pattern`, який за правилом не використовується без плашки).

## 2. 14 шаблонів — параметри (JSON)

| # | id | група | назва | Figma | опис |
|---|---|---|---|---|---|
| 1 | `classic-1-frame` | Класик | Класик 1 · Рамка | [89:9](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=89-9) | подвійна рамка (line + accent), центрована серифна назва, ромб і лінійка accent |
| 2 | `classic-2-ornament` | Класик | Класик 2 · Орнамент | [89:21](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=89-21) | восьмипроменева зірка з лініями над назвою, зірочки в кутах, Cormorant |
| 3 | `classic-3-band` | Класик | Класик 3 · Стрічка | [89:39](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=89-39) | горизонтальна стрічка bg-alt з назвою між лініями accent, смуга accent зверху |
| 4 | `minimal-1-bigtype` | Мінімал | Мінімал 1 · Великий шрифт | [90:6](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=90-6) | велика гротеск-назва зліва зверху, автор з квадратом accent знизу |
| 5 | `minimal-2-offgrid` | Мінімал | Мінімал 2 · Зсув | [90:17](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=90-17) | поза сіткою: стовпець accent + тонка лінія зліва, текст зміщено вправо-вниз |
| 6 | `minimal-3-oneline` | Мінімал | Мінімал 3 · Одна лінія | [90:28](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=90-28) | симетрія, одна лінія accent на всю ширину між назвою і підзаголовком |
| 7 | `texture-1-glow` | Текстури | Текстури 1 · Сяйво | [91:6](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=91-6) | «меш-градієнт» з розмитих плям pattern/bg-alt/accent, текст унизу |
| 8 | `texture-2-duotone` | Текстури | Текстури 2 · Дуотон | [91:18](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=91-18) | дуотонні блоки й кільце accent у верхніх 60%, текст на плашці bg |
| 9 | `texture-3-softcircles` | Текстури | Текстури 3 · М'які кола | [91:34](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=91-34) | напівпрозорі кола, що перетинаються, і контурне коло знизу; текст зверху |
| 10 | `pattern-1-geometry` | Патерн | Патерн 1 · Геометрія | [92:6](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=92-6) | раппорт кружечків/ромбів тон-у-тон; текст на паперовій плашці з рамкою accent |
| 11 | `pattern-2-vyshyvanka` | Патерн | Патерн 2 · Вишиванка | [92:18](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=92-18) | дві орнаментальні стрічки «хрестиком» (ромби з променями, кайми) accent+line |
| 12 | `pattern-3-stripes` | Патерн | Патерн 3 · Смуги | [92:34](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=92-34) | діагональні смуги 45° тон-у-тон; назва Oswald caps на плашці bg з краями accent |
| 13 | `photo-1-flowers` | Фото | Фото 1 · Квіти | [99:637](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=99-637) | фото квітів (ч/б) тоноване bg; градієнт у bg і суцільна плашка bg з назвою Cormorant знизу |
| 14 | `photo-2-city` | Фото | Фото 2 · Місто | [99:652](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=99-652) | фото міста (ч/б) тоноване bg; суцільна смуга bg з автором зверху, плашка bg з краєм accent і назвою Russo One знизу |

### Класик 1 · Рамка — `classic-1-frame`

```json
{
  "id": "classic-1-frame",
  "group": "Класик",
  "name": "Класик 1 · Рамка",
  "figma": "89:9",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "center",
    "padding": {
      "top": 10.0,
      "right": 14.0,
      "bottom": 8.12,
      "left": 14.0
    },
    "order": [
      "author",
      "titleBlock[ornament, title, rule, subtitle]",
      "ulit"
    ],
    "gaps": {
      "titleBlock": 2.81
    }
  },
  "text": {
    "title": {
      "family": "Playfair Display",
      "style": "Bold",
      "size": 6.25,
      "lineHeight": 1.12,
      "token": "text-primary",
      "align": "center"
    },
    "author": {
      "family": "Lora",
      "style": "Medium",
      "size": 2.19,
      "letterSpacing": 0.14,
      "case": "upper",
      "token": "text-secondary",
      "align": "center"
    },
    "subtitle": {
      "family": "Lora",
      "style": "Italic",
      "size": 2.66,
      "token": "text-secondary",
      "align": "center"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "center"
    }
  },
  "decor": [
    {
      "shape": "rect-stroke",
      "token": "line",
      "stroke": 1,
      "x": 4.0,
      "y": 2.5,
      "w": 92.0,
      "h": 95.0
    },
    {
      "shape": "rect-stroke",
      "token": "accent",
      "stroke": 2,
      "x": 6.0,
      "y": 3.75,
      "w": 88.0,
      "h": 92.5
    },
    {
      "shape": "diamond",
      "token": "accent",
      "inFlow": true,
      "w": 3.0,
      "h": 2.81
    },
    {
      "shape": "rule",
      "token": "accent",
      "inFlow": true,
      "w": 14.0,
      "h": 0.16
    }
  ],
  "maxTitleLines": 5,
  "defaultFor": [
    "Роман (загальний)",
    "Інше / не вказано"
  ]
}
```

### Класик 2 · Орнамент — `classic-2-ornament`

```json
{
  "id": "classic-2-ornament",
  "group": "Класик",
  "name": "Класик 2 · Орнамент",
  "figma": "89:21",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "center",
    "padding": {
      "top": 9.38,
      "right": 12.0,
      "bottom": 8.12,
      "left": 12.0
    },
    "order": [
      "author",
      "titleBlock[ornamentRow, title, subtitle]",
      "ulit"
    ],
    "gaps": {
      "titleBlock": 3.75
    }
  },
  "text": {
    "title": {
      "family": "Cormorant Garamond",
      "style": "Bold",
      "size": 7.5,
      "lineHeight": 1.0,
      "token": "text-primary",
      "align": "center"
    },
    "author": {
      "family": "Cormorant Garamond",
      "style": "SemiBold Italic",
      "size": 3.28,
      "token": "text-secondary",
      "align": "center"
    },
    "subtitle": {
      "family": "Lora",
      "style": "Regular",
      "size": 1.88,
      "letterSpacing": 0.22,
      "case": "upper",
      "token": "text-secondary",
      "align": "center"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "center"
    }
  },
  "decor": [
    {
      "shape": "star8",
      "innerRadius": 0.5,
      "token": "line",
      "note": "4 corners",
      "size": 3.5,
      "positions": [
        [
          6.0,
          3.75
        ],
        [
          90.5,
          3.75
        ],
        [
          6.0,
          94.06
        ],
        [
          90.5,
          94.06
        ]
      ]
    },
    {
      "shape": "ornamentRow",
      "inFlow": true,
      "items": [
        [
          "line",
          13.0,
          0.16,
          "line"
        ],
        [
          "diamond",
          2.0,
          1.88,
          "accent"
        ],
        [
          "star8",
          11.5,
          11.5,
          "accent"
        ],
        [
          "diamond",
          2.0,
          1.88,
          "accent"
        ],
        [
          "line",
          13.0,
          0.16,
          "line"
        ]
      ],
      "gap": 2.5
    }
  ],
  "maxTitleLines": 5,
  "defaultFor": [
    "Мемуари / біографія"
  ]
}
```

### Класик 3 · Стрічка — `classic-3-band`

```json
{
  "id": "classic-3-band",
  "group": "Класик",
  "name": "Класик 3 · Стрічка",
  "figma": "89:39",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "center",
    "padding": {
      "top": 9.38,
      "right": 0.0,
      "bottom": 6.25,
      "left": 0.0
    },
    "order": [
      "author (side pad 10%)",
      "band[ruleTop, bandContent[title, subtitle], ruleBottom] full-bleed",
      "ulit"
    ],
    "band": {
      "fill": "bg-alt",
      "padding": {
        "top": 4.69,
        "right": 10.0,
        "bottom": 4.69,
        "left": 10.0
      },
      "gap": 1.88,
      "rules": {
        "token": "accent",
        "h": 0.31
      }
    }
  },
  "text": {
    "title": {
      "family": "PT Serif",
      "style": "Bold Italic",
      "size": 5.94,
      "lineHeight": 1.12,
      "token": "text-primary",
      "align": "center"
    },
    "author": {
      "family": "PT Serif",
      "style": "Regular",
      "size": 2.66,
      "token": "text-primary",
      "align": "center"
    },
    "subtitle": {
      "family": "PT Serif",
      "style": "Regular",
      "size": 2.34,
      "token": "text-secondary",
      "align": "center"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "center"
    }
  },
  "decor": [
    {
      "shape": "rect",
      "token": "accent",
      "x": 0.0,
      "y": 0.0,
      "w": 100.0,
      "h": 1.56
    }
  ],
  "maxTitleLines": 5,
  "defaultFor": [
    "Класика / історичний роман"
  ],
  "note": "text inside band sits on bg-alt -> tokens guarantee >=4.5:1"
}
```

### Мінімал 1 · Великий шрифт — `minimal-1-bigtype`

```json
{
  "id": "minimal-1-bigtype",
  "group": "Мінімал",
  "name": "Мінімал 1 · Великий шрифт",
  "figma": "90:6",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "start",
    "padding": {
      "top": 6.88,
      "right": 10.0,
      "bottom": 5.62,
      "left": 10.0
    },
    "order": [
      "top[title, subtitle] gap 3.1%",
      "bottom[authorRow[accentSquare, author], ulit] gap 2.5%"
    ]
  },
  "text": {
    "title": {
      "family": "Unbounded",
      "style": "Bold",
      "size": 6.88,
      "lineHeight": 1.06,
      "token": "text-primary",
      "align": "left"
    },
    "subtitle": {
      "family": "Inter",
      "style": "Regular",
      "size": 2.66,
      "token": "text-secondary",
      "align": "left"
    },
    "author": {
      "family": "Inter",
      "style": "Semi Bold",
      "size": 2.66,
      "token": "text-primary",
      "align": "left"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "left"
    }
  },
  "decor": [
    {
      "shape": "square",
      "token": "accent",
      "inFlow": true,
      "w": 3.5,
      "h": 2.19
    }
  ],
  "maxTitleLines": 7,
  "defaultFor": [
    "Нон-фікшн / бізнес / наукове"
  ],
  "note": "best fallback for very long titles"
}
```

### Мінімал 2 · Зсув — `minimal-2-offgrid`

```json
{
  "id": "minimal-2-offgrid",
  "group": "Мінімал",
  "name": "Мінімал 2 · Зсув",
  "figma": "90:17",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "start",
    "padding": {
      "top": 6.88,
      "right": 9.0,
      "bottom": 6.25,
      "left": 34.0
    },
    "order": [
      "author",
      "bottom[title, subtitle, spacer, ulit] gap 2.5%"
    ]
  },
  "text": {
    "title": {
      "family": "Montserrat",
      "style": "ExtraBold",
      "size": 5.62,
      "lineHeight": 1.1,
      "token": "text-primary",
      "align": "left"
    },
    "author": {
      "family": "Montserrat",
      "style": "SemiBold",
      "size": 2.03,
      "letterSpacing": 0.18,
      "case": "upper",
      "token": "text-secondary",
      "align": "left"
    },
    "subtitle": {
      "family": "Montserrat",
      "style": "Regular",
      "size": 2.34,
      "token": "text-secondary",
      "align": "left"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "left"
    }
  },
  "decor": [
    {
      "shape": "rect",
      "token": "accent",
      "x": 10.0,
      "y": 0.0,
      "w": 16.0,
      "h": 46.88
    },
    {
      "shape": "rect",
      "token": "line",
      "x": 17.75,
      "y": 46.88,
      "w": 0.5,
      "h": 53.12
    }
  ],
  "maxTitleLines": 8,
  "defaultFor": []
}
```

### Мінімал 3 · Одна лінія — `minimal-3-oneline`

```json
{
  "id": "minimal-3-oneline",
  "group": "Мінімал",
  "name": "Мінімал 3 · Одна лінія",
  "figma": "90:28",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "center",
    "padding": {
      "top": 8.75,
      "right": 0.0,
      "bottom": 6.88,
      "left": 0.0
    },
    "order": [
      "author (side pad 12%)",
      "middle[title (side pad 12%), line full-bleed, subtitle] gap 4.4%",
      "ulit"
    ]
  },
  "text": {
    "title": {
      "family": "Raleway",
      "style": "SemiBold",
      "size": 5.31,
      "lineHeight": 1.18,
      "token": "text-primary",
      "align": "center"
    },
    "author": {
      "family": "Raleway",
      "style": "Medium",
      "size": 2.03,
      "letterSpacing": 0.28,
      "case": "upper",
      "token": "text-secondary",
      "align": "center"
    },
    "subtitle": {
      "family": "Raleway",
      "style": "Italic",
      "size": 2.5,
      "token": "text-secondary",
      "align": "center"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "center"
    }
  },
  "decor": [
    {
      "shape": "rule",
      "token": "accent",
      "inFlow": true,
      "w": 100,
      "h": 0.31
    }
  ],
  "maxTitleLines": 6,
  "defaultFor": []
}
```

### Текстури 1 · Сяйво — `texture-1-glow`

```json
{
  "id": "texture-1-glow",
  "group": "Текстури",
  "name": "Текстури 1 · Сяйво",
  "figma": "91:6",
  "layout": {
    "stack": "vertical",
    "justify": "end",
    "align": "start",
    "padding": {
      "top": 6.88,
      "right": 11.0,
      "bottom": 6.25,
      "left": 11.0
    },
    "order": [
      "text[author, title, subtitle, spacer, ulit] gap 2.2%"
    ]
  },
  "text": {
    "title": {
      "family": "Playfair Display",
      "style": "Bold Italic",
      "size": 6.56,
      "lineHeight": 1.08,
      "token": "text-primary",
      "align": "left"
    },
    "author": {
      "family": "Lora",
      "style": "SemiBold",
      "size": 2.03,
      "letterSpacing": 0.16,
      "case": "upper",
      "token": "text-secondary",
      "align": "left"
    },
    "subtitle": {
      "family": "Lora",
      "style": "Regular",
      "size": 2.5,
      "token": "text-secondary",
      "align": "left"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "left"
    }
  },
  "decor": [
    {
      "shape": "ellipse",
      "token": "pattern",
      "blur": 14.06,
      "x": -40.0,
      "y": -23.44,
      "w": 100.0,
      "h": 56.25
    },
    {
      "shape": "ellipse",
      "token": "bg-alt",
      "blur": 15.62,
      "x": 15.0,
      "y": 23.44,
      "w": 105.0,
      "h": 46.88
    },
    {
      "shape": "ellipse",
      "token": "accent",
      "opacity": 0.9,
      "blur": 12.5,
      "x": 47.5,
      "y": -18.75,
      "w": 75.0,
      "h": 46.88
    }
  ],
  "svgHint": "render blobs as <ellipse> with feGaussianBlur stdDeviation≈blur/2 (or CSS filter: blur)",
  "maxTitleLines": 5,
  "defaultFor": [
    "Фантастика / фентезі"
  ],
  "note": "accent blob stays in top-right 30%; text zone only over bg/bg-alt haze"
}
```

### Текстури 2 · Дуотон — `texture-2-duotone`

```json
{
  "id": "texture-2-duotone",
  "group": "Текстури",
  "name": "Текстури 2 · Дуотон",
  "figma": "91:18",
  "layout": {
    "stack": "vertical",
    "justify": "end",
    "align": "start",
    "padding": {
      "top": 0.0,
      "right": 0.0,
      "bottom": 0.0,
      "left": 0.0
    },
    "order": [
      "textPlate[author, title, subtitle, spacer, ulit] fill=bg, padding 5.6%/10%, full width, grows upward"
    ]
  },
  "text": {
    "title": {
      "family": "Rubik",
      "style": "Bold",
      "size": 5.62,
      "lineHeight": 1.1,
      "token": "text-primary",
      "align": "left"
    },
    "author": {
      "family": "Rubik",
      "style": "Medium",
      "size": 2.19,
      "token": "text-secondary",
      "align": "left"
    },
    "subtitle": {
      "family": "Rubik",
      "style": "Regular",
      "size": 2.34,
      "token": "text-secondary",
      "align": "left"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "left"
    }
  },
  "decor": [
    {
      "shape": "rect",
      "token": "bg-alt",
      "x": 0.0,
      "y": 0.0,
      "w": 100.0,
      "h": 62.5
    },
    {
      "shape": "rect",
      "token": "pattern",
      "x": 0.0,
      "y": 36.88,
      "w": 57.5,
      "h": 25.62
    },
    {
      "shape": "ellipse",
      "token": "accent",
      "x": 37.5,
      "y": 10.94,
      "w": 72.5,
      "h": 45.31
    },
    {
      "shape": "ellipse",
      "token": "bg",
      "x": 59.0,
      "y": 24.38,
      "w": 29.5,
      "h": 18.44
    },
    {
      "shape": "rect",
      "token": "line",
      "x": 8.0,
      "y": 6.25,
      "w": 37.5,
      "h": 0.47
    },
    {
      "shape": "rect",
      "token": "line",
      "x": 8.0,
      "y": 8.44,
      "w": 27.5,
      "h": 0.47
    },
    {
      "shape": "rect",
      "token": "line",
      "x": 8.0,
      "y": 10.62,
      "w": 17.5,
      "h": 0.47
    }
  ],
  "maxTitleLines": 6,
  "defaultFor": [
    "Психологія / саморозвиток"
  ]
}
```

### Текстури 3 · М'які кола — `texture-3-softcircles`

```json
{
  "id": "texture-3-softcircles",
  "group": "Текстури",
  "name": "Текстури 3 · М'які кола",
  "figma": "91:34",
  "layout": {
    "stack": "vertical",
    "justify": "start",
    "align": "start",
    "padding": {
      "top": 6.88,
      "right": 11.0,
      "bottom": 6.25,
      "left": 11.0
    },
    "order": [
      "text[ulit, spacer, author, title, subtitle] gap 2.2%"
    ]
  },
  "text": {
    "title": {
      "family": "Comfortaa",
      "style": "Bold",
      "size": 5.0,
      "lineHeight": 1.14,
      "token": "text-primary",
      "align": "left"
    },
    "author": {
      "family": "Comfortaa",
      "style": "Bold",
      "size": 2.19,
      "token": "text-secondary",
      "align": "left"
    },
    "subtitle": {
      "family": "Comfortaa",
      "style": "Regular",
      "size": 2.5,
      "token": "text-secondary",
      "align": "left"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "left"
    }
  },
  "decor": [
    {
      "shape": "ellipse",
      "token": "bg-alt",
      "opacity": 0.9,
      "x": 32.5,
      "y": 72.19,
      "w": 85.0,
      "h": 53.12
    },
    {
      "shape": "ellipse",
      "token": "pattern",
      "opacity": 0.85,
      "x": -20.0,
      "y": 81.25,
      "w": 65.0,
      "h": 40.62
    },
    {
      "shape": "ellipse",
      "token": "accent",
      "x": 70.5,
      "y": 71.25,
      "w": 24.0,
      "h": 15.0
    },
    {
      "shape": "ellipse-stroke",
      "token": "accent",
      "stroke": 1.5,
      "x": 7.5,
      "y": 72.81,
      "w": 47.5,
      "h": 29.69
    },
    {
      "shape": "ellipse",
      "token": "accent",
      "x": 21.5,
      "y": 93.12,
      "w": 5.0,
      "h": 3.12
    }
  ],
  "maxTitleLines": 6,
  "defaultFor": [
    "Підліткова (YA)"
  ],
  "note": "text block must end above 71% of height (decor starts at 71.3%)"
}
```

### Патерн 1 · Геометрія — `pattern-1-geometry`

```json
{
  "id": "pattern-1-geometry",
  "group": "Патерн",
  "name": "Патерн 1 · Геометрія",
  "figma": "92:6",
  "layout": {
    "stack": "vertical",
    "justify": "center",
    "align": "center",
    "padding": {
      "top": 6.25,
      "right": 9.0,
      "bottom": 6.25,
      "left": 9.0
    },
    "order": [
      "plate[author, title, rule, subtitle, spacer, ulit] fill=surface stroke=accent 3px, padding 5%/7.5%, gap 1.9%"
    ]
  },
  "text": {
    "title": {
      "family": "Montserrat",
      "style": "Bold",
      "size": 4.84,
      "lineHeight": 1.12,
      "token": "text-on-surface",
      "align": "left"
    },
    "author": {
      "family": "Montserrat",
      "style": "SemiBold",
      "size": 1.88,
      "letterSpacing": 0.16,
      "case": "upper",
      "token": "text-on-surface",
      "align": "left"
    },
    "subtitle": {
      "family": "Montserrat",
      "style": "Regular",
      "size": 2.34,
      "token": "text-on-surface",
      "align": "left"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-on-surface",
      "align": "left"
    }
  },
  "decor": [
    {
      "shape": "svg-repeat",
      "token": "pattern",
      "tile": {
        "step": 10.0,
        "motif": "circle r=6 on even (i+j), diamond r=7 on odd",
        "origin": [
          5.0,
          3.12
        ]
      },
      "x": 0.0,
      "y": 0.0,
      "w": 100.0,
      "h": 100.0
    },
    {
      "shape": "rule",
      "token": "accent",
      "inFlow": true,
      "w": 10.0,
      "h": 0.47
    }
  ],
  "maxTitleLines": 7,
  "defaultFor": [
    "Дитяча"
  ]
}
```

### Патерн 2 · Вишиванка — `pattern-2-vyshyvanka`

```json
{
  "id": "pattern-2-vyshyvanka",
  "group": "Патерн",
  "name": "Патерн 2 · Вишиванка",
  "figma": "92:18",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "center",
    "padding": {
      "top": 21.25,
      "right": 11.0,
      "bottom": 20.62,
      "left": 11.0
    },
    "order": [
      "author",
      "titleBlock[title, subtitle] gap 2.2%",
      "ulit"
    ]
  },
  "text": {
    "title": {
      "family": "Yeseva One",
      "style": "Regular",
      "size": 5.31,
      "lineHeight": 1.12,
      "token": "text-primary",
      "align": "center"
    },
    "author": {
      "family": "Lora",
      "style": "Italic",
      "size": 2.66,
      "token": "text-secondary",
      "align": "center"
    },
    "subtitle": {
      "family": "Lora",
      "style": "Regular",
      "size": 1.88,
      "letterSpacing": 0.22,
      "case": "upper",
      "token": "text-secondary",
      "align": "center"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "center"
    }
  },
  "decor": [
    {
      "shape": "cross-stitch-band",
      "tokens": {
        "A": "accent",
        "B": "line"
      },
      "cell": 1.0,
      "bands": [
        {
          "x": 0.0,
          "y": 3.75,
          "w": 100.0,
          "h": 13.12
        },
        {
          "x": 0.0,
          "y": 83.12,
          "w": 100.0,
          "h": 13.12
        }
      ],
      "motif": "17x17 cells, c=8, d=|dx|+|dy|: A if d==8 | (d==5 & (dx==0|dy==0)) | (d==6 & (dx==1|dy==1)); B if d<=2 | (d==4 & dx==dy); repeat every 18 cells, centred; B small vertical cross between motifs; B dotted border rows (every 2nd cell) at row 0 and row 20"
    }
  ],
  "maxTitleLines": 6,
  "defaultFor": [
    "Етно / фольклор / краєзнавство"
  ]
}
```

### Патерн 3 · Смуги — `pattern-3-stripes`

```json
{
  "id": "pattern-3-stripes",
  "group": "Патерн",
  "name": "Патерн 3 · Смуги",
  "figma": "92:34",
  "layout": {
    "stack": "vertical",
    "justify": "center",
    "align": "center",
    "padding": {
      "top": 0.0,
      "right": 0.0,
      "bottom": 0.0,
      "left": 0.0
    },
    "order": [
      "plate[edgeTop accent 6px, content[author, title, subtitle, ulit] padding 5.3%/10% gap 2.2%, edgeBottom accent 6px] fill=bg full width"
    ]
  },
  "text": {
    "title": {
      "family": "Oswald",
      "style": "Bold",
      "size": 6.88,
      "lineHeight": 1.08,
      "case": "upper",
      "token": "text-primary",
      "align": "center"
    },
    "author": {
      "family": "Oswald",
      "style": "Regular",
      "size": 2.5,
      "letterSpacing": 0.12,
      "case": "upper",
      "token": "text-secondary",
      "align": "center"
    },
    "subtitle": {
      "family": "Inter",
      "style": "Regular",
      "size": 2.34,
      "token": "text-secondary",
      "align": "center"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "center"
    }
  },
  "decor": [
    {
      "shape": "svg-stripes",
      "token": "pattern",
      "angle": 45,
      "stripe": 3.25,
      "period": 7.5,
      "x": 0.0,
      "y": 0.0,
      "w": 100.0,
      "h": 100.0
    }
  ],
  "maxTitleLines": 6,
  "defaultFor": [
    "Публіцистика / есеїстика"
  ]
}
```

### Фото 1 · Квіти — `photo-1-flowers`

```json
{
  "id": "photo-1-flowers",
  "group": "Фото",
  "name": "Фото 1 · Квіти",
  "figma": "99:637",
  "layout": {
    "stack": "vertical",
    "justify": "end",
    "align": "center",
    "padding": {
      "top": 0.0,
      "right": 0.0,
      "bottom": 0.0,
      "left": 0.0
    },
    "order": [
      "textZone[fade h=20.3% gradient bg-0 -> bg (top->bottom), textPlate fill=bg padding 0.6%/11%/6.25%/11% gap 1.9% [author, title, rule, subtitle, spacer, ulit]] full width, grows upward"
    ]
  },
  "text": {
    "title": {
      "family": "Cormorant Garamond",
      "style": "Bold Italic",
      "size": 7.19,
      "lineHeight": 1.0,
      "token": "text-primary",
      "align": "center"
    },
    "author": {
      "family": "Lora",
      "style": "Medium",
      "size": 2.03,
      "letterSpacing": 0.18,
      "case": "upper",
      "token": "text-secondary",
      "align": "center"
    },
    "subtitle": {
      "family": "Lora",
      "style": "Italic",
      "size": 2.5,
      "token": "text-secondary",
      "align": "center"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "center"
    }
  },
  "photo": {
    "layers": [
      {
        "layer": "photo",
        "slot": "image",
        "fit": "cover",
        "focal": [
          0.5,
          0.3
        ],
        "filters": {
          "saturation": -1.0,
          "contrast": 0.15,
          "shadows": 0.1
        },
        "css": "filter: grayscale(1) contrast(1.15)",
        "default": "photos/13-kvity_unsplash-RSI5x8B8DH4.jpg",
        "swappable": true,
        "note": "in product the author can later swap the photo from a curated library for this style (commercial-use licences only)"
      },
      {
        "layer": "tint",
        "shape": "rect",
        "token": "bg",
        "blend": "color",
        "opacity": "photo-tint",
        "x": 0.0,
        "y": 0.0,
        "w": 100.0,
        "h": 100.0,
        "css": "mix-blend-mode: color; opacity: var(--cover-photo-tint)"
      },
      {
        "layer": "wash",
        "shape": "rect",
        "token": "bg",
        "blend": "normal",
        "opacity": "photo-wash",
        "x": 0.0,
        "y": 0.0,
        "w": 100.0,
        "h": 100.0
      }
    ],
    "source": {
      "provider": "Unsplash",
      "id": "RSI5x8B8DH4",
      "title": "White flowers bloom with a dark, moody background",
      "author": "wu yi (@takeshi2)",
      "url": "https://unsplash.com/photos/white-flowers-bloom-with-a-dark-moody-background-RSI5x8B8DH4",
      "license": "Unsplash License — free for commercial use, no attribution required; no selling unaltered copies / no competing service",
      "licenseUrl": "https://unsplash.com/license"
    },
    "textPlates": "text only on solid bg plate (fade is decorative, text starts below it); contrast = token pairs text-primary/bg, text-secondary/bg >= 4.5"
  },
  "decor": [
    {
      "shape": "gradient",
      "tokens": [
        "bg-0",
        "bg"
      ],
      "inFlow": true,
      "w": 100,
      "h": 20.31
    },
    {
      "shape": "rule",
      "token": "accent",
      "inFlow": true,
      "w": 10.0,
      "h": 0.31
    }
  ],
  "maxTitleLines": 4,
  "defaultFor": [
    "Поезія",
    "Романтика / любовний роман"
  ],
  "note": "photo visible in top ~40-60%; plate grows upward with long text"
}
```

### Фото 2 · Місто — `photo-2-city`

```json
{
  "id": "photo-2-city",
  "group": "Фото",
  "name": "Фото 2 · Місто",
  "figma": "99:652",
  "layout": {
    "stack": "vertical",
    "justify": "space-between",
    "align": "start",
    "padding": {
      "top": 0.0,
      "right": 0.0,
      "bottom": 0.0,
      "left": 0.0
    },
    "order": [
      "topBar fill=bg padding 3.1%/8%/2.8%/8% [author]",
      "bottomPlate fill=bg [edge accent h=0.8%, content padding 4.1%/8%/4.7%/8% gap 1.9% [title, subtitle, spacer, ulit]] full width, grows upward"
    ]
  },
  "text": {
    "title": {
      "family": "Russo One",
      "style": "Regular",
      "size": 5.31,
      "lineHeight": 1.12,
      "token": "text-primary",
      "align": "left"
    },
    "author": {
      "family": "Inter",
      "style": "Semi Bold",
      "size": 2.03,
      "letterSpacing": 0.16,
      "case": "upper",
      "token": "text-primary",
      "align": "left"
    },
    "subtitle": {
      "family": "Inter",
      "style": "Regular",
      "size": 2.34,
      "token": "text-secondary",
      "align": "left"
    },
    "ulit": {
      "family": "Unbounded",
      "style": "SemiBold",
      "size": 1.41,
      "letterSpacing": 0.3,
      "token": "text-secondary",
      "align": "left"
    }
  },
  "photo": {
    "layers": [
      {
        "layer": "photo",
        "slot": "image",
        "fit": "cover",
        "focal": [
          0.5,
          0.5
        ],
        "filters": {
          "saturation": -1.0,
          "contrast": 0.15,
          "shadows": 0.1
        },
        "css": "filter: grayscale(1) contrast(1.15)",
        "default": "photos/14-misto_pexels-32122883.jpg",
        "swappable": true,
        "note": "in product the author can later swap the photo from a curated library for this style (commercial-use licences only)"
      },
      {
        "layer": "tint",
        "shape": "rect",
        "token": "bg",
        "blend": "color",
        "opacity": "photo-tint",
        "x": 0.0,
        "y": 0.0,
        "w": 100.0,
        "h": 100.0,
        "css": "mix-blend-mode: color; opacity: var(--cover-photo-tint)"
      },
      {
        "layer": "wash",
        "shape": "rect",
        "token": "bg",
        "blend": "normal",
        "opacity": "photo-wash",
        "x": 0.0,
        "y": 0.0,
        "w": 100.0,
        "h": 100.0
      }
    ],
    "source": {
      "provider": "Pexels",
      "id": "32122883",
      "title": "Urban Street View During Twilight in Skyscraper Cityscape",
      "author": "Dmitry Alexandrovich",
      "url": "https://www.pexels.com/photo/urban-street-view-during-twilight-in-skyscraper-cityscape-32122883/",
      "license": "Pexels License — free for commercial use, no attribution required; no selling unaltered copies",
      "licenseUrl": "https://www.pexels.com/license/"
    },
    "textPlates": "author on solid bg top bar, title/subtitle/ulit on solid bg bottom plate; contrast = token pairs >= 4.5"
  },
  "decor": [
    {
      "shape": "rect",
      "token": "accent",
      "inFlow": true,
      "w": 100,
      "h": 0.78
    }
  ],
  "maxTitleLines": 5,
  "defaultFor": [
    "Сучасна проза",
    "Трилер / детектив"
  ]
}
```

## 3. Жанр → перший стиль

| жанр | перший стиль |
|---|---|
| Роман (загальний) | Класик 1 · Рамка (`classic-1-frame`) |
| Сучасна проза | Фото 2 · Місто (`photo-2-city`) |
| Класика / історичний роман | Класик 3 · Стрічка (`classic-3-band`) |
| Мемуари / біографія | Класик 2 · Орнамент (`classic-2-ornament`) |
| Нон-фікшн / бізнес / наукове | Мінімал 1 · Великий шрифт (`minimal-1-bigtype`) |
| Трилер / детектив | Фото 2 · Місто (`photo-2-city`) |
| Поезія | Фото 1 · Квіти (`photo-1-flowers`) |
| Фантастика / фентезі | Текстури 1 · Сяйво (`texture-1-glow`) |
| Психологія / саморозвиток | Текстури 2 · Дуотон (`texture-2-duotone`) |
| Романтика / любовний роман | Фото 1 · Квіти (`photo-1-flowers`) |
| Підліткова (YA) | Текстури 3 · М'які кола (`texture-3-softcircles`) |
| Дитяча | Патерн 1 · Геометрія (`pattern-1-geometry`) |
| Етно / фольклор / краєзнавство | Патерн 2 · Вишиванка (`pattern-2-vyshyvanka`) |
| Публіцистика / есеїстика | Патерн 3 · Смуги (`pattern-3-stripes`) |
| Інше / не вказано | Класик 1 · Рамка (`classic-1-frame`) |

Без жанру — `classic-1-frame` без чипа «Підібрано за жанром».

## 4. Фото-стилі (група «Фото»)

Шари (знизу вгору), однакові для обох стилів:

| шар | що | параметри |
|---|---|---|
| `photo` | слот зображення, `object-fit: cover` | фільтри: saturation −1 (ч/б), contrast +0.15, shadows +0.10 (CSS: `grayscale(1) contrast(1.15)`) |
| `tint` | прямокутник `bg` на весь кадр | `mix-blend-mode: color`, opacity = `photo-tint` (темна base **0.90**, світла **0.80**) → фото набуває відтінку base |
| `wash` | прямокутник `bg` | normal, opacity = `photo-wash` (темна **0.30**, світла **0.55**) → вирівнює тон, для світлої base — висвітлює |
| текстова зона | Ф1: градієнт `bg-0 → bg` 20.3% H + суцільна плашка `bg`; Ф2: суцільна смуга `bg` зверху (автор) + суцільна плашка `bg` з краєм accent 0.8% H знизу | плашки ростуть із текстом (hug), фото ніколи не під текстом |

`isLight` = text-primary темний (як у `deriveTheme`). У Figma це змінні `photo-tint` / `photo-wash` по режимах (Пісок = світла).

**Правила плашок (контраст):** текст лише на суцільній плашці/зоні `bg` → пари `text-primary/bg` і `text-secondary/bg` ≥ 4.5:1 гарантовані токенами незалежно від фото. QA у Figma: 40 текстових шарів фото-стилів (4 режими + стрес-рядок) — мінімум **4.62:1** (Ліс, text-secondary), усі тексти всередині плашок і меж обкладинки.

**Заміна фото:** у продукті автор зможе пізніше замінити фото з **кураторської бібліотеки для кожного стилю** (Квіти — флористика/ботаніка, Місто — архітектура/вулиці); лише зображення з ліцензією на комерційне використання; тонування і плашки застосовуються автоматично, тож будь-яке фото дасть тему в кольорі base. Бажано: фото з темнішим/контрастним об'єктом у верхніх 60% кадру.

### Джерела зображень (за замовчуванням)

| стиль | файл | джерело | автор | ліцензія |
|---|---|---|---|---|
| 13 Квіти | `photos/13-kvity_unsplash-RSI5x8B8DH4.jpg` (1200×1920) | [Unsplash RSI5x8B8DH4](https://unsplash.com/photos/white-flowers-bloom-with-a-dark-moody-background-RSI5x8B8DH4) | wu yi (@takeshi2) | [Unsplash License](https://unsplash.com/license): комерційне використання безкоштовно, атрибуція не обов'язкова; не можна продавати незмінені копії чи робити конкурентний сервіс |
| 14 Місто | `photos/14-misto_pexels-32122883.jpg` | [Pexels 32122883](https://www.pexels.com/photo/urban-street-view-during-twilight-in-skyscraper-cityscape-32122883/) | Dmitry Alexandrovich | [Pexels License](https://www.pexels.com/license/): комерційне використання безкоштовно, атрибуція не обов'язкова; не можна продавати незмінені копії |

## 5. WF-SPEC: рішення 04.10

* **Нова схема підтверджена** (Анатолій, 04.10): 4 групи × 3 векторні шаблони (Класик, Мінімал, Текстури, Патерн); світлість/колір визначає колір автора (`base`), а не стиль — варіанти «темна/світла» з WF-SPEC 06d п.4 / відкрите питання 17 закрито.
* **Додано групу «Фото»**: 13 Квіти, 14 Місто (фото + тонування bg). Разом **14 стилів**, лічильник «N з 14». Назви в UI: «Група · варіант», напр. «Фото · Квіти».
* Мапа жанрів (WF-SPEC 06d п.8) оновлена: поезія, романтика → Фото 1 · Квіти; детектив/трилер, сучасна проза → Фото 2 · Місто; підліткова → Текстури 3; загальний роман / інше → Класик 1 (див. розділ 3).

## 6. Реалізація в коді (рекомендація)

1. `deriveTheme(base)` → CSS custom properties `--cover-bg`, `--cover-bg-alt`, … (у Figma `codeSyntax.WEB` уже `var(--cover-<token>)`).
2. Кожен стиль = запис з `styles.json` + генератор SVG (`viewBox="0 0 1600 2560"`): декор → `<rect>/<ellipse>/<path>` з `fill="var(--cover-…)"`, текст — `<foreignObject>`/HTML-шар або попередній layout через canvas measureText (переноси по словах).
3. Patterns: `pattern-1` — `<pattern>` 10%W; `pattern-2` — клітинки 1%W (16 px на 1600) з матриці мотиву; `pattern-3` — `<pattern patternTransform="rotate(45)">` або кліповані паралелограми.
4. Blur у `texture-1-glow`: `feGaussianBlur stdDeviation ≈ blur% * H / 2`.
5. Фото-стилі: `<image>` + `<rect fill=var(--cover-bg) style="mix-blend-mode:color;opacity:var(--cover-photo-tint)">` + wash-rect; текстові плашки — звичайні `<rect>` bg під текстом.
6. Тест: для кожного стилю × набір base (мінімум 12 кольорів із `tokens.json`) × довга назва — assert контрасту ≥ 4.5 і відсутності виходу тексту за padding.
