# TASKS.md — Knyha Platform

> Статуси: `[ ]` не розпочато · `[~]` в процесі · `[x]` готово
> Гілки: `feat/<task-id>-short-name`

---

## 🚀 ФАЗА 0 — Ініціалізація ✅

- [x] **T-001** Turborepo monorepo (pnpm workspaces + turbo.json)
- [x] **T-002** `apps/web` — Next.js 14 + Tailwind CSS
- [x] **T-003** `apps/api` — Fastify + TypeScript + AppError
- [x] **T-004** `packages/shared-types` — спільні TypeScript інтерфейси
- [x] **T-005** ESLint + Prettier для всього monorepo
- [x] **T-006** `infra/docker-compose.yml` для dev (postgres, redis, minio)
- [x] **T-007** `.env.example` для `web` та `api`
- [x] **T-008** GitHub Actions CI (lint + typecheck на кожен PR)

## 🗄️ ФАЗА 1 — Поточна фаза

**Поточний статус:** Фаза 1 завершена ✅ → Наступний крок: Фаза 2 (T-201 профіль автора)

---

## 🗄️ ФАЗА 1 — База даних та авторизація

- [x] **T-101** Prisma schema (User, Book, Order, OrderItem, Royalty + всі enum)
- [x] **T-102** Prisma міграції
- [x] **T-103** Seed скрипт (тестовий автор + 2 книги)
- [x] **T-104** NextAuth.js v5 — Email/Password стратегія
- [x] **T-105** Google OAuth провайдер
- [x] **T-106** `POST /api/auth/register`
- [x] **T-107** `POST /api/auth/login` — JWT
- [x] **T-108** JWT middleware для захищених routes
- [x] **T-109** Admin middleware — guard для `/admin/*` routes (role: ADMIN)
- [x] **T-110** Сторінки `/login` та `/register` (RHF + Zod)
- [x] **T-111** Зберігати `contractAcceptedAt` при першій публікації (при T-703)
- [ ] **T-112** Google OAuth в production — додати `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` до `.env.production` на VPS; перебудувати `knyha-web`; перевірити `AUTH_URL` callback у Google Console

---

## 👤 ФАЗА 2 — Профіль автора

- [x] **T-201** `GET/PATCH /api/users/me`
- [x] **T-202** `POST /api/users/me/avatar` (MinIO)
- [x] **T-203** Сторінка `/dashboard/settings`
- [x] **T-204** Компонент завантаження аватара (react-image-crop)
- [x] **T-205** Унікальний slug для автора

---

## 📚 ФАЗА 3 — Управління книгами (Dashboard)

- [x] **T-301** `GET /api/books` — книги автора
- [x] **T-302** `POST /api/books` — створити чернетку
- [x] **T-303** `GET /api/books/:id`
- [x] **T-304** `PATCH /api/books/:id` — метадані
- [x] **T-305** `DELETE /api/books/:id`
- [x] **T-306** Сторінка `/dashboard/books` — картки книг
- [x] **T-307** Сторінка `/dashboard/books/new` — wizard 5 кроків
- [x] **T-308** Компонент `BookWizard` — прогрес-бар + кроки

---

## 📄 ФАЗА 4 — Завантаження та конвертація

- [x] **T-401** MinIO клієнт (`storage.service.ts`)
- [x] **T-402** `POST /api/books/:id/upload-docx`
- [x] **T-403** Компонент `DocxUploader` (drag & drop + прогрес)
- [x] **T-404** BullMQ + Redis налаштування
- [x] **T-405** `apps/worker/Dockerfile` — Ubuntu 22.04 + Node 20 + LibreOffice + Pandoc + Ghostscript + Calibre
- [x] **T-406** Job `convert-docx-to-pdf` — LibreOffice → PDF (стиснений)
- [x] **T-407** Job `generate-pdf-print` — Ghostscript → PDF/X-3 (CMYK, 300 DPI, bleed 3мм)
- [x] **T-408** Job `generate-epub` — Pandoc → EPUB 3
- [x] **T-409** Job `generate-fb2` — Calibre → FB2
- [x] **T-410** Job `generate-mobi` — Calibre → MOBI/AZW3
- [x] **T-411** `publishing.service.ts` — orchestrator jobs
- [x] **T-412** `POST /api/books/:id/job-status` — оновлення статусу
- [x] **T-413** Polling на фронті — прогрес кожного формату окремо
- [x] **T-414** Валідація print PDF (> 10MB — без стиснення)

