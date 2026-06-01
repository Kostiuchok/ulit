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

- [ ] **T-801** `GET /api/store/books` — каталог (фільтри: жанр, мова, формат)
- [ ] **T-802** `GET /api/store/books/:slug`
- [ ] **T-803** `GET /api/store/authors/:slug`
- [ ] **T-804** Головна сторінка — банер + нові + популярні
- [ ] **T-805** Сторінка книги — обкладинка, опис, ISBN, формати, ціна
- [ ] **T-806** Сторінка автора — фото, біо, книги
- [ ] **T-807** `BookCard` компонент
- [ ] **T-808** Пошук (PostgreSQL `tsvector`)
- [ ] **T-809** Пагінація (cursor-based)
- [ ] **T-810** SEO (Open Graph, JSON-LD)

---

## 💳 ФАЗА 9 — Замовлення та платежі

- [ ] **T-901** `POST /api/orders`
- [ ] **T-902** `GET /api/orders/:id`
- [ ] **T-903** LiqPay інтеграція — форма оплати
- [ ] **T-904** `POST /api/payments/liqpay/callback`
- [ ] **T-905** Stripe Payment Intent (Фаза 2)
- [ ] **T-906** `POST /api/payments/stripe/webhook`
- [ ] **T-907** Email з signed URLs після оплати (48 год)
- [ ] **T-908** Сторінка `/orders/:id` — статус для покупця

---

## 👁 ФАЗА 10 — Preview уривку

- [ ] **T-1001** Автор виділяє уривок (мишею або діапазон сторінок)
- [ ] **T-1002** Зберігати `previewStart` / `previewEnd` в БД
- [ ] **T-1003** EPUB reader для покупця (`epubjs`) з темами + paywall

---

## 🛡 ФАЗА 11 — Адмін-панель

- [ ] **T-1101** Layout `/admin` — sidebar + topbar (окремий від auth guard)
- [ ] **T-1102** `/admin/dashboard` — KPI картки + останні події + черга
- [ ] **T-1103** `/admin/books` — таблиця + фільтри (статус, сервіс, жанр)
- [ ] **T-1104** Схвалення книги: `PATCH /api/admin/books/:id/approve`
- [ ] **T-1105** Відхилення книги з причиною: `PATCH /api/admin/books/:id/reject`
- [ ] **T-1106** `/admin/books/[id]/distribute` — форми D2D + KDP + Google
- [ ] **T-1107** Чеклист готовності книги (EPUB ✅ | обкладинка ✅ | ISBN ✅)
- [ ] **T-1108** `POST /api/admin/books/:id/export-package` — ZIP (EPUB + cover + metadata.csv)
- [ ] **T-1109** Статуси відправки: `ExternalStatus` (NOT_SENT | SENT | PUBLISHED | ERROR)
- [ ] **T-1110** `/admin/distribution/queue` — черга книг готових до відправки
- [ ] **T-1111** `/admin/distribution/bulk` — масова відправка (ZIP з кількох книг)
- [ ] **T-1112** `/admin/applications/kdp-api` — форма заявки KDP Selling Partner API
- [ ] **T-1113** `/admin/applications/google-books` — форма заявки Google Books Partner API
- [ ] **T-1114** `/admin/applications/d2d-partner` — лист до D2D Business Development
- [ ] **T-1115** `/admin/royalties` — список виплат + поріг 500 грн + кнопка Виплатити
- [ ] **T-1116** `POST /api/admin/royalties/:id/pay` — відмітити як виплачено
- [ ] **T-1117** `/admin/royalties/export` — CSV для бухгалтерії
- [ ] **T-1118** `/admin/services` — toggle on/off кожного сервісу дистрибуції
- [ ] **T-1119** `/admin/authors` — список авторів + статус договору

---

## 📜 ФАЗА 12 — Юридика на сайті

- [ ] **T-1201** Сторінка `/author-agreement` — повний текст договору + accept bar
- [ ] **T-1202** Зберігати `contractAcceptedAt` + IP при акцепті
- [ ] **T-1203** Сторінка `/terms` — умови використання
- [ ] **T-1204** Сторінка `/privacy` — політика конфіденційності
- [ ] **T-1205** Cookie banner (GDPR)

---

## 🚀 ФАЗА 13 — Деплой

- [ ] **T-1301** `docker-compose.prod.yml`
- [ ] **T-1302** Nginx конфіг (web:3000, api:3001)
- [ ] **T-1303** Certbot SSL
- [ ] **T-1304** GitHub Actions `deploy.yml` → SSH
- [ ] **T-1305** `backup-db.sh` — щоденний бекап PostgreSQL → MinIO
- [ ] **T-1306** Grafana + Prometheus
- [ ] **T-1307** Health check `/api/health`
- [ ] **T-1308** Rate limiting (fastify-rate-limit)
- [ ] **T-1309** Structured logging (Pino)

---

## 🧪 ФАЗА 14 — Тестування

- [ ] **T-1401** Unit: `isbn.service.ts` (Vitest)
- [ ] **T-1402** Unit: Zod схеми
- [ ] **T-1403** Integration: auth endpoints
- [ ] **T-1404** E2E: реєстрація → книга → публікація (Playwright)
- [ ] **T-1405** E2E: магазин → купівля → отримання файлу

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
