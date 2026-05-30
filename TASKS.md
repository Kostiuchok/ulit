# TASKS — ecommerce-ua

> Живий документ. Оновлюй статус після кожної сесії.
> На початку сесії скажи Claude Code: **"Читай CLAUDE.md і TASKS.md. Продовжуємо."**

---

## Поточний статус

**Активна фаза:** Фаза 1 — Основа  
**Останнє зроблено:** —  
**Наступний крок:** Ініціалізація проекту  

---

## Фаза 1 — Основа проекту

> Мета: працюючий скелет з БД, авторизацією і порожнім адмін-лейаутом.
> Нічого не можна будувати далі без цього.

### 1.1 Ініціалізація
- [ ] `npx create-next-app@latest` — App Router, TypeScript, Tailwind
- [ ] Встановити shadcn/ui (`npx shadcn@latest init`)
- [ ] Встановити Prisma + PostgreSQL (`prisma init`)
- [ ] Встановити Redis клієнт (`ioredis`)
- [ ] Налаштувати `.env` (DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET)
- [ ] Базовий `docker-compose.yml` — postgres + redis для локальної розробки
- [ ] ESLint + Prettier конфіг
- [ ] Структура папок: `/app`, `/components`, `/lib`, `/prisma`, `/types`

### 1.2 Prisma Schema — повна
- [ ] Enum-и: `ProductStatus`, `OrderStatus`, `CategoryStatus`, `UserRole`, `PageStatus`, `TagStatus`, `BannerStatus`, `OutOfStockAction`, `PaymentMethod`, `ShipmentStatus`
- [ ] `User` — id, email, phone, name, role, passwordHash, createdAt
- [ ] `Category` — id, parentId, name, slug, description, metaTitle, metaDescription, customH1, image, icon, status, position, defaultView
- [ ] `Product` — повна модель з CLAUDE.md (sku, name, slug, price, listPrice, qty, status, description, shortDescription, metaTitle, metaDescription, customH1, warrantyMonths, returnDays, trackInventory, outOfStockAction, noBoxShipping, checkboxName, uktZed)
- [ ] `ProductImage` — productId, url, position, alt
- [ ] `ProductVideo` — productId, type, videoId, position
- [ ] `ProductFeature` — id, name, displayName, purpose, valueType, filterType, prefix, suffix, position, status, showOnCard, showInList, useForShortDesc
- [ ] `ProductFeatureVariant` — featureId, value, position
- [ ] `ProductFeatureValue` — productId, featureId, variantId, customValue
- [ ] `ProductVariationGroup` — id, products[]
- [ ] `ProductPrice` — productId, minQty, price, userGroupId (wholesale tiers)
- [ ] `ProductBundle` + `ProductBundleItem`
- [ ] `ProductCreditSettings` — productId, privat24Enabled, minMonths, maxMonths
- [ ] `ProductSticker` — productId, label, color, position
- [ ] `Order` — id, userId, status, paymentMethod, total, tthNumber, npBranch, notes, adminNotes, createdAt
- [ ] `OrderItem` — orderId, productId, name, sku, qty, price
- [ ] `Shipment` — orderId, tthNumber, status, sentAt, deliveredAt
- [ ] `Review` — productId, userId, rating, text, status, verifiedBuyer, createdAt
- [ ] `Tag` — id, name, slug, status; зв'язки з Product і BlogPost
- [ ] `Page` — id, parentId, title, slug, content, type, metaTitle, metaDescription, status, position
- [ ] `Menu` + `MenuItem`
- [ ] `BlogPost` — id, title, slug, content, excerpt, image, metaTitle, metaDescription, published, publishedAt, tags[]
- [ ] `Banner` + `BannerGroup`
- [ ] `Promotion` — базова модель (id, name, type, conditions, bonuses, status, dateFrom, dateTo)
- [ ] `GiftCertificate` — id, code, amount, balance, status, expiresAt
- [ ] `Subscriber` — id, email, gdprConsent, createdAt
- [ ] `ReturnRequest` — orderId, reason, status, createdAt
- [ ] `SeoRedirect` — fromUrl, toUrl, code (301/302)
- [ ] `prisma db push` — перевірити що schema валідна