---

## 🎨 ФАЗА 5 — Редактор обкладинки

- [x] **T-501** Fabric.js canvas — компонент `CoverDesigner`
- [x] **T-502** Завантаження власного зображення
- [x] **T-503** Інструменти: текст, колір, шрифт, позиція
- [x] **T-504** Unsplash API — безкоштовні фонові зображення
- [x] **T-505** Готові шаблони (мінімум 5)
- [x] **T-506** Експорт PNG (300 DPI)
- [x] **T-507** `POST /api/books/:id/upload-cover` → MinIO

### Фаза 5b — Виправлення та покращення редактора

- [ ] **T-508** Власне зображення як фон не працює: кнопка "Завантажити фото" у вкладці "Фон" натискається, але файл не завантажується — виправити `handleFileUpload` у `CoverDesignerCanvas.tsx`
- [ ] **T-509** Undo/Redo (Ctrl+Z / Ctrl+Y) — при змінах тексту, позиції, розтягуванні об'єктів; реалізувати через стек станів canvas JSON (Fabric.js `toJSON` / `loadFromJSON`)
- [ ] **T-510** Snap до кутів при повороті — крок 10°, спрацьовує якщо об'єкт повертається в межах ±3° від кратного 10°; реалізувати через `object:rotating` event у Fabric.js
- [ ] **T-511** Додавання та редагування прямокутника: кнопка "Додати прямокутник" → `fabric.Rect` на canvas; панель властивостей активного прямокутника: колір заливки, колір обводки, товщина обводки, прозорість (opacity 0–100%); видалення через Delete/кнопку

---

## 📡 ФАЗА 6 — Стратегія дистрибуції (KU vs Широке)

- [x] **T-601** UI вибору стратегії на кроці 4 wizard (WIDE | KDP_SELECT)
- [x] **T-602** Зберігати `distributionStrategy` + `kdpSelectExpiry` в БД
- [x] **T-603** Логіка: якщо KDP_SELECT — при публікації знімати з D2D та сайту
- [x] **T-604** Нотифікація автору за 7 днів до закінчення KDP Select (email job)
- [x] **T-605** UI у кабінеті автора — статус ексклюзивності + дата закінчення

---

## 🔖 ФАЗА 7 — ISBN та публікація

- [x] **T-701** `isbn.service.ts` — mock для MVP, реальна Книжкова палата — Фаза 2
- [x] **T-702** Валідація перед публікацією (обкладинка + файл + метадані + ціна)
- [x] **T-703** `POST /api/books/:id/publish`
- [x] **T-704** Статуси: DRAFT → PROCESSING → REVIEW → PUBLISHED
- [x] **T-705** Email автору після публікації
- [x] **T-706** Сторінка підтвердження з ISBN і посиланням

---

## 🏪 ФАЗА 8 — Публічний магазин

- [x] **T-801** `GET /api/store/books` — каталог (фільтри: жанр, мова, формат)
- [x] **T-802** `GET /api/store/books/:slug`
- [x] **T-803** `GET /api/store/authors/:slug`
- [x] **T-804** Головна сторінка — банер + нові + популярні
- [x] **T-805** Сторінка книги — обкладинка, опис, ISBN, формати, ціна
- [x] **T-806** Сторінка автора — фото, біо, книги
- [x] **T-807** `BookCard` компонент
- [x] **T-808** Пошук (PostgreSQL `tsvector`)
- [x] **T-809** Пагінація (cursor-based)
- [x] **T-810** SEO (Open Graph, JSON-LD)

---

## 💳 ФАЗА 9 — Замовлення та платежі

