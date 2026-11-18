> **Чернетка на погодження Анатолієм.** Figma: https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf (фрейми 1:2 Дашборд опубліковано, 2:2 Дашборд є зміни, 3:2 Вихідні дані, 4:2 Меню «⋯», 24:2 Ціна (є зміни), 25:2 Обкладинка, 26:2 Огляд (є зміни), 40:2 06b Обкладинка (на перевірці), 41:2 06c Обкладинка (зміна недоступна), 46:2 «08 Редактор (електронна)», 47:2 «08b Редактор (м'яка, задня сторона)», 58:2 «06d Обкладинка (авто, шаблон)», 68:2 «06e Обкладинка (авто, Друк — розгортка)»). HTML — референс, будувати на наявних компонентах/токенах apps/web.

# ULIT — вайрфрейми редизайну дашборду книги (v1)

> **HTML — референс; будувати на наявних компонентах/токенах apps/web** (shadcn `Button`/`Badge`/`Card`, токени з `app/globals.css` і `tailwind.config.ts`, lucide-іконки). Не копіювати розмітку як є.

- `index.html` — посилання на всі стани
- `dashboard.html?state=published|changes|menu` — `/dashboard/books/[id]`
- `output-data.html?state=dirty|saved` — `/dashboard/books/[id]/output-data`
- `price.html?state=dirty|saved` — `/dashboard/books/[id]/output-data/price` (05 «Ціна та розповсюдження»)
- `cover.html?state=uploaded|pending|locked|auto` — `/dashboard/books/[id]/output-data/cover` (06 «Обкладинка»; `pending` — нова обкладинка на перевірці; `locked` — зміна недоступна до 01.01.2027; превʼю в 06/06b/06c — збережена обкладинка в масштабі, той самий рендер, що 06e, лише перегляд, клік — на весь екран; `auto` — 06d автоматична обкладинка за шаблоном для неопублікованої книги без обкладинки (HTML-WF — стара схема 12 стилів; канон — 14 шаблонів, див. `cover-styles/`; перший — за жанром), `&view=print` — розворот, `&long=1` — довга назва; генератор — `parts/autocover.py`)
- `cover-editor.html?tab=ebook|soft|hard` — `/dashboard/books/[id]/cover` (08 «Редактор обкладинки»; також `&panel=design` — вкладка «Дизайн», `&overlap=1` — фігура перекриває текст)
- `review.html?state=published|changes` — `/dashboard/books/[id]/output-data/review` (07 «Огляд перед публікацією»)
- `&clean=1` — сховати службові WF-перемикачі; `&static=1` — нижня панель не sticky (для full-page скрінів)
- `WF-SPEC.md` — специфікація; `shots/` — PNG 1280px
- [`cover-styles/STYLES.md`](cover-styles/STYLES.md) — стилі автообкладинки v1 (рішення 04.10): 14 шаблонів (Класик, Мінімал, Текстури, Патерн по 3 + «Фото»: Квіти, Місто), один колір автора → тема; параметри `cover-styles/styles.json`, токени `tokens.json`, фото й превʼю. Figma — сторінка «Cover styles v1», вузол [88:14](https://www.figma.com/design/Jv1BqZkdSNnNnkEITh36Bf?node-id=88-14)
- `build.py` генерує HTML (редактор 08 — `parts/editor.py`; спільні сайдбар/топбар/степер/нижня панель), `shoot.py` — скріни (playwright + chrome; `python3 shoot.py 05 07` — лише вибрані)

Відкривати без збірки (Tailwind і lucide через CDN, потрібен інтернет). Desktop 1280; мобільна поведінка — у WF-SPEC.md.