### 1.3 Auth
- [ ] `lib/turbosms.ts` — клієнт TurboSMS API (Bearer token з env)
- [ ] `POST /api/auth/send-otp` — генерація 4-значного коду, збереження в Redis (TTL 300s, rate limit 3 спроби/10 хв)
- [ ] `POST /api/auth/verify-otp` — перевірка коду, створення JWT (httpOnly cookie)
- [ ] При першому вході — автоматична реєстрація User з phone
- [ ] `POST /api/auth/logout` — видалення cookie
- [ ] Сторінка `/login` — поле номера телефону → поле OTP-коду (2 кроки)
- [ ] Email + password auth для адмін-панелі (окремий endpoint `POST /api/auth/admin/login`)
- [ ] `middleware.ts` — захист `/admin/*` (роль ADMIN | MANAGER з JWT)
- [ ] Seed: перший адмін-юзер (`admin@skladcom.ua` + пароль з env)

### 1.4 Admin Layout
- [ ] `/app/admin/layout.tsx` — sidebar + topbar
- [ ] `AdminSidebar` — навігація по розділах (Головна, Замовлення, Товари, Користувачі, Маркетинг, Веб-сайт, Модулі, Налаштування)
- [ ] `AdminTopBar` — назва розділу + аватар + вихід
- [ ] Активний пункт меню підсвічується
- [ ] Sidebar: collapsed на мобільному, drawer по кліку
- [ ] Breadcrumbs компонент (використовується на всіх сторінках)
- [ ] `/admin` → redirect на `/admin/dashboard`

---

## Фаза 2 — Admin: Каталог

> Мета: повне управління товарами і категоріями через адмінку.
> Потрібна Фаза 1.

### 2.1 Категорії
- [ ] `/admin/products/categories` — дерево-таблиця (drag-reorder, expand/collapse)
- [ ] Колонки: позиція, назва (відступ рівня), кількість товарів, статус, дії
- [ ] Sidebar: зведення (всього / активних / прихованих)
- [ ] Дії в рядку: додати підкатегорію, редагувати, видалити (з попередженням)
- [ ] `/admin/products/categories/new` — форма нової категорії
- [ ] `/admin/products/categories/[id]` — редагування (3 секції: Основне, SEO, Відображення)
- [ ] Секція Основне: батьківська категорія (tree-select), назва, slug (авто), статус, зображення, іконка, опис (rich text)
- [ ] Секція SEO: meta title, meta description, customH1, canonical
- [ ] Секція Відображення: вид за замовч. (сітка/список/компакт per device), товарів на сторінці, сортування за замовч.
- [ ] API: `GET/POST /api/admin/categories`, `GET/PUT/DELETE /api/admin/categories/[id]`

### 2.2 Характеристики
- [ ] `/admin/products/features` — таблиця (назва, тип, категорії, статус)
- [ ] Фільтр по категорії + пошук по назві
- [ ] Кнопки: Імпорт CSV, Експорт CSV, Групи, + Нова характеристика
- [ ] Форма характеристики (modal або окрема сторінка) — 3 таби: Загальне, Варіанти, Категорії
- [ ] Таб Загальне: назва, назва на сайті, призначення, тип значення, тип фільтра, префікс/суфікс, позиція, статус, чекбокси відображення
- [ ] Таб Варіанти: drag-reorder список значень, + додати варіант (тільки для Select/Checkbox)
- [ ] Таб Категорії: мульти-вибір категорій з дерева
- [ ] `/admin/products/features/groups` — CRUD груп характеристик
- [ ] API: `GET/POST /api/admin/features`, `GET/PUT/DELETE /api/admin/features/[id]`

### 2.3 Фільтри
- [ ] `/admin/products/filters` — таблиця фільтрів (назва, характеристика, тип, категорії, статус)
- [ ] Форма фільтра: назва, характеристика (select з features), тип (checkbox/range/select), позиція, статус
- [ ] Прив'язка фільтра до категорій
- [ ] API: `GET/POST /api/admin/filters`, `GET/PUT/DELETE /api/admin/filters/[id]`