- [x] **T-901** `POST /api/orders`
- [x] **T-902** `GET /api/orders/:id`
- [x] **T-903** LiqPay інтеграція — форма оплати
- [x] **T-904** `POST /api/payments/liqpay/callback`
- [ ] **T-905** Stripe Payment Intent (Фаза 2)
- [ ] **T-906** `POST /api/payments/stripe/webhook`
- [ ] **T-909** WayForPay інтеграція — форма оплати (Фаза 2)
- [ ] **T-910** `POST /api/payments/wayforpay/callback`
- [x] **T-907** Email з signed URLs після оплати (48 год)
- [x] **T-908** Сторінка `/orders/:id` — статус для покупця

---

## 👁 ФАЗА 10 — Preview уривку

- [x] **T-1001** Автор виділяє уривок (мишею або діапазон сторінок)
- [x] **T-1002** Зберігати `previewStart` / `previewEnd` в БД
- [x] **T-1003** EPUB reader для покупця (`epubjs`) з темами + paywall

---

## 🛡 ФАЗА 11 — Адмін-панель

- [x] **T-1101** Layout `/admin` — sidebar + topbar (окремий від auth guard)
- [x] **T-1102** `/admin/dashboard` — KPI картки + останні події + черга
- [x] **T-1103** `/admin/books` — таблиця + фільтри (статус, сервіс, жанр)
- [x] **T-1104** Схвалення книги: `PATCH /api/admin/books/:id/approve`
- [x] **T-1105** Відхилення книги з причиною: `PATCH /api/admin/books/:id/reject`
- [x] **T-1106** `/admin/books/[id]/distribute` — форми D2D + KDP + Google
- [x] **T-1107** Чеклист готовності книги (EPUB ✅ | обкладинка ✅ | ISBN ✅)
- [x] **T-1108** `POST /api/admin/books/:id/export-package` — ZIP (EPUB + cover + metadata.csv)
- [x] **T-1109** Статуси відправки: `ExternalStatus` (NOT_SENT | SENT | PUBLISHED | ERROR)
- [x] **T-1110** `/admin/distribution/queue` — черга книг готових до відправки
- [x] **T-1111** `/admin/distribution/bulk` — масова відправка (ZIP з кількох книг)
- [x] **T-1112** `/admin/applications/kdp-api` — форма заявки KDP Selling Partner API
- [x] **T-1113** `/admin/applications/google-books` — форма заявки Google Books Partner API
- [x] **T-1114** `/admin/applications/d2d-partner` — лист до D2D Business Development
- [x] **T-1115** `/admin/royalties` — список виплат + поріг 500 грн + кнопка Виплатити
- [x] **T-1116** `POST /api/admin/royalties/:id/pay` — відмітити як виплачено
- [x] **T-1117** `/admin/royalties/export` — CSV для бухгалтерії
- [x] **T-1118** `/admin/services` — toggle on/off кожного сервісу дистрибуції
- [x] **T-1119** `/admin/authors` — список авторів + статус договору
- [ ] **T-1120** `/admin/authors` — розширена таблиця: email, дата реєстрації, кількість книг, статус договору, остання активність; пошук + фільтр по статусу
- [ ] **T-1121** `DELETE /api/admin/users/:id` — видалення акаунту автора (каскадно: книги, замовлення, роялті); підтверджуючий модал на фронті
- [ ] **T-1122** `/admin/authors/:id` — сторінка деталей автора: профіль + повний список книг зі статусами конвертації та дистрибуції
- [ ] **T-1123** Завантаження файлів книги з панелі автора: кнопки Download для кожного формату (EPUB, FB2, MOBI, PDF, Print PDF) → signed MinIO URL (48 год)

---

## 🔐 ФАЗА 16 — Сесії та UX авторизації

- [ ] **T-1601** Persistent session — користувач не повинен логінитись після кожного переходу між сторінками; перевірити cookie `maxAge`, `AUTH_SECRET` на VPS та `trustHost` за Caddy reverse proxy

---

## 🐛 ФАЗА 17 — Критичні баги (production)

