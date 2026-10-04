# Cover styles v1 — файли

Специфікація 14 шаблонів автообкладинки (рішення 04.10.2026, Анатолій): один колір автора (`base`) → тема для всіх шаблонів; групи Класик · Мінімал · Текстури · Патерн (по 3) + «Фото» (Квіти, Місто).

Figma: файл «ULIT — Dashboard redesign v1», сторінка «Cover styles v1» — https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=88-14

- `STYLES.md` — специфікація: токени теми й алгоритм `deriveTheme`, параметри 14 шаблонів (JSON), мапа жанр → перший стиль, фото-стилі, рекомендації з реалізації.
- `styles.json` — параметри 14 шаблонів (машиночитні, те саме, що JSON у STYLES.md, розділ 2).
- `tokens.json` — виведені токени й контрасти для 4 режимів Figma + 8 тестових кольорів.
- `derive.py` — референсна реалізація `deriveTheme` (Python, `python3 derive.py`).
- `photos/` — фото за замовчуванням для групи «Фото» (джерела й ліцензії — STYLES.md, розділ 4):
  - `13-kvity_unsplash-RSI5x8B8DH4.jpg` — Unsplash RSI5x8B8DH4, wu yi (@takeshi2), Unsplash License;
  - `14-misto_pexels-32122883.jpg` — Pexels 32122883, Dmitry Alexandrovich, Pexels License.
- `shots/` — превʼю з Figma: `components-14.png` (14 компонентів), `showcase-14x4-preview.png` (14 стилів × 4 кольори), `stress-test-row-14.png` (довгі назви), `photo-styles-4modes.png` (фото-стилі в 4 режимах), `spec-v2.png` (сторінка специфікації).
