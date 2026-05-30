# E-commerce UA — Project Overview for Claude Code

## Table of Contents

1. [Stack](#stack)
2. [Repository Structure](#repository-structure)
3. [Reference Database](#reference-database-cs-cart--mysql)
4. [Project URL Structure](#project-url-structure)
5. [Admin Panel — UX Requirements](#admin-panel--ux-requirements)
   — Dashboard · Orders · Order Detail · Products · Product Detail · Shipments · Reports
6. [Business Logic Notes](#business-logic-notes)
7. [Product Detail — Full Tab Structure](#product-detail--full-tab-structure-from-reference)
   — Features · Variations · SEO · Wholesale · Bundles · Video · Credit · Tabs · Mandatory
8. [Product Data Model (Prisma)](#product-data-model-prisma-schema-summary)
9. [Storefront Page Layout](#storefront-page-layout-from-макети-tab--cs-cart-block-manager)
10. [Categories — Full Structure](#categories--full-structure-from-reference)
11. [Product Features System](#product-features-system-характеристики)
12. [Import/Export System](#importexport-system)
13. [Filters System](#filters-system-фільтри)
14. [Product Options / Parameters](#product-options--parameters-параметри)
15. [Product Reviews](#product-reviews-відгуки)
16. [Users System](#users-system-користувачі)
17. [Marketing Section](#marketing-section-маркетинг)
    — Promotions · Bundles · Newsletters · Gift Certificates · Banners · Price Feeds
18. [Website Section](#website-section-веб-сайт)
    — Pages · Menus · Tags · SEO · Comments · Sitemap · Themes · UX Settings
19. [Modules Section](#modules-section-модулі)
    — AlexBranding · WayForPay · Searchanise · CS-Cart built-in · Marketplace · Summary

---

## Stack
- **Frontend:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes (Route Handlers) — єдиний підхід, без NestJS
- **Database:** PostgreSQL + Prisma ORM
- **Cache / Sessions:** Redis
- **Auth:** Phone number + OTP (SMS) — основний метод для покупців; email + password для адмін-панелі
- **SMS:** TurboSMS — OTP для реєстрації/логіну, статус замовлення покупцю
- **Email:** Resend — підтвердження замовлення, статус доставки, відновлення доступу для адмінів
- **Payments:** LiqPay, Monobank, WayForPay
- **Shipping:** Nova Poshta API (TTH creation, tracking, branch lookup)
- **Fiscal:** Checkbox ПРРО integration (fiscal receipts)
- **Images:** MinIO (self-hosted S3-сумісне сховище на VPS — дані залишаються в Україні)
- **Charts:** Recharts
- **Deploy:** Coolify on Hetzner VPS (self-hosted PaaS — автодеплой, SSL, zero-downtime)

### Auth Flow — деталі

**Покупці (storefront):**
1. Вводять номер телефону (`+380XXXXXXXXX`)
2. TurboSMS відправляє OTP-код (4 цифри, TTL 5 хвилин)
3. Вводять код → сесія створена (JWT в httpOnly cookie)
4. При першому вході — автоматична реєстрація (ім'я запитується після)
5. Повторний вхід — той самий flow, без пароля

**Адміни / менеджери (адмін-панель):**
- Email + password (bcrypt hash)
- Роль зберігається в JWT: `ADMIN` | `MANAGER`
- `middleware.ts` захищає `/admin/*`

**TurboSMS інтеграція (`lib/turbosms.ts`):**
```ts
// API: https://turbosms.ua/api.html
// POST https://api.turbosms.ua/message/send.json
// Headers: Authorization: Bearer {TURBOSMS_TOKEN}
// Body: { recipients: [phone], sms: { sender, text } }
```
- Зберігати OTP в Redis з TTL 300s: `otp:{phone}` → `{code}`
- Rate limit: максимум 3 спроби на номер за 10 хвилин

---

## Repository Structure

This is a rewrite project. Two repos sit side by side on disk:

```
/projects
  /ecommerce-reference   ← OLD project (read-only, do not modify)
  /ecommerce-ua          ← THIS project (you are here)
```

**ecommerce-reference** is a reference only.
Read it to understand existing business logic, user flows, and data structures.
Never copy code from it directly — rewrite everything clean.

---

## Reference Database (CS-Cart / MySQL)

The original project runs on **CS-Cart** (PHP e-commerce platform) with MySQL.
A full DB dump is located at: `../ecommerce-reference/database/dump.sql`

Key table groups to study (prefix: `cscart_`):

- **Products** — `cscart_products`, `cscart_product_descriptions`,
  `cscart_product_prices`, `cscart_product_features`,
  `cscart_product_options`, `cscart_products_categories`
- **Categories** — `cscart_categories`, `cscart_category_descriptions`
- **Orders** — `cscart_orders`, `cscart_order_details`, `cscart_order_data`
- **Users** — `cscart_users`, `cscart_user_profiles`, `cscart_usergroups`
- **Shipping** — `cscart_shippings`, `cscart_shipping_rates`
  (Nova Poshta integration: `cscart_ab__np_*` tables)
- **Payments** — `cscart_payments`
  (Monobank: `cscart_ab__mono_payments`, PrivatBank24: `cscart_ab__p24_payments`)
- **SEO** — `cscart_seo_names`, `cscart_seo_redirects`
- **Promotions** — `cscart_promotions`, `cscart_gift_certificates`
- **Fiscal** — `cscart_ab__prro_receipts`, `cscart_ab__prro_cash_registers`

> Use this schema to understand data relationships only.
> The new project uses **PostgreSQL + Prisma** — model the schema from scratch.

---

## Project URL Structure

```
/admin/dashboard
/admin/orders
/admin/orders/[id]
/admin/orders/[id]/print
/admin/orders/new
/admin/products
/admin/products/[id]
/admin/products/new
/admin/products/categories
/admin/products/features
/admin/products/filters
/admin/products/reviews
/admin/shipments
/admin/reports/sales
/admin/reports/categories
/admin/reports/regions
/admin/customers
/admin/settings
```

---

## Admin Panel — UX Requirements

### General rules
- **Language:** Ukrainian throughout the entire admin interface
- **UI library:** shadcn/ui for all components (tables, forms, dialogs, badges)
- **Mobile-friendly:** all pages must work on tablet and phone
- **Currency:** UAH only, format: `33 330 ₴`
- **Dates:** Ukrainian format `28.05.2026`, relative where helpful (`2 години тому`)

---

### Dashboard (`/admin/dashboard`)

**Remove from CS-Cart version:**
- Onboarding checklist (not needed after launch)
- "New CS-Cart version available" banner
- Storefronts widget

**Keep and improve:**
- Sales + orders metrics with period selector (today / week / month / custom)
- Revenue chart (Recharts, bar or line)
- Recent orders table with status badges
- Registered customers count

**Add new widgets:**
- Low stock alert (products with qty ≤ 5)
- Top 5 products by sales this month
- Abandoned carts count
- New reviews awaiting moderation

**Layout:** 3-column grid on desktop, single column on mobile
**Data source:** `/api/admin/stats` endpoint

---

### Orders (`/admin/orders`)

**Table columns:**
- ID + order link
- Buyer (full name + phone, two lines)
- Date (relative: `2 години тому`)
- Items count
- Total (UAH)
- Status badge (click opens detail — no inline toggle)
- Actions: view, print

**Above the table:**
- Search by name, phone, or order ID
- Filter tabs: Всі / Нові / Виконані / Скасовані / Повернення
- Date range picker
- Bulk actions: change status, export selected

**Remove:**
- Receipt status column (move to order detail page)
- Inline status dropdown in table row

---

### Order Detail (`/admin/orders/[id]`)

**Layout:** two-column on desktop (content left, sidebar right)

**Left — order content:**
- Product list: thumbnail, name, SKU, qty, price
- Buyer notes (read-only, highlighted if not empty)
- Admin notes (editable with save button — replace raw `[SalesDrive]` tags with clean UI)
- Order timeline at bottom: Створено → Підтверджено → Відправлено → Виконано

**Right sidebar (cards):**
- **Status card:** large badge + action buttons
  (Підтвердити / Відправити / Виконано / Скасувати — not a dropdown)
- **Customer card:** name, phone (click to call), email
- **Payment card:** method, amount, paid/unpaid badge
- **Nova Poshta card:**
  - TTH number (large text, one-click copy button)
  - Direct tracking link button
  - Branch address (city, branch number, street)
  - "Створити ЕН" button (Nova Poshta API)
- **Fiscal receipt card (Checkbox):**
  - Show only when payment method requires fiscal receipt
  - Hide entirely for cash on delivery (Післяплата)

**Actions menu (gear button → dropdown):**

Primary (always visible):
- Зберегти нотатки
- Змінити статус (inline buttons)

Secondary (dropdown):
- Роздрукувати рахунок
- Роздрукувати пакувальний лист
- Надіслати рахунок покупцю (email)
- Дублювати замовлення

Destructive (separate, with confirmation dialog):
- Скасувати замовлення
- Видалити замовлення (require typing order ID to confirm)
- Запросити повернення

**Print view** (`/admin/orders/[id]/print`):
- Separate clean route: order info + products + barcode + Nova Poshta label
- Barcode moves here only (remove from main detail page)

---

### Products (`/admin/products`)

**Table columns:**
- Thumbnail (click opens product)
- Name (full) + SKU below in gray
- Category
- Price (UAH)
- Stock qty with color indicator:
  - green = 10+
  - yellow = 3–9
  - red = 1–2
  - gray = 0 (out of stock)
- Status badge: Активний / Вимкнений (no inline toggle — click opens detail)

**Filter bar:**
- Search by name or SKU (always visible, prominent)
- Quick tabs: Всі / Активні / Вимкнені / Немає в наявності
- Dropdowns: Категорія, Ціна (range), Залишок
- Sort: За назвою / За ціною / За залишком / Дата додавання

**Bulk actions (on checkbox select):**
- Увімкнути / Вимкнути вибрані
- Змінити категорію
- Змінити ціну (% або фіксована сума)
- Експортувати вибрані (CSV)
- Видалити вибрані (with confirmation)

---

### Product Detail / New Product (`/admin/products/[id]`)

**Reference has 6 tabs — replace with cleaner sections on one page (or 3 tabs max):**

**Tab 1 — Основне:**
- Назва (required)
- Категорія (required, searchable dropdown)
- Ціна (UAH) — single price field
- Рекомендована ціна виробника (optional, shown as crossed-out on storefront)
- КОД / SKU
- Статус: Активний / Вимкнений / Прихований (radio)
- Зображення (drag & drop, multiple, reorderable)
- Повний опис (rich text editor)
- Короткий опис (rich text editor)

**Tab 2 — Склад та доставка:**
- Кількість в наявності
- Відстежувати запаси (toggle)
- Дія при нульовому залишку: Заборонити / Передзамовлення / Сповістити
- Повернення: так/ні + кількість днів
- Нова Пошта: відправлення без коробки (toggle)
- Checkbox ПРРО: назва в чеку + УКТЗЕД код

**Tab 3 — SEO та маркетинг:**
- Назва сторінки (meta title)
- Мета опис
- Користувацький H1 (replaces "АВ: Користувацький H1 PRO" tab)
- Теги (tag input)
- Пошукові слова (keyword synonyms for internal search)
- Гуртові знижки table: кількість / значення / тип / група користувачів

**Remove entirely:**
- "Модулі" tab — move relevant fields into Tab 2
- "АВ: Користувацький H1 PRO" tab — merge into SEO tab
- Промо текст field (not used)
- Популярність field (auto-calculated, not manual)
- "Ціна за одиницю" section (not relevant for this store)
- "Параметри опцій" section (move to separate variants feature if needed)

---

### Shipments (`/admin/shipments`)

**Table columns:**
- № відвантаження
- Замовлення (link)
- Покупець (name + phone)
- ТТН Нової Пошти (large, copyable with one click)
- Дата створення
- Дата відправки
- Статус (synced from Nova Poshta API automatically)

**Nova Poshta statuses:**
- Комплектується → Передано до НП → В дорозі →
  Прибуло у відділення → Отримано → Повернення

**Add:**
- Auto-sync TTH status via Nova Poshta API (cron job every 2 hours)
- "Оновити всі статуси" bulk action button
- Filter by status
- "Копіювати ТТН" button per row

---

### Sales Reports (`/admin/reports`)

**Report types:**
- Продажі по товарах
- Продажі по категоріях
- Продажі по регіонах (map + table)
- Статуси замовлень (funnel chart)
- Вартість доставки

**Each report includes:**
- Period selector: сьогодні / тиждень / місяць / квартал / рік / довільний
- Summary cards: загальний дохід, кількість замовлень, середній чек
- Recharts chart (bar or line)
- Full-width table, no horizontal scroll, no truncated names
- Sort by any column
- Export to CSV button

**Products sales table columns:**
- # (rank)
- Назва товару (full name, link to product)
- Категорія
- Продано (units)
- Дохід (UAH)
- % від загального
- Тренд vs попередній період (↑↓)

---

## Business Logic Notes

- **Nova Poshta TTH** is currently stored in admin notes via `[SalesDrive] TTH: XXXXXXX` tag.
  In the new system, TTH must be stored in a dedicated `shipments.tth_number` DB field.
- **Cash on delivery (Післяплата)** = no fiscal receipt required (Checkbox integration skipped).
- **SalesDrive CRM** integration exists in the reference — evaluate if needed in rewrite.
- **Product SKU codes** follow format: `LF 186024 BBS`, `MA020AD`, `D2H10AS` etc.
- **User groups** exist in reference (Гості, Зареєстровані, Покупець) — use for wholesale pricing.
- **Return period** is 10 days by default per product.
- **Single storefront** only — no multi-store logic needed.

---

## Product Detail — Full Tab Structure (from reference)

### Reference has 20+ tabs — this is the complete list seen in CS-Cart:
Main tabs: Загальні, Параметри доставки, Параметри, Характеристики,
Варіації, SEO, Гуртові знижки, Підписники, Модулі, Вкладки, Теги

Secondary tabs (addon modules):
Приєднані файли, Комплекти товарів, АВ: Відео галерея товару,
АВ: Стікери, АВ: Купити в кредит для України, Відгуки,
Обов'язкові товари, АВ: Користувацький H1 PRO, Макети

---

### Product Features (Характеристики tab) — real data observed:
This store sells furniture. Actual characteristics used:

- Сторона (side/orientation)
- Висота, мм
- Глибина, мм
- Ширина, мм
- Колір (e.g. Білий, Антрацит, Кашемір)
- Колір вставки
- Бренд (e.g. Metkas-Home)
- Кількість стулок (дверей)
- Висувна вішалка для одягу
- Гарантійний термін, міс (e.g. 12)
- Задня стінка
- Кількість зовнішніх висувних ящиків (e.g. 6)
- Корпус
- Ніжки (e.g. Пластик)
- Наявність дзеркала
- Полиці для білизни, шт
- Полиці для взуття, шт
- Тип направляючих для висувних шухляд (e.g. Телескопічні (кулькові))
- Фасади (e.g. Ламінована ДСП)
- Штанга для одягу

**Total: 20 characteristics per product, paginated 1–20 of 20.**

### New product features requirements:
- Store all features in `product_features` table with type (text, number, select)
- Features are filterable on storefront (used in sidebar filters)
- Features auto-generate short description: "Колір: Білий" (seen in Modules tab)
- Features are grouped by category template — furniture gets furniture fields,
  safes get safe fields (do NOT show all 20 fields for every product)

---

### Product Variations (Варіації tab) — real data observed:
Example: Комод MKA025 has 3 variations by color:
- MKA025A — Антрацит — 6 114 ₴ — qty: 100
- MKA025BS — Білий Сніг — 6 114 ₴ — qty: 100 (current product)
- MKA025K — Кашемір — 6 114 ₴ — qty: 100

Variation group ID: PV-2D53793CC

### New variations requirements:
- Variations are separate products linked by a variation group
- On storefront: show as color swatches (не окремі товари в каталозі)
- Each variation has its own SKU, qty, price, images
- Variation group shown as color selector on product page
- In admin: "Варіації" tab shows all siblings with thumbnail + color label

---

### Product SEO tab — real data observed:
- SEO name (slug): `/mebli-ua/komod-na-6-yaschikiv-aterio-1500...`
- Meta title (empty — not filled for most products)
- Meta description (empty — not filled for most products)
- Meta keywords (empty)
- Google rich snippets preview: shows title, URL, price, availability

### New SEO requirements:
- SEO slug auto-generated from product name (transliterated to Latin)
- Meta title: if empty — auto-fill from product name
- Meta description: if empty — auto-fill from short description (first 160 chars)
- Google rich snippets: implement JSON-LD with Product schema
  (name, price, availability, brand, image) via Next.js generateMetadata()
- Every product page MUST have unique meta title + description

---

### Wholesale / Bulk Pricing (Гуртові знижки tab) — real data observed:
Example row: qty=1, value=6114, type=Фіксована, group=Всі
(This means: for qty 1+, fixed price 6114 UAH for all user groups)

### New wholesale pricing requirements:
- `product_prices` table: product_id, min_qty, price, user_group_id
- Support both fixed price and percentage discount types
- User groups: Всі, Зареєстровані, Оптовий покупець
- On storefront: show tiered pricing table if multiple rows exist

---

### Product Bundles / Комплекти товарів — real data observed:
Dialog "Додати новий комплект" has:
- Назва (bundle name)
- Опис (rich text)
- Відображати в акціях (show in promotions)
- Рекламне зображення (promo image)
- Задати період доступності (date range)
- Статус

### New bundles requirements:
- `product_bundles` table: id, name, description, image, active_from, active_to, status
- `product_bundle_items` table: bundle_id, product_id, qty, discount
- On storefront: show "Комплект" section on product page with bundle price
- In admin: simple interface — name + add products with qty

---

### Video Gallery (АВ: Відео галерея товару) — real data observed:
- Supports YouTube and Vimeo (by video ID)
- Supports direct video URL (WAV, H.264/mp4, Ogg, WebM)
- Position in image gallery (before/after images)
- Can set video as default product image
- Video icon type: frame from video / manual icon / no icon

### New video requirements:
- `product_videos` table: product_id, type (youtube/vimeo/url), video_id, position
- On storefront: show video player in image gallery (after photos)
- YouTube embed via nocookie domain for GDPR compliance

---

### Credit / Installment Payment (АВ: Купити в кредит для України):
- Оплата частинами Приват24: enabled by default
- Термін кредиту: 1–6 months (configurable per product)
- LiqPay also supports installments

### New credit requirements:
- `product_credit_settings` table: product_id, privat24_enabled, min_months, max_months
- On storefront: show "Купити в кредит" button on product page
- Calculate monthly payment and show to customer before checkout

---

### Product Tabs (Вкладки tab) — visible tabs on storefront product page:
- Опис ✓ enabled
- Характеристики ✓ enabled
- Відгуки ✓ enabled
- Відео галерея ✓ enabled
- Список варіантів товару ✓ enabled
- Комплекти з цим товаром ✓ enabled
- Промо-акції ✓ enabled
- Файли ✓ enabled
- Теги ✓ enabled
- Приєднані файли ✓ enabled
- Відгуки ✓ enabled (duplicate — CS-Cart bug)
- Обов'язкові товари ✓ enabled

### New product page tabs (storefront):
Implement as anchor-scrolled sections, not separate tabs:
1. Опис (full description)
2. Характеристики (features table)
3. Варіації (color swatches — inline, not a tab)
4. Відгуки (reviews with rating)
5. Відео (if product has videos)
6. Схожі товари / Комплекти (related/bundle products)

---

### Mandatory Products (Обов'язкові товари):
Products that are automatically added to cart with this product.
Example use: a mattress that requires a bed frame.
Advanced search dialog: search by name, price range, category.

### New mandatory products:
- `product_required_items` table: product_id, required_product_id
- On add-to-cart: show popup "Цей товар зазвичай купують з..."
- Customer can dismiss or add required product

---

## Product Data Model (Prisma schema summary)

```prisma
model Product {
  id                Int
  sku               String        // e.g. MKA025BS
  name              String        // Ukrainian
  slug              String        // SEO URL slug
  price             Decimal
  listPrice         Decimal?      // Recommended retail price
  qty               Int
  status            ProductStatus // ACTIVE | DISABLED | HIDDEN
  description       String?       // Full rich text
  shortDescription  String?
  metaTitle         String?
  metaDescription   String?
  customH1          String?
  warrantyMonths    Int?          // e.g. 12
  returnDays        Int           // default 10
  trackInventory    Boolean       // default true
  outOfStockAction  OutOfStockAction // DENY | PREORDER | NOTIFY
  noBoxShipping     Boolean       // Nova Poshta without box
  checkboxName      String?       // Fiscal receipt product name
  uktZed            String?       // УКТЗЕД code for Checkbox

  categories        ProductCategory[]
  images            ProductImage[]
  videos            ProductVideo[]
  features          ProductFeatureValue[]
  variationGroup    ProductVariationGroup?
  prices            ProductPrice[]        // wholesale tiers
  bundles           ProductBundle[]
  requiredProducts  Product[]
  tags              Tag[]
  reviews           Review[]
  creditSettings    ProductCreditSettings?
}
```


---

## Storefront Page Layout (from Макети tab — CS-Cart block manager)

### What this shows:
CS-Cart uses a drag-and-drop block manager (UniTheme 2) to compose pages.
Each "block" is a widget with settings. This reveals the full structure of
the product page and site layout as currently built.

### Header (ВЕРХНЯ ПАНЕЛЬ):
- Місцезнаходження (location)
- Швидкі посилання (quick links — hidden on phone, visible tablet+)
- FLY: Мови (language switcher)
- FLY: Валюти (currency switcher)
- Мій акаунт (user account block)
- Валюта
- Мови
- AB: FLY меню (flyout navigation menu)
- Логотип
- Каталог товарів
- Пошук
- Контакти
- AB: Кнопки Порівняння
- Акаунт
- Кошик

### Product page body (ВМІСТ):
- Головний вміст #12 (main product content — images, title, price, buy button)
- Можливо, це зацікавить вас #126 (related products / "you may also like")
- Найпопулярніші #127 (most popular products)
- Розпродаж #128 (sale products)
- Нещодавно переглянуті #129 (recently viewed)
- Банер в товарі #130 (banner inside product page)
- Переваги #131 (advantages/benefits block — disabled)
- Benefits #215 (enabled)
- Меню з іконками #157 (icon menu)

### Footer (НИЖНІЙ КОЛОНИТУЛ):
- Обліковий запис #76
- Покупцям #75
- Контакти #77
- Приймаємо до оплати #180 (accepted payment methods)
- копірайт #178
- Копірайт #19
- Іконки платіжних систем #78

---

### New storefront page structure (Next.js components):

**Layout components** (`/components/layout/`):
```
Header/
  TopBar.tsx         ← location, quick links, language (desktop only)
  Navigation.tsx     ← logo, catalog menu, search, account, cart
  MobileMenu.tsx     ← hamburger menu for phone

Footer/
  FooterLinks.tsx    ← account links, buyer info, contacts
  FooterPayments.tsx ← accepted payment icons
  FooterCopy.tsx     ← copyright
```

**Product page sections** (`/app/products/[slug]/`):
```
page.tsx             ← SSR with generateMetadata()

_components/
  ProductGallery.tsx      ← images + video
  ProductInfo.tsx         ← title, price, variations (color swatches)
  ProductActions.tsx      ← add to cart, buy now, credit button
  ProductFeatures.tsx     ← characteristics table
  ProductDescription.tsx  ← full rich text description
  ProductReviews.tsx      ← reviews with rating
  ProductVideos.tsx       ← YouTube/Vimeo embed
  RelatedProducts.tsx     ← "Можливо, це зацікавить вас"
  RecentlyViewed.tsx      ← "Нещодавно переглянуті" (localStorage)
  ProductBanner.tsx       ← optional banner slot
  ProductBenefits.tsx     ← benefits/advantages block
  ProductBundles.tsx      ← "Комплекти з цим товаром"
```

**Block visibility rules** (from block manager):
- Quick links: hidden on mobile (`hidden md:block`)
- Language / currency switcher: shown only if multi-language needed
  (single language for now — Ukrainian only)
- Recently viewed: client-side only (localStorage, no SSR)
- Benefits block: always shown on product page
- Sale / Popular products: shown below main content

### Key insight from block manager:
The "Швидкі посилання" block uses CSS class `top-quick-links hidden-phone`
and has device visibility settings (Планшет + ПК only).
In Next.js: use Tailwind responsive classes instead of JS-based device detection.
All responsive behavior via CSS only — no JS viewport checks.


---

## Categories — Full Structure (from reference)

### Stats (sidebar summary):
- Total categories: 98
- Total products: 1308
- Active categories: 96
- Hidden categories: 1
- Inactive categories: 1

### Top-level category tree (Крамниця: SKLADCOM):
```
Стелажі          (873 products)
  ├── На болтах
  ├── На зацепах
  │   └── стелажі
  ├── Лофт
  ├── Верстак
  ├── За призначенням
  └── Торгові стелажі
      ├── Двосторонні
      ├── Кутові
      ├── Кондитерські
      ├── Настінні
      ├── Овочеві
      ├── Перфоровані
      ├── Панельні
      └── Пристінні
Меблі            (375 products)
Драбини          (25 products)
  ├── Приставні
  ├── Трансформери  (disabled)
  ├── Універсальні
  ├── Стрем'янки
  ├── Двосекційні
  ├── Трисекційні
  └── Підмостки
Сейфи
Сортування сміття
Інше
```

### Category detail tabs (reference):
- Загальні, Модулі, Зовнішній вигляд, АВ: Мультиописи,
  АВ: Назва характеристик для вивантажень,
  АВ: Користувацький H1 PRO, Макети

### Category — Загальні tab fields:
- Розташування (parent category — tree select)
- Назва (required)
- Опис (rich text — full SEO article, e.g. "Купити поличні стелажі в Україні")

### Category — Зовнішній вигляд tab:
- Доступні відображення: Сітка ✓, Список без параметрів ✓, Компактний список ✓
- Відображення за замовчуванням: Сітка (окремо для ПК / Планшет / Смартфон)
- Колонки товарів: 0 (global default)

### Category — Модулі tab:
- АВ: Розширені промо-акції (icon for filter block)
- АВ: Каталог (mini icon, display style above/below name)
- АВ: Посадкова категорія/сторінка (use as landing page)
- АВ: Керування структурою посадкової категорії (menu ID link)
- АВ: Швидка навігація

### Category — АВ: Мультиописи tab:
- Multiple description blocks per category (none used currently)

### Category actions (gear menu per row):
- Додати товар
- Редагувати
- Видалити

---

## New Categories Admin Requirements

### `/admin/products/categories` page:

**Tree view table columns:**
- Позиція (drag handle for reorder)
- Назва (indented tree, expandable)
- Кількість товарів (badge)
- Статус (Активна / Вимкнена / Прихована)
- Actions: додати підкатегорію, редагувати, видалити

**Summary card (right sidebar):**
- Total categories count
- Total products count
- Active / hidden / inactive breakdown

**Actions per category row:**
- Додати товар до категорії
- Редагувати категорію
- Видалити (with confirmation, shows product count warning)

---

### `/admin/products/categories/[id]` — Category detail:

**Single page, 3 sections (no excessive tabs):**

**Section 1 — Основне:**
- Батьківська категорія (tree select)
- Назва (required)
- Slug (SEO URL, auto-generated)
- Статус: Активна / Вимкнена / Прихована
- Зображення (category thumbnail)
- Мета-іконка (small icon for catalog navigation)
- Опис (rich text — full SEO article)

**Section 2 — SEO:**
- Meta title (auto-fill from name if empty)
- Meta description (auto-fill from description first 160 chars)
- Користувацький H1 (custom H1, separate from page title)
- Canonical URL

**Section 3 — Відображення:**
- Default view: Сітка / Список / Компактний (separate per device)
- Products per page (12 / 24 / 48)
- Sort by default: За популярністю / За ціною / За назвою / Новинки

---

## Category Data Model (Prisma)

```prisma
model Category {
  id              Int
  parentId        Int?
  name            String          // Ukrainian
  slug            String          // SEO URL
  description     String?         // Rich text SEO article
  metaTitle       String?
  metaDescription String?
  customH1        String?
  image           String?         // thumbnail URL
  icon            String?         // mini icon URL
  status          CategoryStatus  // ACTIVE | DISABLED | HIDDEN
  position        Int             // sort order
  defaultView     ViewType        // GRID | LIST | COMPACT

  parent          Category?       @relation("CategoryTree")
  children        Category[]      @relation("CategoryTree")
  products        ProductCategory[]
}
```

---

## Key Business Insights

- **Стелажі** is the main category with 873 products (67% of catalog)
- **Меблі** second with 375 products (29%)
- Categories have full SEO articles as descriptions — important for ranking
- Category tree is 3 levels deep maximum
- "Трансформери" subcategory is disabled (0 products) — example of cleanup needed
- Product can belong to multiple categories (seen in product detail —
  MKA025BS belongs to 8 categories simultaneously)
- Categories use UniTheme2 block manager same as product pages
  → in new project: category page layout is a Next.js template, not block-based


---

## Product Features System (Характеристики)

### Features list page — columns:
- Ім'я + ID, Назва вітрини, Група, Категорії, Статус
- Search sidebar: by category, by feature name, by group
- Actions: Групи ознак, Імпорт, Експорт, + Нова функція

### Features visible in reference (partial list):
| Feature | Category |
|---------|----------|
| Висота настилу (А) | Підмостки |
| Висота помоста (D) | Підмостки |
| Робоча висота помосту (В) | Підмостки |
| Габаритні розміри упаковки (Д/Ш/В) | Драбини |
| Колір | Торгові стелажі |
| Матеріал полиці | Торгові стелажі |
| Полиці | Торгові стелажі |
| Призначення | Сортування сміття, Торгові стелажі |
| Розміри | Сортування сміття + 11 категорій |
| Тип полиць | Торгові стелажі |
| Тип стелажу | Торгові стелажі |
| Висота мм | Сейфи |
| Висота, см | Стелажі + 26 категорій |

### Feature detail fields (from dialog):
**Загальні tab:**
- Назва (required) — admin name
- Назва вітрини — storefront display name (editable separately)
- Мета (feature purpose):
  - Пошук товарів з фільтрами ← most used
  - Варіації як окремі товари
  - Варіації як один товар
  - Бренд, автор, т. ін.
  - Додаткова інформація
- Зовнішній вигляд: Текст або число / Select / Checkbox / ...
- Тип фільтра: Прапорець / Range / ...
- Група: dropdown (feature group)
- Код характеристики: Brand / ISBN / GTIN / MPN (for rich snippets)
- Позиція: sort order
- Опис: rich text
- Статус: Увімк. / Приховано / Вимк.
- Показувати у вкладці «Характеристики» картки товару ✓
- Показувати в списку товарів ✓
- Показувати в заголовку картки товару ☐
- Префікс / Суфікс (text before/after value, e.g. "мм", "кг")
- АВ: Використовувати для короткого опису ☐

**Варіанти tab:**
- List of predefined values with position
- Example: "Висота настилу (А)" has variants: 1, 1.3
- "+ Додайте варіант" button

**Категорії tab:**
- Which categories this feature applies to
- Example: "Висота настилу (А)" → Підмостки only

---

### New Features Admin (`/admin/products/features`):

**List page:**
- Table: Name, Display name, Type, Filter type, Categories count, Status
- Filter by category dropdown
- Search by name
- Import/Export CSV buttons
- "+ Нова характеристика" button

**Feature detail (modal or page):**

**Tab 1 — Загальне:**
- Назва (admin)
- Назва на сайті (storefront)
- Призначення (purpose): select / filter / variation / brand / info
- Тип значення: Текст / Число / Select / Checkbox / Колір
- Тип фільтра: Прапорець / Діапазон / Без фільтра
- Префікс / Суфікс
- Позиція
- Статус

**Display options (checkboxes):**
- Показувати на сторінці товару
- Показувати в списку товарів
- Показувати в заголовку (above title)
- Використовувати для короткого опису (auto-generate)

**Tab 2 — Варіанти:**
- Editable list of predefined values
- Drag to reorder
- Only for Select / Checkbox types

**Tab 3 — Категорії:**
- Multi-select tree of categories
- Feature only appears on products in selected categories

---

### Feature Data Model (Prisma):

```prisma
model ProductFeature {
  id              Int
  name            String          // admin name
  displayName     String          // storefront name
  purpose         FeaturePurpose  // FILTER | VARIATION | BRAND | INFO
  valueType       FeatureType     // TEXT | NUMBER | SELECT | CHECKBOX | COLOR
  filterType      FilterType      // CHECKBOX | RANGE | NONE
  prefix          String?
  suffix          String?         // e.g. "мм", "кг", "міс"
  position        Int
  status          FeatureStatus   // ACTIVE | HIDDEN | DISABLED
  showOnProduct   Boolean         // show in Характеристики tab
  showInList      Boolean         // show in product list
  showInHeader    Boolean         // show above product title
  useForShortDesc Boolean         // auto-generate short description

  variants        ProductFeatureVariant[]
  categories      Category[]
  values          ProductFeatureValue[]
}

model ProductFeatureVariant {
  id        Int
  featureId Int
  value     String      // e.g. "Білий", "1", "1.3", "Антрацит"
  position  Int
  feature   ProductFeature @relation(...)
}

model ProductFeatureValue {
  id         Int
  productId  Int
  featureId  Int
  variantId  Int?        // for SELECT type — links to variant
  value      String?     // for TEXT/NUMBER type — free text
  product    Product     @relation(...)
  feature    ProductFeature @relation(...)
  variant    ProductFeatureVariant? @relation(...)
}
```

---

### Key insight — Features drive filters:
Features with purpose "Пошук товарів з фільтрами" automatically
appear in the sidebar filter panel on category pages.
Filter type determines UI: Прапорець = checkboxes, Range = price slider.
This is the core of storefront search/filter — must be implemented correctly.


---

## Feature Groups (Групи характеристик)

Groups bundle related features together for display on product page.

### Existing groups in reference:
| Group | Features | Category |
|-------|----------|----------|
| Призначення стелажів #600 | — | Стелажі |
| Габарити #659 | Висота, Ширина, Глибина (3) | Торгові стелажі |
| Основні характеристики #660 | — | Торгові стелажі |
| Характеристики драбини #658 | Тип драбини, Робоча висота (загальна), Довжина (загальна), Робоча висота (літера Л), Висота (літера Л), Робоча висота (літера У), Висота (літера У), Кількість сходів секції, Кількість секцій, Матеріал драбини... (19) | Драбини |
| Характеристики стрем'янки #656 | Висота до платформи, Розміри платформи (2) | Стрем'янки |

### Key insight:
- "Характеристики драбини" has 19 features — ladder specs are very detailed
- Groups are category-specific — each product type has its own group template
- On product page: features render grouped under their group name as a header

### New feature groups model:
```prisma
model ProductFeatureGroup {
  id          Int
  name        String
  displayName String
  position    Int
  status      FeatureStatus
  categories  Category[]
  features    ProductFeature[]
}
```

On storefront product page — Характеристики tab renders as:
```
[Group name header]
  Feature 1: value
  Feature 2: value
[Next group header]
  ...
```


---

## Import/Export System

### Available import sections (right sidebar):
- АВ: Стікери
- Характеристики ← current
- Замовлення
- В пункт самовивезення
- Відгуки про товар
- Товари
- Регіони
- Підписники
- Переклади
- Користувачі
- Товари (старий імпорт)

### Features CSV import — exact column structure:
**Required columns (highlighted):**
- `Feature name` / Назва характеристики
- `Feature ID` / ID характеристики
- `Language` / Мова
- `Type` / Тип

**Optional columns:**
- `Storefront feature name` / Назва характеристики вітрини
- `Purpose` / Мета
- `Feature style` / Зовнішній вигляд
- `Filter style` / Тип фільтра
- `Feature code` / Код характеристики
- `Group` / Група
- `Description` / Опис
- `Categories` / Категорії
- `Variants` / Варіанти
- `Prefix` / Префікс
- `Suffix` / Суфікс
- `Show on the features tab` / Показувати у вкладці «Характеристики»
- `Show in product list` / Показувати в списку товарів
- `Show in product header` / Показувати в заголовку картки товару
- `Position` / Позиція
- `Comparsion` / Порівняння
- `Status` / Статус
- `Store` / Крамниця

**Import settings:**
- Category separator: `///` (e.g. `Computers///Desktops`)
- CSV delimiter: Крапка з комою (semicolon)
- File source: upload / server path / URL

### New import requirements (`/admin/import`):

**Supported import types:**
- Товари (products) — main catalog import
- Характеристики (features)
- Замовлення (orders)
- Користувачі (customers)
- Відгуки (reviews)
- Категорії (categories)

**Each import page:**
- Download CSV template button
- Column mapping UI (drag columns to fields)
- Preview first 5 rows before importing
- Import with progress bar
- Error log: show rows that failed with reason
- Category path separator configurable (`///` default)

**Product CSV columns to support** (critical for migration):
```
product_id, product_code (SKU), product (name), category (path with ///),
price, list_price, qty_in_stock, status,
full_description, short_description,
meta_title, meta_description, meta_keywords,
seo_name (slug), tag (tags),
height_mm, width_mm, depth_mm, color, brand,
warranty_months, return_days,
image_1, image_2, ... image_10 (URLs)
```

### Key insight — migration path:
The reference project has Import/Export for all entity types.
Use CS-Cart's export to get CSV files of all products/categories/features,
then build import scripts to load into new PostgreSQL database.
This is the data migration strategy — no manual re-entry needed.


---

## Filters System (Фільтри)

### Filters list — real filters in reference:
| Filter | Based on | Shown in categories |
|--------|----------|---------------------|
| Ціна #1 | Ціна | Меблі, Стелажі, Драбини, Трансформери, Універсальні, Стрем'янки... (89) |
| Висота мм #23 | Висота мм | Сейфи, Побутові сейфи, Бухгалтерські, Збройові, Зламостійкі, Вбудовані... |
| Колір каркасу #16 | Колір каркасу | Лофт, Лофт меблі, Полиці, Стелажі Loft |
| Наявність #2 | В наявності | Меблі... (58) — **DISABLED** |
| Колір полиць #17 | Колір Полиць | Лофт, Лофт меблі, Полиці, Стелажі Loft |
| Оцінка товару #4 | Оцінка 4+ | Всі категорії — **DISABLED** |
| Ширина мм #24 | Ширина мм | Сейфи, Побутові сейфи, Бухгалтерські, Збройові... |
| Висота #5 | Висота, мм | Меблі, Стелажі, Драбини, Приставні, Трансформери, Стрем'янки, Лофт меблі... (29) |
| Глибина мм #25 | Глибина мм | Сейфи, Побутові сейфи, Бухгалтерські, Збройові... |
| Тип Драбини #30 | Тип драбини | Драбини |
| Висота стелажу #9 | Висота, см | Стелажі, На болтах, На зацепах, Лофт, Рек, Кронос, Елегант, Еталон, Складком В, Титан... (27) |
| Кількість секцій #31 | Кількість секцій | Драбини, Універсальні |
| Колір #26 | Колір | Сейфи, Побутові сейфи, Бухгалтерські, Збройові... |

### Filter detail fields (from "Новий фільтр" dialog):

**Загальні tab:**
- Назва (display name in sidebar)
- Поз. (position/sort order)
- Фільтрувати за (which feature — searchable dropdown):
  - Links to ProductFeature with purpose = FILTER
  - Available: Висота настилу (А), Висота помоста (D),
    Габаритні розміри упаковки, Колір, Матеріал полиці,
    Полиці, Призначення (×2), ...
- Тип відображення: Розгорнутий / Згорнутий
- Кількість відображуваних варіантів перед прокручуванням: 10 (default)
- UniTheme2 display type per device:
  - ПК: Розгорнутий
  - Планшет: Розгорнутий
  - Смартфон: Розгорнутий

**Категорії tab:**
- "Всі категорії включені" (default — global filter)
- OR: specific category list (e.g. Ціна filter shows in 89 categories)
- Price filter categories: Меблі, Стелажі, Драбини, Приставні,
  Трансформери, Універсальні, Стрем'янки + many more

---

### New Filters Admin (`/admin/products/filters`):

**List page columns:**
- Назва, Характеристика (based on), Категорії count, Статус
- Quick create button

**Filter detail (modal):**
- Назва
- Характеристика (searchable select from features with purpose=FILTER)
- Тип відображення: Розгорнутий / Згорнутий / Слайдер (for range)
- Показувати варіантів до "Показати більше": number input
- Категорії: all / specific list

---

### Storefront filter sidebar — implementation:

**Category page** (`/app/[...slug]/page.tsx`) must:
1. Load filters assigned to current category
2. For each filter: load available values + count of matching products
3. Apply selected filters to product query (URL params: `?color=Білий&height=500-1000`)
4. Update URL without page reload (Next.js `useRouter`)
5. Show active filters as removable chips above product grid

**Filter UI components:**
```
FilterSidebar/
  FilterGroup.tsx      ← collapsible section per filter
  CheckboxFilter.tsx   ← for SELECT/multi-value features
  RangeFilter.tsx      ← for numeric range (price, height, width)
  ColorFilter.tsx      ← for color features (colored circles)
  ActiveFilters.tsx    ← chips showing selected filters + "Clear all"
```

**Price filter** — always first, always range slider (min/max UAH)
**Numeric filters** (висота, ширина, глибина) — range slider with mm/cm units
**Select filters** (колір, тип, матеріал) — checkbox list, show count per value
**Collapsed by default on mobile** — expand on tap

---

### Filter Data Model (Prisma):

```prisma
model ProductFilter {
  id            Int
  name          String
  featureId     Int
  displayType   FilterDisplayType  // EXPANDED | COLLAPSED | SLIDER
  maxVisible    Int                // items before "show more", default 10
  position      Int
  status        FilterStatus

  feature       ProductFeature  @relation(...)
  categories    Category[]      // empty = all categories
}
```

**URL filter params format:**
```
/stelajhi?price=500-5000&color=Білий,Антрацит&height=1000-2000&page=1
```


---

## Product Options / Parameters (Параметри)

### Current state in reference:
Only ONE option exists: "Колір каркасу" (frame color) — Active.
This section is barely used in the reference project.

### Option detail fields ("Нова опція" dialog):
- Назва (admin name) + Назва вітрини (storefront name)
- Позиція
- Тип: Список варіантів (dropdown) — other types likely: radio, checkbox, text input
- Опис (rich text)
- Коментар (shown below option on storefront)
- Обов'язково (required toggle)
- Якщо відсутні варіанти (behavior when no variants available)
- Варіанти tab: list of selectable values

### Difference: Options vs Features vs Variations:
- **Характеристики (Features)** — informational specs shown in product tab
  (height, width, brand, warranty) — used for filters
- **Варіації (Variations)** — separate products linked by color/size group
  (MKA025A / MKA025BS / MKA025K)
- **Параметри (Options)** — customer selects before add-to-cart
  (e.g. "Choose frame color") — affects nothing in current store

### New project decision:
> **Do NOT implement product options in v1.**
> The store uses Variations for color differences (separate products per SKU).
> Options (customer-selectable before cart) are not needed for furniture/shelving.
> If needed in future: add as a separate feature after launch.


---

## Product Reviews (Відгуки)

### Current state in reference:
Zero reviews — "Дані не знайдено". Feature exists but unused.

### Review search fields (sidebar):
- Покупець (customer name/email)
- Переваги (pros text)
- Недоліки (cons text)
- Коментар (comment text)
- Оцінка (rating: 1–5 stars)
- Корисність (helpfulness votes: min–max range)
- З фото (has photo: yes/no/all)

### Review data model — fields visible:
```prisma
model Review {
  id          Int
  productId   Int
  userId      Int?
  authorName  String
  rating      Int         // 1–5
  pros        String?     // Переваги
  cons        String?     // Недоліки
  comment     String?
  photos      String[]    // image URLs
  helpful     Int         // upvotes count
  notHelpful  Int         // downvotes count
  status      ReviewStatus // PENDING | APPROVED | REJECTED
  createdAt   DateTime
  product     Product @relation(...)
  user        User?   @relation(...)
}
```

### New reviews admin (`/admin/products/reviews`):
- Table: product name, author, rating (stars), pros/cons preview,
  date, status (Pending / Approved / Rejected)
- Bulk approve / reject
- Filter by rating, status, has photo
- Import/Export CSV (for migration — currently 0 reviews but keep for future)

### Storefront review form fields:
- Ім'я (name, required)
- Оцінка (star rating 1–5, required)
- Переваги (pros, optional)
- Недоліки (cons, optional)
- Коментар (comment, optional)
- Фото (photo upload, optional, max 5)
- Submit → status: PENDING (requires admin approval)


---

## Users System (Користувачі)

### Sub-sections:
- Покупці / Customers
- Адміністратори / Admins
- Групи користувачів / User groups
- Центр повідомлень / Message center

---

### Customers (`/admin/customers`)

**Table columns:** ID, Ім'я, E-mail, Останній вхід, Телефон,
Замовлення (created/paid/total ₴), Статус

**Real data observed (8 customers total — store is new):**
- Most have no name filled (shows "–") — registered via email only
- Phone numbers: all Ukrainian (+380...)
- Orders format: `2 / 2 / 2 736 ₴` = created / paid / total spent

**Customer actions (gear menu):**
- Переглянути всі замовлення
- Ввійти як користувач (impersonate)
- Анонімізувати (GDPR anonymize)
- Редагувати
- Видалити

**Customer detail fields:**
- E-mail (required)
- Пароль / Підтвердження паролю
- Статус: Увімк. / Вимк.
- Звільнений від податку (tax exempt toggle)
- Мова: Українська
- Ім'я, Прізвище, По-батькові
- Компанія
- Код ЄДРПОУ (legal entity code — for B2B)
- Телефон

**Адреса доставки section:**
- Адреса, Код ЄДРПОУ

**Right sidebar — order stats:**
- Дата реєстрації
- Перше замовлення (date + link)
- Створені замовлення (count)
- Сплачені замовлення (count)
- Всього витрачено (UAH)
- Останнє замовлення (date)
- Адреса доставки на карті (Google Maps embed)

**Customer tabs:**
- Загальні (main info)
- Групи користувачів (assign to wholesale group)
- GDPR: дані користувача

---

### Administrators (`/admin/admins`)

**Real admins in reference:**
| ID | Name | Email | Last login |
|----|------|-------|-----------|
| 1 | Костючок Анатолій (Головний адміністратор) | admin@skladcom.ua | 28.05.2026 |
| 2 | Вебмайстер | webmaster@teamit.com.ua | 14.05.2026 |
| 3 | Олег | oleg.katrych@gmail.com | 24.05.2026 |
| 5 | – | no-reply@skladcom.ua | never |

---

### User Groups (`/admin/user-groups`)

**Real groups in reference:**
| Group | Type |
|-------|------|
| Administrator | Адміністратор |
| Content manager | Адміністратор |
| Sales manager | Адміністратор |
| Дизайнер | Адміністратор |
| CEO Маркетинг | Адміністратор |
| Покупець | Покупець |

**Group permissions (3-level):**
- Повний доступ
- Можна лише переглядати
- Немає доступу

**Permission sections visible:**
АВ: Менеджер модулів, АВ: Антибот, АВ: Банери для категорій,
АВ: Користувацький H1 PRO, АВ: Розширені промо-акції,
АВ: Швидка навігація, АВ: Приховати частину контенту,
АВ: Розширені переглядачі зображень, АВ: Посадкові категорії/сторінки,
АВ: Lazy load зображень, АВ: Оплати і розстрочки від Monobank...

---

### Message Center (Центр повідомлень)

One discussion thread visible: "Дискусія #1"
- From: Анатолій Костючок (admin reply)
- Re: Замовлення #0
- Date: 20.03.2026

---

### New Users Admin Requirements

**`/admin/customers` table columns:**
- ID, Ім'я + Прізвище, E-mail, Телефон,
  Замовлень (count), Витрачено (UAH), Остання активність, Статус

**Customer detail — 2 tabs:**

Tab 1 — Профіль:
- Email, статус, мова
- Ім'я, Прізвище, По-батькові
- Компанія, Код ЄДРПОУ (B2B)
- Телефон
- Адреса доставки (default)

Tab 2 — Замовлення:
- List of all orders with status + total
- Stats: total orders, total spent, avg order value

**Customer actions:**
- Ввійти як клієнт (impersonate for support)
- Анонімізувати (GDPR — replace PII with hashed values)
- Заблокувати / Розблокувати

**`/admin/admins` — separate page:**
- Same table structure as customers
- Role assignment: Administrator / Content manager / Sales manager

**User groups / Roles:**
```
SUPER_ADMIN   — full access to everything
ADMIN         — full access except user management
CONTENT       — products, categories, pages only
SALES         — orders, customers, shipments only
DESIGNER      — storefront settings only (read-only admin)
CUSTOMER      — storefront account only
WHOLESALE     — customer with wholesale pricing access
```

---

### User Data Model (Prisma):

```prisma
model User {
  id            Int
  email         String        @unique
  passwordHash  String
  firstName     String?
  lastName      String?
  middleName    String?       // По-батькові
  company       String?
  edrpou        String?       // Код ЄДРПОУ
  phone         String?
  language      String        // default "uk"
  taxExempt     Boolean       // default false
  status        UserStatus    // ACTIVE | DISABLED
  role          UserRole      // SUPER_ADMIN | ADMIN | CONTENT | SALES | CUSTOMER | WHOLESALE
  createdAt     DateTime
  lastLoginAt   DateTime?

  orders        Order[]
  addresses     UserAddress[]
  reviews       Review[]
}

model UserAddress {
  id        Int
  userId    Int
  address   String
  city      String
  isDefault Boolean
  user      User @relation(...)
}
```


---

## Marketing Section (Маркетинг)

### Sub-sections:
- Промо-акції / Promotions
- Комплекти товарів / Product bundles
- Розсилки / Newsletters
- Подарункові сертифікати / Gift certificates
- Банери / Banners
- Прайс-листи / Price feeds

---

### Promotions (`/admin/marketing/promotions`)

**Real promotions in reference:**
| Name | Zone | Priority | Exclusive |
|------|------|----------|-----------|
| Безкоштовна доставка від 15000 грн | Кошик | 0 | Ні |
| Весняний розпродаж | Каталог | 0 | Ні |

**Promotion detail tabs:**
Загальні, Умови, Бонуси, АВ: Розширені промо-акції,
АВ: Розклад промо-акції, Макети

**Загальні tab fields:**
- Назва
- Детальний опис (rich text — e.g. "Самовивіз Безкоштовно... м. Крюковщина (Київська обл.), вул. Джерельна, будинок 12а")
- Короткий опис (e.g. "Безкоштовна доставка від 15000 грн")
- Зображення
- Задати період доступності (date range toggle)
- Доступна з / Доступна до
- Пріоритет
- Не дозволяти інші акції (exclusive toggle)
- Статус: Увімк. / Приховано / Вимк.

**Zone types:** Кошик (cart) / Каталог (catalog)

**New promotions requirements:**
```prisma
model Promotion {
  id            Int
  name          String
  description   String?
  shortDesc     String?
  image         String?
  zone          PromoZone    // CART | CATALOG
  priority      Int
  exclusive     Boolean
  activeFrom    DateTime?
  activeTo      DateTime?
  status        PromoStatus
  conditions    PromoCondition[]
  bonuses       PromoBonus[]
}
```
Condition types: min cart total, specific category, specific product, user group
Bonus types: free shipping, % discount, fixed discount, free product

---

### Product Bundles (`/admin/marketing/bundles`)

One bundle exists: "В комплекті зі знижкою" — 0 товарів, Вимк.
(Already documented in product detail section above)

---

### Newsletters (`/admin/marketing/newsletters`)

**Sub-sections (right sidebar):**
- Розсилки (sent newsletters)
- Шаблони (email templates)
- Автовідповідачі (autoresponders)
- Кампаній (campaigns)
- Списки розсилок (mailing lists)
- Підписники (subscribers)

**One sent newsletter:** "тестова розсилка" — 15.10.2025 — Відправлено

**New newsletter decision:**
> Use **external email service** (Mailchimp, SendGrid, or Brevo) via API.
> Do NOT build a custom newsletter system in v1.
> Store only subscriber emails + consent in DB.
> Admin: simple subscriber list + export CSV. Send via external tool.

```prisma
model Subscriber {
  id          Int
  email       String    @unique
  firstName   String?
  status      SubStatus // ACTIVE | UNSUBSCRIBED
  source      String?   // "checkout" | "popup" | "footer"
  createdAt   DateTime
  consentAt   DateTime  // GDPR
}
```

---

### Gift Certificates (`/admin/marketing/gift-certificates`)

**One real certificate:**
- Code: `GC-29DP-LSBY-JEEC`
- Від: Костючок Анатолій → Кому: Костючок Анатолій (self-test)
- Сума: 50 ₴ (min 50, max 1500 ₴)
- Статус: Active
- Доставка: Email (tolik.kostyuchok@gmail.com)
- Повідомлення: "Вітаю!"
- Безкоштовні товари section (empty)

**Certificate detail tabs:** Детальна інформація / Історія

**New gift certificates:**
```prisma
model GiftCertificate {
  id          Int
  code        String    @unique  // GC-XXXX-XXXX-XXXX
  fromName    String
  toName      String
  message     String?
  amount      Decimal             // 50–1500 UAH
  balance     Decimal             // remaining balance
  status      GiftCertStatus     // ACTIVE | USED | EXPIRED
  deliveryType DeliveryType       // EMAIL | POST
  email       String?
  expiresAt   DateTime?
  createdAt   DateTime
  usages      GiftCertUsage[]
}
```

---

### Banners (`/admin/marketing/banners`)

**Banner groups in reference:**
| Group | Count |
|-------|-------|
| Користуються попитом | 13 банерів |
| Пропозиції (головна сторінка) | 24 банери |
| Сезонні банери | 5 банерів |
| Банери в категоріях | 1 банер |
| Акції | 6 банерів |
| Головні банери | 8 банерів |
| Банери категорій | 8 банерів |

**Individual banners (not in groups):**
Banner (Macbook 2), Banner (Macbook), Bonus points, Discount if select pickup,
Final sale, Free shipping, Gift certificate, Gift certificates,
Holiday gift guide, Main Banner Fixed (Google Pixel 8),
Main Banner Fixed (Xbox S), X-Box

**Banner detail fields:**
- Назва, Групу банерів, Тип (АВ: UniTheme2: Розширений банер / Графічний банер)
- Перегляд банера button

**Налаштування блоку банера:**
- Схема кольорів: Темний фон / Світлий фон
- Вертикальне вирівнювання: По нижньому краю / По центру / По верхньому краю
- Горизонтальне вирівнювання: По центру / Зліва / Справа
- Внутрішній відступ: top/right/bottom/left (px or %)
- Контент на всю ширину ✓

**Налаштування заголовка банера:**
- Заголовок (HTML allowed: `Стелажі <i>для дому</i>`)
- Пресети: Над заголовком / Інший колір / Тонкий шрифт / Новий рядок
- Розмір шрифту: 28px, Колір, Насиченість, Тег (div/h1/h2/h3/p)
- Додати тінь від заголовку

**Налаштування опису:**
- Короткий опис (e.g. "Прості в експлуатації")
- Розмір шрифту: 16px, Колір, Фоновий колір

**Об'єкт всередині (Зображення, Відео, Товари):**
- Відображуваний об'єкт: Зображення / Відео / Товари
- Основне зображення (upload/URL)
- Положення об'єкта (9-point grid selector)

**Налаштування фону банера:**
- Тип фону: Фонове зображення / Колір
- Фонове зображення (upload/URL)
- Масштабування: Із збереженням пропорцій
- Позиція фону (9-point grid)

**"Користуються попитом" group contains 13 banners:**
банер 1–4 (generic), then named:
1. стелаж-верстак, 2. перфорована панель, 3. стелаж лофт,
4. сейф, 5. лофт полички, 6. тримач для садового інструменту,
7. стелаж Титан для коліс, 8. меблевий сейф, 9. торговий стелаж

**New banners admin (`/admin/marketing/banners`):**
- Banner groups (folders) + individual banners
- Each banner: title, description, background image, CTA button, link URL
- Groups used as carousels / grids on storefront
- Simple CMS-style editor (no drag-and-drop needed)
- Banner slots defined in code (`homepage_hero`, `category_popular`, `product_page`)

```prisma
model Banner {
  id          Int
  name        String
  groupId     Int?
  title       String?
  description String?
  image       String?       // background image URL
  objectImage String?       // foreground image URL
  buttonText  String?
  buttonUrl   String?
  colorScheme String        // "dark" | "light"
  position    Int
  status      BannerStatus
  group       BannerGroup?  @relation(...)
}

model BannerGroup {
  id       Int
  name     String
  slot     String    // "homepage_hero" | "category_popular" etc.
  banners  Banner[]
}
```

---

### Price Feeds / Прайс-листи (`/admin/marketing/price-feeds`)

**Current state:** Empty — "Дані не знайдено"
Used for Google Shopping, Prom.ua, Hotline.ua product feeds (XML/CSV).

**New price feed requirements (v2, not v1):**
- Generate XML feed for Google Merchant Center
- Generate YML feed for Prom.ua / Hotline.ua
- Cron job: regenerate every 6 hours
- `/feeds/google.xml` and `/feeds/prom.yml` public endpoints

---

### Marketing Summary for new project:

**Implement in v1:**
- Promotions (cart + catalog rules, free shipping)
- Gift certificates
- Banners (static, managed in admin)
- Subscriber collection (email + GDPR consent)

**Implement in v2:**
- Newsletter campaigns (via Brevo/Mailchimp API)
- Price feeds (Google Shopping, Prom.ua)
- Loyalty points system

**Skip entirely:**
- Product bundles marketing page (use product detail bundles instead)


---

## Website Section (Веб-сайт)

### Sub-sections:
- Теми / Themes
- Блог / Blog
- Сторінки / Pages
- Меню / Navigation menus
- Теги / Tags
- SEO
- Коментарі / Comments
- Карта сайту / Sitemap

---

### Сторінки / Pages (`/admin/website/pages`)

**Existing pages in reference (from CS-Cart):**

| Назва | Тип | Статус |
|-------|-----|--------|
| Доставка та оплата #22 | Сторінка | Увімк. |
| Звортній зв'язок #38 | Форма | Увімк. |
| Контакти #20 | Сторінка | Увімк. |
| Повернення товару #21 | Сторінка | Увімк. |
| Про компанію #2 | Сторінка | Увімк. |
| Умови угоди (Публічна оферта) #3 | Сторінка | Увімк. |
| Low Price Guarantee #6 | Сторінка | Вимк. |
| Reward points #23 | Сторінка | Вимк. |
| Подарункові сертифікати #19 | Сторінка | Вимк. |
| видалити #1 | Сторінка | Вимк. |

**Pages to implement in new project:**
- Доставка та оплата
- Повернення товару
- Про компанію
- Умови угоди (Публічна оферта)
- Контакти (+ контактна форма)

**Skip:** Low Price Guarantee, Reward points, Подарункові сертифікати (not used)

**Admin list page columns:**
- Позиція (drag-reorder)
- Назва + ID + тип (Сторінка / Форма)
- Статус badge (Увімк. / Вимк.)
- Actions: редагувати, видалити

**Admin list — search sidebar:**
- Знайти (text search)
- Тип (–– / Сторінка / Форма)
- Батьківська сторінка (– Всі сторінки –)

**New pages admin (`/admin/website/pages`):**
- Simple CMS: title, slug (auto from title), rich text body, meta title, meta description, status
- Page type: Сторінка / Форма (contact form builder — not needed in v1; use static contact page)
- Parent page support (for nested URL structure)

```prisma
model Page {
  id              Int
  parentId        Int?
  title           String
  slug            String          // e.g. "dostavka-ta-oplata"
  content         String          // Rich text HTML
  type            PageType        // PAGE | FORM
  metaTitle       String?
  metaDescription String?
  status          PageStatus      // ACTIVE | DISABLED
  position        Int
  parent          Page?           @relation("PageTree")
  children        Page[]          @relation("PageTree")
}
```

**Storefront URLs:** `/[slug]` — e.g. `/dostavka-ta-oplata`, `/pro-kompaniyu`

---

### Меню / Navigation Menus (`/admin/website/menus`)

**Existing menus in reference (active ones only):**

| Назва | Статус |
|-------|--------|
| Швидкі посилання | Увімк. |
| Головне меню | Увімк. |
| Бокове меню 2 | Увімк. |
| Горизонтальне меню з іконками | Увімк. |
| Швидка навігація - головна сторінка | Увімк. |
| Швидка навігація - СТЕЛАЖІ | Увімк. |
| Швидка навігація - МЕБЛІ | Увімк. |
| Швидка навігація - ДРАБИНИ | Увімк. |
| Швидка навігація - ТОРГОВІ стелажі | Увімк. |
| Швидка навігація - СЕЙФИ | Увімк. |

**Disabled (legacy CS-Cart menus — skip entirely):**
Main menu, Shop (footer), Create orders (footer), AB: Top menu 523,
AB: Main menu 837, AB: Top menu 837, AB: Main menu 044, AB: Top menu 044

**Menu slots in new project (hardcoded in layout):**

| Слот | Меню | Де використовується |
|------|------|---------------------|
| `header_main` | Головне меню | Desktop header nav |
| `header_quick` | Швидкі посилання | Top bar (desktop/tablet only) |
| `footer_shop` | Покупцям | Footer column |
| `footer_account` | Акаунт | Footer column |
| `mobile_bottom` | — | Hardcoded 5 items (not from DB) |
| `quick_nav_*` | Швидка навігація per category | Category sidebar |

**New menus admin (`/admin/website/menus`):**
- List: menu name, item count, slot assignment, status
- Menu editor: nested drag-and-drop tree of items
- Each item: label, URL (or category/page link), icon (optional), open in new tab toggle
- Depth: max 2 levels (mega-menu on desktop)

```prisma
model Menu {
  id     Int
  name   String
  slot   String?   // "header_main" | "footer_shop" | etc.
  status MenuStatus
  items  MenuItem[]
}

model MenuItem {
  id        Int
  menuId    Int
  parentId  Int?
  label     String
  url       String?
  pageId    Int?      // link to Page
  categoryId Int?     // link to Category
  icon      String?
  position  Int
  newTab    Boolean
  parent    MenuItem? @relation("MenuTree")
  children  MenuItem[] @relation("MenuTree")
}
```

---

### Теги / Tags (`/admin/website/tags`)

**Current state in reference:**
- Single active tag: `блог` — 0 товарів, 2 сторінки

**Tags admin columns:**
- Тег (name)
- Товари (product count)
- Сторінки (page count)
- Статус

**Search sidebar:**
- Тег (text search)
- Показати: Всі / Увімкнені / Вимкнені

**New tags implementation:**
- Tags are shared across products and blog posts
- Auto-suggest on product/post edit forms
- Tag cloud on storefront (optional)
- `/tag/[slug]` — aggregated page with all tagged products + posts

```prisma
model Tag {
  id       Int
  name     String       // e.g. "блог"
  slug     String
  status   TagStatus
  products Product[]
  posts    BlogPost[]
}
```

---

### SEO Rules (`/admin/website/seo`)

**Current SEO rules in reference (17 total):**

| dispatch | SEO name (slug) |
|----------|-----------------|
| auth.login_form | login |
| categories.ab__lc_catalog | categories-catalog |
| categories.catalog | catalog |
| checkout.cart | cart |
| checkout.checkout | checkout |
| checkout.customer_info | checkout-customer-info |
| checkout.summary | checkout-summary |
| gift_certificates.add | gift-certificates |
| gift_certificates.update | gift-certificates-update |
| orders.search | orders |
| product_features.compare | compare |
| profiles.add | profiles-add |
| profiles.update | profiles-update |
| promotions.list | promotions |
| rma.returns | returns |
| sitemap.view | sitemap |
| wishlist.view | wishlist |

**Actions:** 301 переадресація, robots.txt, Зберегти, + Додайте правило

**New project — URL mapping (Next.js routes):**

| Функція | URL |
|---------|-----|
| Login | `/login` |
| Catalog | `/catalog` |
| Cart | `/cart` |
| Checkout | `/checkout` |
| Gift certificates | `/gift-certificates` |
| Orders | `/orders` |
| Compare | `/compare` |
| Profile add | `/profiles-add` |
| Profile update | `/profiles-update` |
| Promotions | `/promotions` |
| Returns | `/returns` |
| Sitemap | `/sitemap` |
| Wishlist | `/wishlist` |

**SEO admin (`/admin/website/seo`):**
- 301 redirects manager: old URL → new URL, table with search + export
- robots.txt editor (plain text, save button)
- No "dispatch" concept needed — Next.js uses file-based routing

**robots.txt (initial):**
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://skladcom.ua/sitemap.xml
```

---

### Коментарі / Comments (`/admin/website/comments`)

**Not actively used in reference** — no comment management data observed.

**Implement in v1 (minimal):**
- Product reviews (відгуки) have their own section: `/admin/products/reviews`
- Blog comments: basic approve/delete, no nested threads
- Comments require moderation before appearing on storefront

**Skip:** separate Comments section in website admin — merge into relevant sections
(product reviews → `/admin/products/reviews`, blog comments → `/admin/website/blog`)

---

### Карта сайту / Sitemap (`/admin/website/sitemap`)

**Current state in reference:**
- Single item: "Обліковий запис" — Вимк.
- CS-Cart generates XML sitemap from this config

**New sitemap implementation:**

Auto-generated XML sitemap via Next.js route `/sitemap.xml`:

```ts
// app/sitemap.ts — auto-generated, no admin UI needed
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await db.product.findMany({ where: { status: 'ACTIVE' } })
  const categories = await db.category.findMany({ where: { status: 'ACTIVE' } })
  const pages = await db.page.findMany({ where: { status: 'ACTIVE' } })
  const posts = await db.blogPost.findMany({ where: { published: true } })

  return [
    { url: 'https://skladcom.ua/', changeFrequency: 'daily', priority: 1 },
    ...categories.map(c => ({ url: `/catalog/${c.slug}`, changeFrequency: 'weekly', priority: 0.8 })),
    ...products.map(p => ({ url: `/products/${p.slug}`, changeFrequency: 'weekly', priority: 0.7 })),
    ...pages.map(p => ({ url: `/${p.slug}`, changeFrequency: 'monthly', priority: 0.5 })),
    ...posts.map(p => ({ url: `/blog/${p.slug}`, changeFrequency: 'monthly', priority: 0.5 })),
  ]
}
```

**Admin sitemap page (`/admin/website/sitemap`):**
- Read-only preview of what will be in sitemap.xml
- "Оновити кеш карти сайту" button (revalidates Next.js cache)
- Link to `/sitemap.xml` for manual check

**No manual section management needed** — sitemap is fully auto-generated from active content.

---

### Themes (Теми)

**Active theme:** AB: UniTheme2 — `skaldcom-colour-style` (Light layout)
- Developer: Alexbranding
- 6 layouts (макети), 27 styles
- Directory: `/abt__unitheme2`

**Installed themes:** UniTheme2 (Active ✓), Responsive theme, Bright theme
**UniTheme2 has 27 color styles:** Black, Blue, Brick, Cobalt, Dark_Blue,
Dark_Navy, Default, Fiolent, Flame, Gray, Green, Indigo, Ink,
Lime_dark, Malachite, Malachite_dark, skaldcom-colour-style (custom), etc.

> In new project: theme = Next.js + Tailwind. No CS-Cart theme engine needed.
> All settings below are UX decisions to replicate, not technical configs.

---

### Key UX Settings from UniTheme2 (replicate in Next.js)

**Global:**
- Lazy load images: ☐ disabled (preload first images for PageSpeed)
- Sticky top header: ✓ desktop + tablet, ✗ mobile
- Mobile bottom navigation bar: ✓ enabled (max 6 items)
  Items: Головне меню, Пошук товарів, Міні кошик, Акаунт, Контакти
- "Scroll to top" button: ✓ all devices
- Price format: decimal superscript (e.g. 6 114⁰⁰)
- Variation hover: swap main image on color swatch hover (desktop only)

**Category page:**
- Fixed panel with "Категорії" + "Фільтри" buttons: ✓ all devices
- Category description position: below product grid
- Subcategories shown in category: ✗ (flat listing)

**Product list (Grid view) — card dimensions:**
- Desktop: 275×275px image, 3 lines for title
- Tablet: 240×240px image, 2 lines for title
- Mobile: 240×240px image, 2 lines for title
- Show SKU on desktop: ✓, tablet: ✗, mobile: ✗
- Show stock status: ✓ all devices
- Show qty modifier: ✓ desktop+tablet, ✗ mobile
- "Buy" button: cart icon only (all devices)
- Extra info on hover: characteristics list (desktop only)
- "You save" badge: short view desktop+tablet, hidden mobile
- Max features shown in list: 3 (all devices)
- Wishlist button: ✓ all, Compare button: ✓ desktop only
- Image gallery nav: dots (all devices)
- Image switch on mousemove: 3 strips (desktop), disabled (tablet/mobile)

**Product list (Compact list) — card dimensions:**
- 100×100px image all devices (85px mobile)
- 2 columns on mobile: ✓
- "Buy" button: cart icon only

**Product list (Small items "Дрібні елементи"):**
- 2 lines for title, no SKU, no stock, no qty modifier
- "Buy" button: cart icon only

**Product detail page:**
- Main image: 570×570px desktop, 430×430px tablet+mobile
- Show qty modifier: ✓ all
- Show SKU: ✓ all
- Show features: ✓ all, in 2 columns: ✓ all
- Short description: ✗ hidden (not used)
- "You save": full view desktop, short view tablet+mobile
- "Similar products in category" search: ✓ all
- Grey out out-of-stock variations: ✓ all
- Brand logo → links to main category

**Reviews:**
- Sort by creation date: ✓ all
- Highlight verified buyer reviews: ✓

**"Show more" / Infinite scroll:**
- Product lists: ✓ enabled
- Blog: ✓ enabled
- Pagination mode: button click (desktop), auto-scroll (tablet+mobile)
- Show loading count: ✓ all

**Module settings:**
- Wishlist: 6 per row desktop, 4 tablet, 2 mobile
- Reviews: highlight verified buyers ✓, highlight admin ✗
- Landing categories: 4 columns, 250×250px icons
- AB: Preload (first images): use `<link rel="preload">` for first visible images

---

### Storefront Product Card — final spec for Next.js:

```tsx
// ProductCard component behavior:
// Desktop (≥1024px):
//   - 275×275 image, dots navigation, 3-strip mousemove switch
//   - Show: SKU, stock, qty +/-, cart icon button, wishlist, compare
//   - Hover: show 3 characteristics below title
//   - "You save X ₴" badge (short)
// Tablet (768–1023px):
//   - 240×240 image, dots navigation
//   - Show: stock, qty +/-, cart icon, wishlist
//   - No SKU, no compare, no hover effects
// Mobile (<768px):
//   - 240×240 image, dots navigation
//   - Show: stock, cart icon, wishlist
//   - No SKU, no qty modifier, no compare
//   - "You save" hidden
```

---

### Mobile Bottom Navigation Bar:

```tsx
// MobileBottomNav — shown only on mobile (<768px)
// Max 6 items, labels visible
// Items (left to right):
// 1. Головне меню (hamburger)
// 2. Пошук товарів (search)
// 3. Міні кошик (cart with badge)
// 4. Акаунт (user)
// 5. Контакти (phone/map)
```

---

## Modules Section (Модулі)

> CS-Cart modules = third-party plugins installed on the reference store.
> In the new Next.js project there are **no CS-Cart modules** — all functionality
> is built natively. This section documents what each module does so we know
> what to implement and what to skip.

### Sub-sections in CS-Cart:
- Завантажені доповнення (installed)
- Модернізації (upgrade center)
- Розробники (filter by vendor)
- Ринок доповнень (marketplace)

---

### Завантажені доповнення / Installed Modules (131 total)

Total breakdown by developer:
- **CS-Cart** — 94 built-in modules
- **AlexBranding** — 32 premium modules
- **Searchanise** — 1 module
- **WayForPay** — 1 module

---

#### AlexBranding Modules (active / relevant)

| Модуль | Версія | Що робить | Статус в новому проекті |
|--------|--------|-----------|------------------------|
| AB: UniTheme2 | 4.19.1.b | Тема + шаблон | **Не потрібен** (Next.js + Tailwind) |
| AB: Менеджер модулів | 2.5.9 | Управління AB-модулями | **Не потрібен** |
| AB: Міста України | 2.4.2 | Довідник міст для форм | **Реалізувати нативно** (Nova Poshta API повертає міста) |
| AB: Нова Пошта PRO | 4.4.1 | Інтеграція НП: ТТН, відстеження, відділення | **Реалізувати нативно** — окремий сервіс `lib/nova-poshta.ts` |
| AB: Посадкові категорії/сторінки | 1.10.0 | Landing-сторінки для категорій | **Реалізувати нативно** — поле `isLanding` на категорії |
| AB: ПРРО Checkbox інтеграція | 1.3.0 | Фіскальні чеки через Checkbox | **Реалізувати нативно** — сервіс `lib/checkbox.ts` |
| AB: Стікери | 3.0.2 | Стікери на картках товарів (Новинка, Акція, тощо) | **Реалізувати нативно** — модель `ProductSticker` |
| AB: Укрпошта | 1.5.1 | Інтеграція Укрпошти | **v2** — низький пріоритет |
| AB: Швидка навігація | 1.11.0 | Швидка навігація по сторінках магазину | **Реалізувати нативно** — компонент `QuickNav` |
| AB: Вивантаження товарів для прайс-агрегаторів | 1.6.3 | XML/YML фіди для Prom.ua, Hotline | **v2** — price feeds |
| AB: Купити в кредит для України | — | Кнопка розстрочки Приват24/LiqPay | **Реалізувати нативно** — компонент `CreditButton` |
| AB: Відео галерея товару | — | YouTube/Vimeo в галереї товару | **Реалізувати нативно** — модель `ProductVideo` |
| AB: Користувацький H1 PRO | — | Окреме поле customH1 | **Вбудовано** в форму товару/категорії |
| AB: Стікери | — | Стікери на товарах | **Реалізувати нативно** |
| AB: Розширені промо-акції | — | Промо-блок в каталозі | **Реалізувати нативно** |

#### AlexBranding Packages (підписки — всі прострочені з 16.01.2026):
- UniTheme2 — адаптивний шаблон
- Пакет модулів SEO для CS-Cart
- Пакет Speed-Up
- Пакет Динамічного ремаркетингу (Google, Facebook, Instagram)
- Пакет модулів CS-Cart Україна (повний пакет інтеграцій)

> Всі AB-підписки прострочені. Новий проект не залежить від AB-модулів —
> функціонал реалізується нативно в Next.js.

---

#### WayForPay Module

| Модуль | Версія | Статус |
|--------|--------|--------|
| Платіжний модуль WayForPay | 1.0 | ✅ Увімк. (встановлено 11.05.2026) |

> WayForPay — активний платіжний шлюз у reference-проекті.
> В новому проекті: реалізувати через WayForPay API нативно.
> Документація: https://wiki.wayforpay.com/

**Платіжні методи в новому проекті (пріоритет реалізації):**
1. **LiqPay** — v1 (основний)
2. **Monobank** — v1
3. **WayForPay** — v1 (активний в reference)
4. **Накладений платіж (Після оплата НП)** — v1 (cash on delivery)
5. **Приват24 розстрочка** — v1 (через LiqPay)
6. **Укрпошта** — v2

---

#### Searchanise Module

| Модуль | Розробник | Статус |
|--------|-----------|--------|
| Search Autocomplete and Suggest Widget | Searchanise | Безкоштовно |

> Searchanise — хмарний пошук з автодоповненням для CS-Cart.
> В новому проекті: реалізувати нативний пошук через PostgreSQL full-text search
> (Ukrainian dictionary) + autocomplete API endpoint `/api/search?q=`.
> Якщо нативний пошук недостатній — розглянути Algolia або Meilisearch (v2).

---

#### CS-Cart Built-in Modules (94) — relevant ones for new project

З 94 вбудованих модулів CS-Cart, зберігаємо логіку наступних:

| CS-Cart модуль | Що реалізувати в новому проекті |
|----------------|--------------------------------|
| Зворотній дзвінок | Кнопка "Купити зараз одним кліком" + "Запит на дзвінок" → компонент `CallbackButton` |
| Gift certificates | Подарункові сертифікати (v1) — модель `GiftCertificate` |
| Promotions | Промо-акції (v1) — модель `Promotion` |
| Wishlist | Список бажань (v1) — localStorage або БД якщо залогінений |
| Product comparison | Порівняння товарів (v1) — max 4 товари, localStorage |
| Reviews and comments | Відгуки на товари (v1) — модель `Review` з модерацією |
| RMA (Returns) | Повернення товарів — форма `/returns`, модель `ReturnRequest` |
| Tags | Теги (v1) — вбудовано в модель `Tag` |
| SEO | SEO-правила (v1) — Next.js `generateMetadata()` + `sitemap.ts` |
| Subscribers | Збір email-підписників (v1) — модель `Subscriber` |
| Blog | Блог (v1) — модель `BlogPost` |

**Пропустити повністю (не потрібні):**
- ATOL Online (Russian fiscal — not applicable)
- CDEK (Russian shipping)
- CommerceML / 1C sync
- Consent for personal data processing (Russian Federal Law 152)
- Delovye Linii shipping
- Divido платежі
- Email маркетинг (CS-Cart built-in — use Brevo/Mailchimp in v2)
- Multi-store / storefronts
- Reward points (not used)
- Low Price Guarantee page

---

### Модернізації / Upgrade Center

**Current state:**
- CS-Cart v4.19.1.SP1 installed
- Available upgrade: v4.19.1.SP1 → v4.19.1.SP2 (13,099 KB, Dec 30, 2025)
- Latest available: v4.20.1 (released 3 months ago)

> Irrelevant for new project — we are not upgrading CS-Cart.
> Documented for reference only.

---

### Ринок доповнень / Add-on Marketplace

Items visible in marketplace (purchased/considered):

| Назва | Розробник | Ціна | Рішення в новому проекті |
|-------|-----------|------|--------------------------|
| UniTheme2 | AlexBranding | $249 | Next.js + Tailwind (власна тема) |
| One Step Checkout | Cart Rocks | $119 | Нативний одно-сторінковий checkout |
| Live Search | Cart-Power | $45 | PostgreSQL FTS або Meilisearch |
| Live search and Search history | CS-Commerce | $120 | PostgreSQL FTS (v1) |
| Advanced price calculation | CS-Commerce | $180 | Нативна логіка ціни + знижок |
| Search Autocomplete (Searchanise) | Searchanise | безкоштовно | PostgreSQL FTS autocomplete |

> Жоден з цих marketplace-модулів не переноситься в новий проект.
> Весь функціонал реалізується нативно в Next.js.

---

### Modules Summary — що реалізувати в новому проекті

**v1 (must have):**
- Nova Poshta API (ТТН, відстеження, відділення, міста) — `lib/nova-poshta.ts`
- Checkbox ПРРО (фіскальні чеки) — `lib/checkbox.ts`
- WayForPay payment — `lib/wayforpay.ts`
- LiqPay payment — `lib/liqpay.ts`
- Monobank payment — `lib/monobank.ts`
- Стікери на товарах — модель `ProductSticker`, компонент `ProductBadge`
- Зворотній дзвінок / Quick order — компонент `CallbackModal`
- Пошук з автодоповненням — `/api/search`, PostgreSQL FTS
- Wishlist — localStorage (гість) + DB (залогінений)
- Порівняння товарів — localStorage, max 4

**v2 (nice to have):**
- WayForPay — додатковий шлюз (LiqPay та Mono в пріоритеті)
- Укрпошта API
- Price feeds (Prom.ua YML, Google Shopping XML)
- Email-кампанії через Brevo/Mailchimp
- Розширений пошук (Meilisearch/Algolia якщо PostgreSQL FTS недостатній)
- Динамічний ремаркетинг (Google Ads, Meta Pixel)

---

<!-- CLAUDE.md — повний документ. Останнє оновлення: 2026-05-28. -->
<!-- Розділи: Stack · Repo · DB · URLs · Admin UX · Business Logic · -->
<!-- Products (tabs/model/features/variations/SEO/wholesale/bundles/video/credit) · -->
<!-- Storefront Layout · Categories · Features · Import · Filters · Options · -->
<!-- Reviews · Users · Marketing · Website · Modules -->