### T-1701 — `POST /api/books` → 401 UNAUTHORIZED при створенні книги

**Сторінка**: `/dashboard/books/new`
**Помилка**: `{"error":"Invalid or missing token","code":"UNAUTHORIZED"}`
**Причина**: клієнтський компонент `BookWizard` робить `fetch('/api/books', ...)` без заголовка `Authorization: Bearer <apiToken>`. Токен є в сесії (`session.user.apiToken`), але не передається в запит.
**Що виправити**:
- [ ] **T-1701** У `BookWizard` та всіх `fetch` до `/api/books` — передавати `Authorization: Bearer ${session.apiToken}` (взяти через `useSession()` або `getSession()` на клієнті / `auth()` на сервері)

### T-1702 — `GET/PATCH /api/users/me` + `POST /api/users/me/avatar` → 401/404

**Сторінка**: `/dashboard/settings` (завантаження фото профілю)
**Помилки**:
- `GET /api/users/me` → `{"error":"Invalid or missing token","code":"UNAUTHORIZED"}` — не передається токен
- `PATCH /api/users/me` → `{"error":"Invalid or missing token","code":"UNAUTHORIZED"}` — не передається токен
- `GET /api/users/me/avatar` → 404 Not Found — клієнт робить GET замість POST; маршрут `POST /api/users/me/avatar` існує, GET — ні
**Що виправити**:
- [ ] **T-1702a** У компонентах `AvatarUploader` та `settings/page.tsx` — додати `Authorization: Bearer ${apiToken}` до всіх запитів на `/api/users/me` і `/api/users/me/avatar`
- [ ] **T-1702b** Перевірити `AvatarUploader` — переконатись що аватар відправляється через `POST`, а не `GET`

### Загальне рішення для T-1701 + T-1702

Використовувати хук `useApi` або централізований `fetchWithAuth` що автоматично читає `apiToken` з сесії і додає заголовок:
```typescript
// hooks/useApi.ts
const session = useSession();
const token = (session.data?.user as any)?.apiToken;
headers: { Authorization: `Bearer ${token}` }
```

### T-1703 — 500 Internal Server Error на `/api/books`, `/api/users/me`, `/api/users/me/avatar`

**Помилки** (після того як авторизація буде виправлена — T-1701/T-1702):
```
/api/books             → 500
/api/users/me          → 500
/api/users/me/avatar   → 500
```
**Діагностика**: перевірити `docker logs knyha-api --tail=100` — 500 означає виняток на сервері (Prisma, MinIO, або некоректне тіло запиту).
- [ ] **T-1703** Дослідити логи API при кожному запиті; виправити серверні помилки (найімовірніше: Prisma query crash або відсутній MinIO bucket)

### T-1704 — Авто-генерація slug з імені автора на `/dashboard/settings`

**Поведінка**: при введенні імені автора в полі "Ім'я" — поле slug автоматично заповнюється транслітерованим значенням (uk → latin), в нижньому регістрі, пробіли → `-`.
**Приклад**: `Іван Франко` → `ivan-franko`
- [ ] **T-1704** На `settings/page.tsx` — через `watch('name')` (React Hook Form) генерувати slug: транслітерація (бібліотека `transliteration` або власна uk→latin таблиця) + `.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`; slug залишається редагованим вручну

---

## 📜 ФАЗА 12 — Юридика на сайті

- [x] **T-1201** Сторінка `/author-agreement` — повний текст договору + accept bar
- [x] **T-1202** Зберігати `contractAcceptedAt` + IP при акцепті
- [x] **T-1203** Сторінка `/terms` — умови використання
- [x] **T-1204** Сторінка `/privacy` — політика конфіденційності
- [x] **T-1205** Cookie banner (GDPR)

---

## 🚀 ФАЗА 13 — Деплой