### 2.4 Товари — список
- [ ] `/admin/products` — таблиця з пагінацією (server-side)
- [ ] Колонки: thumbnail, назва + SKU, категорія, ціна, залишок (кольоровий індикатор), статус
- [ ] Filter bar: пошук (завжди видимий), таби (Всі/Активні/Вимкнені/Немає в наявності), фільтри (категорія, ціна, залишок), сортування
- [ ] Bulk actions (при виборі чекбоксів): увімкнути/вимкнути, змінити категорію, змінити ціну, експортувати CSV, видалити
- [ ] API: `GET /api/admin/products` з query params (page, limit, search, status, categoryId, sort)

### 2.5 Товари — форма
- [ ] `/admin/products/new` і `/admin/products/[id]` — одна форма, 3 таби
- [ ] **Таб 1 — Основне:** назва, категорія (searchable), ціна, рекомендована ціна, SKU, статус (radio), зображення (drag&drop multi, reorderable), повний опис (rich text), короткий опис
- [ ] **Таб 2 — Склад та доставка:** кількість, відстежувати запаси (toggle), дія при 0 залишку, повернення (toggle + дні), НП без коробки (toggle), Checkbox ПРРО (назва в чеку + УКТЗЕД)
- [ ] **Таб 3 — SEO та маркетинг:** meta title, meta description, customH1, теги, пошукові слова, таблиця гуртових знижок
- [ ] Блок характеристик (під табами): відображає характеристики для категорії товару, з полями вводу
- [ ] Блок варіацій: таблиця варіацій (thumbnail, SKU, колір, ціна, qty) + кнопка додати варіацію
- [ ] Блок стікерів: список активних стікерів (Новинка, Акція, Хіт тощо)
- [ ] Блок відео: додати YouTube/Vimeo URL
- [ ] Блок комплектів: прив'язати bundle
- [ ] Блок кредиту: увімкнути розстрочку + міс. мін/макс
- [ ] Авто-генерація slug з назви (транслітерація)
- [ ] API: `POST /api/admin/products`, `GET/PUT/DELETE /api/admin/products/[id]`

### 2.6 Import/Export
- [ ] `/admin/import` — вибір типу (товари / характеристики / категорії), upload CSV
- [ ] Парсинг CSV (papaparse), preview перших 5 рядків, підтвердження
- [ ] Імпорт товарів: назва, SKU, ціна, категорія, qty, статус, опис
- [ ] Імпорт характеристик: назва, тип, категорії, варіанти (формат з CLAUDE.md)
- [ ] Експорт товарів в CSV з поточними фільтрами
- [ ] API: `POST /api/admin/import/products`, `POST /api/admin/import/features`

---

## Фаза 3 — Admin: Замовлення

> Мета: повний цикл обробки замовлення — від нового до виконаного.
> Потрібні Фази 1–2.