- [x] **T-1301** `docker-compose.prod.yml`
- [x] **T-1302** Nginx конфіг (web:3000, api:3001)
- [x] **T-1303** Certbot SSL
- [x] **T-1304** GitHub Actions `deploy.yml` → SSH
- [x] **T-1305** `backup-db.sh` — щоденний бекап PostgreSQL → MinIO
- [x] **T-1306** Grafana + Prometheus
- [x] **T-1307** Health check `/api/health`
- [x] **T-1308** Rate limiting (fastify-rate-limit)
- [x] **T-1309** Structured logging (Pino)

---

## 🧪 ФАЗА 14 — Тестування

- [x] **T-1401** Unit: `isbn.service.ts` (Vitest)
- [x] **T-1402** Unit: Zod схеми
- [x] **T-1403** Integration: auth endpoints
- [x] **T-1404** E2E: реєстрація → книга → публікація (Playwright)
- [x] **T-1405** E2E: магазин → купівля → отримання файлу

---

## 💸 ФАЗА 15 — Виплати авторам (Payout System)

> Автор накопичує баланс з продажів → запитує виплату → гроші надходять на картку/рахунок.
> Платформа утримує комісію (налаштовується через env `PLATFORM_FEE_PERCENT`).

### Фаза 15a — Базова інфраструктура

- [ ] **T-1501** `PLATFORM_FEE_PERCENT` в env (default: 25%) — додати до `.env.example`
- [ ] **T-1502** Prisma: модель `PayoutRequest` (id, authorId, amount, status, bankDetails, requestedAt, paidAt)
- [ ] **T-1503** Prisma: поля в `User` — `iban`, `cardNumber`, `taxId` (РНОКПП), `isFop` (ФОП чи фізособа)
- [ ] **T-1504** Prisma міграція
- [ ] **T-1505** `payout.service.ts` — розрахунок балансу автора (сума роялті мінус виплачені)

### Фаза 15b — API

- [ ] **T-1506** `GET /api/payouts/balance` — поточний баланс + список транзакцій
- [ ] **T-1507** `PATCH /api/users/me/bank-details` — автор зберігає IBAN / картку / РНОКПП
- [ ] **T-1508** `POST /api/payouts/request` — запит виплати (мін. поріг 500 UAH, hold 7 днів)
- [ ] **T-1509** `GET /api/payouts/my` — список виплат автора зі статусами
- [ ] **T-1510** `POST /api/admin/payouts/:id/approve` — адмін схвалює → ініціює переказ
- [ ] **T-1511** `POST /api/admin/payouts/:id/reject` — відхилити з причиною

### Фаза 15c — UI автора

- [ ] **T-1512** Сторінка `/dashboard/payouts` — баланс + кнопка «Вивести кошти»
- [ ] **T-1513** Форма банківських реквізитів (IBAN або номер картки + РНОКПП + тип ФОП/фізособа)
- [ ] **T-1514** Список виплат з статусами (PENDING / APPROVED / PAID / REJECTED)
- [ ] **T-1515** Email автору після виплати (сума + дата)

### Фаза 15d — Автоматизація (Фаза 2)

- [ ] **T-1516** LiqPay Mass Payments (B2P API) — автоматичний переказ на картку Privat24
- [ ] **T-1517** WayForPay Settlement API — автоматичний переказ на будь-яку картку
- [ ] **T-1518** IBAN bank transfer через SWIFT/SEPA (для ФОП)
- [ ] **T-1519** Звіт для бухгалтерії — CSV виплат за місяць (ПІБ, РНОКПП, сума, дата)
- [ ] **T-1520** Адмін: `/admin/payouts` — черга очікуючих виплат + масове схвалення

---

## 📊 MVP Scope (мінімально робочий продукт)

```
Фази 0–3 (повністю)
+ T-401..T-413  (конвертація)
+ T-501..T-507  (обкладинка)
+ T-601..T-605  (KU вибір)
+ T-701..T-706  (ISBN + публікація)
+ T-801..T-810  (магазин)
+ T-901..T-908  (оплата LiqPay)
+ T-1101..T-1119 (адмін-панель — базова)
+ T-1201..T-1205 (юридика)
+ T-1301..T-1309 (деплой)
```

Після MVP: Stripe, EPUB reader, e2e тести, автоматизація D2D.