### 3.1 Список замовлень
- [ ] `/admin/orders` — таблиця
- [ ] Колонки: ID, покупець (ім'я + телефон), дата (відносна), к-сть товарів, сума, статус badge, дії (переглянути, друк)
- [ ] Filter bar: пошук (ім'я/телефон/ID), таби статусів (Всі/Нові/Виконані/Скасовані/Повернення), date range picker
- [ ] Bulk actions: змінити статус, експортувати вибрані
- [ ] API: `GET /api/admin/orders`

### 3.2 Деталь замовлення
- [ ] `/admin/orders/[id]` — двоколонковий лейаут
- [ ] **Ліво:** список товарів (thumbnail + назва + SKU + qty + ціна), нотатки покупця (read-only), нотатки адміна (editable + зберегти), таймлайн статусів
- [ ] **Правий sidebar:** картка статусу (великий badge + кнопки дій), картка покупця (ім'я, телефон-посилання, email), картка оплати (метод, сума, badge), картка Нова Пошта (ТТН + copy, трекінг-посилання, адреса відділення, "Створити ЕН"), картка Checkbox (тільки якщо не накладений платіж)
- [ ] Кнопки зміни статусу: Підтвердити / Відправити / Виконано / Скасувати (не dropdown)
- [ ] Gear menu: Зберегти нотатки, Роздрукувати рахунок, Роздрукувати пакувальний лист, Надіслати рахунок покупцю, Дублювати замовлення; окремо деструктивні: Скасувати, Видалити (з введенням ID), Запросити повернення
- [ ] API: `GET/PUT /api/admin/orders/[id]`

### 3.3 Print view
- [ ] `/admin/orders/[id]/print` — чиста сторінка без адмін-лейауту
- [ ] Інформація про замовлення + список товарів + штрихкод + НП-мітка
- [ ] CSS `@media print` — правильна розбивка на сторінки

### 3.4 Відвантаження
- [ ] `/admin/shipments` — таблиця (№, замовлення, покупець, ТТН, дата створення, дата відправки, статус)
- [ ] Статуси синхронізуються з НП API (cron кожні 2 год)
- [ ] Bulk action: "Оновити всі статуси"
- [ ] Копіювати ТТН кнопка в кожному рядку
- [ ] Фільтр по статусу
- [ ] API: `GET /api/admin/shipments`, `POST /api/admin/shipments/sync`

---

## Фаза 4 — Інтеграції

> Мета: Nova Poshta, платежі, Checkbox. Потрібна Фаза 3.

### 4.1 Nova Poshta
- [ ] `lib/nova-poshta.ts` — клієнт НП API (API key з env)
- [ ] Методи: `getCities(query)`, `getWarehouses(cityRef, query)`, `createTTH(order)`, `trackShipment(tthNumber)`
- [ ] `GET /api/nova-poshta/cities?q=` — для autocomplete в checkout
- [ ] `GET /api/nova-poshta/warehouses?cityRef=&q=` — для вибору відділення
- [ ] `POST /api/admin/shipments/create-tth` — створення ЕН з деталі замовлення
- [ ] Cron job (або route handler): `POST /api/cron/sync-shipments` — оновлення статусів TTH
- [ ] Зберігати в `Shipment`: статус НП, дата прибуття у відділення

### 4.2 Платежі
- [ ] `lib/liqpay.ts` — підпис, форма оплати, вебхук верифікація
- [ ] `lib/monobank.ts` — створення invoice, вебхук
- [ ] `lib/wayforpay.ts` — підпис, форма оплати, вебхук верифікація
- [ ] `POST /api/payments/liqpay/checkout` — генерація форми
- [ ] `POST /api/payments/liqpay/webhook` — підтвердження оплати
- [ ] `POST /api/payments/monobank/checkout`
- [ ] `POST /api/payments/monobank/webhook`
- [ ] `POST /api/payments/wayforpay/checkout`
- [ ] `POST /api/payments/wayforpay/webhook`
- [ ] При успішній оплаті: оновити `Order.status` → PAID, створити `Shipment`
- [ ] Накладений платіж (НП Післяплата): без онлайн-оплати, просто зберегти метод

### 4.3 Checkbox ПРРО
- [ ] `lib/checkbox.ts` — авторизація касира, створення чека, отримання статусу
- [ ] `POST /api/admin/fiscal/receipt` — відправити чек (викликається з деталі замовлення)
- [ ] Зберігати `receipt_id` і статус у `Order`
- [ ] Показувати тільки якщо `paymentMethod !== CASH_ON_DELIVERY`

---

## Фаза 5 — Storefront: Каталог

> Мета: публічна частина сайту — каталог, картка товару, пошук.
> Потрібні Фази 1–4.

### 5.1 Layout і глобальні компоненти
- [ ] `/app/(storefront)/layout.tsx` — Header + Footer
- [ ] `Header/TopBar.tsx` — локація, швидкі посилання (desktop/tablet тільки)
- [ ] `Header/Navigation.tsx` — логотип, каталог-меню, пошук, акаунт, кошик
- [ ] `Header/MobileMenu.tsx` — drawer по hamburger
- [ ] `MobileBottomNav.tsx` — 5 іконок (Меню, Пошук, Кошик, Акаунт, Контакти), тільки mobile
- [ ] `Footer/FooterLinks.tsx`, `Footer/FooterPayments.tsx`, `Footer/FooterCopy.tsx`
- [ ] "Scroll to top" кнопка
- [ ] Sticky header: desktop + tablet, не mobile
- [ ] Tailwind responsive: `hidden md:block` замість JS viewport check

### 5.2 Каталог / Категорія
- [ ] `/catalog/[...slug]/page.tsx` — SSR, generateMetadata()
- [ ] Sidebar фільтрів: характеристики категорії (checkbox/range), ціна, наявність
- [ ] Fixed panel "Категорії" + "Фільтри" на всіх девайсах
- [ ] ProductCard компонент — поведінка з CLAUDE.md (desktop/tablet/mobile spec)
- [ ] Grid view (default), List view, Compact list
- [ ] Сортування: популярність/ціна/назва/новинки
- [ ] "Показати більше" — button click (desktop), auto-scroll (tablet/mobile)
- [ ] Лічильник завантажених товарів
- [ ] Опис категорії — нижче сітки товарів
- [ ] Хлібні крихти
- [ ] API: `GET /api/catalog/[slug]?filters=&sort=&page=`

### 5.3 Картка товару
- [ ] `/products/[slug]/page.tsx` — SSR, generateMetadata(), JSON-LD Product schema
- [ ] `ProductGallery.tsx` — зображення (570px desktop, 430px tablet/mobile) + відео
- [ ] `ProductInfo.tsx` — назва, ціна, варіації (color swatches), "You save" badge
- [ ] `ProductActions.tsx` — qty modifier, "Купити" кнопка, "Купити зараз", wishlist, compare, кнопка кредиту
- [ ] `ProductFeatures.tsx` — таблиця характеристик, 2 колонки
- [ ] `ProductDescription.tsx` — повний опис
- [ ] `ProductReviews.tsx` — рейтинг, список відгуків, форма нового відгуку
- [ ] `ProductVideos.tsx` — YouTube/Vimeo nocookie embed
- [ ] `RelatedProducts.tsx` — "Можливо, це зацікавить вас"
- [ ] `RecentlyViewed.tsx` — localStorage, client-only
- [ ] `ProductBenefits.tsx` — переваги (static block)
- [ ] `ProductBundles.tsx` — "Комплекти з цим товаром"
- [ ] Tabs (anchor-scroll): Опис / Характеристики / Відгуки / Відео / Схожі
- [ ] Сірити out-of-stock варіації
- [ ] Breadcrumbs

### 5.4 Пошук
- [ ] `GET /api/search?q=` — PostgreSQL full-text search (Ukrainian dictionary), повертає товари + категорії
- [ ] `GET /api/search/suggest?q=` — autocomplete, топ 5 результатів
- [ ] Search input в header — debounce 300ms, dropdown з підказками
- [ ] `/search?q=` — повна сторінка результатів з фільтрами

### 5.5 Кошик
- [ ] `useCart` hook — Zustand або Context, persist у localStorage
- [ ] `CartDrawer.tsx` — слайд з правого боку (shadcn Sheet)
- [ ] Список товарів: thumbnail, назва, qty modifier, ціна, видалити
- [ ] Підсумок: сума, кнопка "Оформити замовлення"
- [ ] Синхронізація кошика з БД (якщо залогінений — `Cart` модель)
- [ ] Abandoned cart: зберігати `Cart` якщо email відомий

---

## Фаза 6 — Storefront: Checkout і Акаунт

> Потрібна Фаза 5.

### 6.1 Checkout
- [ ] `/checkout` — одно-сторінковий, 3 кроки (або accordion)
- [ ] Крок 1 — Контакти: ім'я, телефон, email
- [ ] Крок 2 — Доставка: вибір методу (НП відділення / НП кур'єр / Самовивіз), autocomplete місто, autocomplete відділення
- [ ] Крок 3 — Оплата: LiqPay / Monobank / WayForPay / Накладений платіж; для НП — умови розстрочки (якщо товар підтримує)
- [ ] Підсумок замовлення (sticky sidebar desktop)
- [ ] Валідація форм (react-hook-form + zod)
- [ ] `POST /api/checkout` — створити Order, ініціювати платіж
- [ ] `/checkout/success?orderId=` — сторінка успіху з номером замовлення
- [ ] Відправити email підтвердження покупцю (nodemailer або Resend)

### 6.2 Акаунт покупця
- [ ] `/account` — особистий кабінет (тільки залогінені)
- [ ] `/account/orders` — список замовлень з статусами
- [ ] `/account/orders/[id]` — деталь замовлення (read-only версія)
- [ ] `/account/profile` — редагування контактних даних
- [ ] `/account/wishlist` — список бажань
- [ ] `/login`, `/register` — форми авторизації/реєстрації
- [ ] `/account/returns` — форма повернення товару
- [ ] API: `GET/PUT /api/account/profile`, `GET /api/account/orders`

---

## Фаза 7 — Admin: Решта розділів

> Потрібні Фази 1–3.

### 7.1 Відгуки
- [ ] `/admin/products/reviews` — таблиця (товар, автор, рейтинг, текст, статус, дата)
- [ ] Фільтр: статус (На модерації / Опубліковані / Відхилені), рейтинг, пошук
- [ ] Дії: схвалити, відхилити, видалити
- [ ] API: `GET /api/admin/reviews`, `PUT /api/admin/reviews/[id]`

### 7.2 Покупці
- [ ] `/admin/customers` — таблиця (ім'я, email, телефон, замовлень, сума, дата реєстрації)
- [ ] Фільтри: пошук, статус, дата реєстрації, сума замовлень
- [ ] `/admin/customers/[id]` — профіль: дані, список замовлень, нотатки
- [ ] API: `GET /api/admin/customers`, `GET /api/admin/customers/[id]`

### 7.3 Звіти
- [ ] `/admin/reports/sales` — Recharts лінійний/стовпчиковий + таблиця товарів
- [ ] `/admin/reports/categories` — продажі по категоріях
- [ ] `/admin/reports/regions` — продажі по регіонах (таблиця + карта опціонально)
- [ ] Period selector: сьогодні / тиждень / місяць / квартал / рік / довільний
- [ ] Summary cards: загальний дохід, кількість замовлень, середній чек
- [ ] Тренд vs попередній період (↑↓)
- [ ] Експорт CSV
- [ ] API: `GET /api/admin/reports/sales?from=&to=`

### 7.4 Dashboard
- [ ] `/admin/dashboard` — 3-колонковий grid (desktop), 1 колонка (mobile)
- [ ] Widgets: метрики продажів (period selector), revenue chart (Recharts), останні замовлення, к-сть покупців
- [ ] New widgets: low stock (qty ≤ 5), топ-5 товарів, abandoned carts, відгуки на модерації
- [ ] API: `GET /api/admin/stats?period=`

### 7.5 Маркетинг
- [ ] `/admin/marketing/promotions` — CRUD промо-акцій (тип: кошик/каталог, умови, бонус, дати)
- [ ] `/admin/marketing/gift-certificates` — генерація, список, статуси
- [ ] `/admin/marketing/banners` — groups + individual banners, CMS-редактор
- [ ] `/admin/marketing/newsletters` — збір email-підписників, список (v1 тільки збір)
- [ ] API: відповідні CRUD endpoints

### 7.6 Веб-сайт
- [ ] `/admin/website/pages` — CRUD статичних сторінок (rich text, SEO)
- [ ] `/admin/website/menus` — редактор меню (nested drag-and-drop)
- [ ] `/admin/website/blog` — список постів, форма посту (title, slug, content, image, tags, published)
- [ ] `/admin/website/tags` — CRUD тегів
- [ ] `/admin/website/seo` — 301 redirects таблиця + редактор robots.txt
- [ ] `/admin/website/sitemap` — preview + "Оновити кеш"
- [ ] API: відповідні CRUD endpoints

### 7.7 Налаштування
- [ ] `/admin/settings` — загальні налаштування магазину (назва, email, телефон, адреса, логотип, favicon)
- [ ] Платіжні ключі (LiqPay, Monobank, WayForPay) — зберігати в env, форма тільки для перевірки підключення
- [ ] Nova Poshta API key
- [ ] Checkbox API key + касир
- [ ] Email (SMTP або Resend) налаштування

---

## Фаза 8 — Storefront: Допоміжні сторінки

> Потрібні Фази 5–6.

- [ ] `/` — Головна сторінка: hero banner, популярні категорії, хіти продажів, новинки, переваги
- [ ] `/blog` — список постів (infinite scroll)
- [ ] `/blog/[slug]` — пост (SSR + generateMetadata)
- [ ] `/[slug]` — статичні сторінки (Доставка, Про компанію, Повернення, Оферта)
- [ ] `/contacts` — контакти + форма зворотного зв'язку
- [ ] `/wishlist` — список бажань
- [ ] `/compare` — порівняння товарів (max 4, таблиця характеристик)
- [ ] `/promotions` — список акцій
- [ ] `/gift-certificates` — купити подарунковий сертифікат
- [ ] `/returns` — форма повернення
- [ ] `/sitemap` — HTML sitemap
- [ ] `/sitemap.xml` — автогенерований XML (Next.js `app/sitemap.ts`)
- [ ] `robots.txt` — Next.js `app/robots.ts`
- [ ] 404 сторінка (`not-found.tsx`)
- [ ] Callback widget (sticky кнопка "Замовити дзвінок")

---

## Фаза 9 — SEO і Продуктивність

> Потрібні всі попередні фази.

- [ ] JSON-LD Product schema на кожній сторінці товару
- [ ] JSON-LD BreadcrumbList на категоріях і товарах
- [ ] `generateMetadata()` на всіх публічних сторінках
- [ ] Auto-fill meta title/description якщо поле порожнє
- [ ] Canonical URLs
- [ ] `<link rel="preload">` для перших зображень (AB: Preload логіка)
- [ ] Next.js `Image` компонент з правильними `sizes`
- [ ] Lazy load зображень (крім перших видимих)
- [ ] Core Web Vitals перевірка (LCP < 2.5s, CLS < 0.1)
- [ ] Redis кешування: каталог, характеристики, меню (`stale-while-revalidate`)
- [ ] ISR (Incremental Static Regeneration) для сторінок товарів і категорій

---

## Фаза 10 — Deploy і CI/CD

- [ ] Зареєструвати Hetzner VPS (CX22 — 2 CPU, 4GB RAM, ~4€/міс)
- [ ] Встановити Coolify на VPS (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`)
- [ ] Підключити GitHub репозиторій до Coolify
- [ ] Додати PostgreSQL через Coolify (one-click)
- [ ] Додати Redis через Coolify (one-click)
- [ ] Додати MinIO через Coolify (one-click)
- [ ] Налаштувати env variables в Coolify UI
- [ ] Налаштувати автодеплой при push в `main`
- [ ] SSL через Let's Encrypt (автоматично в Coolify)
- [ ] Перевірити zero-downtime redeploy
- [ ] Health check endpoint `GET /api/health`
- [ ] Налаштувати cron jobs в Coolify (sync shipments — кожні 2 год)
- [ ] Backup PostgreSQL (cron щодня через Coolify)
- [ ] Моніторинг помилок (Sentry)

---

## v2 — Після запуску

- [ ] WayForPay як додатковий платіжний шлюз (LiqPay + Mono в пріоритеті на v1)
- [ ] Укрпошта API інтеграція
- [ ] Price feeds: Google Shopping XML (`/feeds/google.xml`), Prom.ua YML (`/feeds/prom.yml`) — cron кожні 6 год
- [ ] Email-кампанії через Brevo або Mailchimp API
- [ ] Loyalty points система
- [ ] Розширений пошук (Meilisearch або Algolia якщо PostgreSQL FTS недостатній)
- [ ] Динамічний ремаркетинг (Google Ads, Meta Pixel)
- [ ] A/B тестування

---

## Нотатки по сесіях

> Сюди записуй короткі нотатки після кожної сесії — що зроблено, що вирішили, де зупинились.

| Дата | Що зроблено | Наступний крок |
|------|-------------|----------------|
| — | — | Початок: Фаза 1.1 |
