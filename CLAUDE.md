# CLAUDE.md — Knyha Platform

> Платформа самовидавництва для українських авторів. Аналог Ridero.
> Автор завантажує книгу → ISBN → публікує у електронному та/або друкованому форматі → магазин + зовнішні сервіси.
> **Прототип:** `knyha-complete.html` — 24 екрани (автор + адмін + договір + KU-вибір)

---

## ⚡ QUICK RESUME

When the user says **"resume"** — show this status block immediately:

```
✅ LAST DONE:    <last completed task — one line>
🔄 IN PROGRESS:  <current task being worked on>
📋 NEXT 3:
  1. <next task>
  2. <task after>
  3. <task after that>
```

---

## 🏗️ Технологічний стек

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **Стан**: Zustand (клієнт) + React Query (сервер)
- **Редактор обкладинки**: Fabric.js (canvas-based)
- **Завантаження файлів**: react-dropzone
- **Форми**: React Hook Form + Zod

### Backend
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify
- **ORM**: Prisma
- **Черга задач**: BullMQ + Redis
- **Файловий storage**: MinIO (self-hosted S3)
- **Auth**: NextAuth.js v5 (JWT + Google OAuth)

### База даних
- **Primary**: PostgreSQL 16
- **Cache / Queue**: Redis 7

### Обробка книг
- **DOCX → PDF (онлайн)**: LibreOffice headless
- **PDF → PDF/X-3 (друк)**: Ghostscript (CMYK, 300 DPI, bleed 3мм)
- **DOCX → EPUB 3**: Pandoc
- **EPUB → FB2**: Calibre headless
- **EPUB → MOBI/AZW3**: Calibre headless
- **Зображення**: Sharp

### Інфраструктура (VPS)
- Docker + Docker Compose
- Caddy reverse proxy + автоматичний SSL (Let's Encrypt) — зовнішній (`dddcore` проект, НЕ модифікувати)
- GitHub Actions CI/CD → SSH deploy
- Grafana + Prometheus моніторинг

### Платежі
- **Primary**: LiqPay (Україна — Приват24, Монобанк, Visa/MC)
- **Фаза 2**: Stripe (міжнародні картки)

---

## 📁 Структура проекту

```
knyha-platform/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   └── app/
│   │       ├── (auth)/               # /login, /register
│   │       ├── (dashboard)/          # Кабінет автора
│   │       │   ├── books/            # Список книг автора
│   │       │   ├── books/new/        # Wizard публікації (5 кроків)
│   │       │   └── settings/         # Профіль автора
│   │       ├── (store)/              # Публічний магазин
│   │       │   ├── page.tsx          # Головна магазину
│   │       │   ├── books/[slug]/     # Сторінка книги
│   │       │   └── authors/[slug]/   # Сторінка автора
│   │       └── admin/                # Адмін-панель
│   │           ├── dashboard/
│   │           ├── books/            # Список + модерація
│   │           │   └── [id]/distribute/  # Відправка на сервіси
│   │           ├── distribution/
│   │           │   ├── queue/        # Черга відправки
│   │           │   ├── bulk/         # Масова відправка
│   │           │   └── logs/
│   │           ├── applications/     # Заявки KDP API, Google Books, D2D
│   │           │   ├── kdp-api/
│   │           │   ├── google-books/
│   │           │   └── d2d-partner/
│   │           ├── authors/
│   │           ├── royalties/
│   │           ├── store/
│   │           └── settings/
│   │
│   ├── api/                          # Fastify Backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── users/
│   │       │   ├── books/
│   │       │   ├── publishing/
│   │       │   ├── distribution/     # D2D, KDP, Google Play логіка
│   │       │   ├── store/
│   │       │   ├── orders/
│   │       │   └── payments/
│   │       ├── jobs/
│   │       │   ├── convert-docx-to-pdf.job.ts
│   │       │   ├── generate-pdf-print.job.ts
│   │       │   ├── generate-epub.job.ts
│   │       │   ├── generate-fb2.job.ts
│   │       │   ├── generate-mobi.job.ts
│   │       │   └── send-email.job.ts
│   │       └── services/
│   │           ├── storage.service.ts
│   │           ├── isbn.service.ts
│   │           ├── distribution.service.ts  # ZIP генерація, метадані
│   │           └── email.service.ts
│   │
│   └── worker/                       # Ubuntu 22.04 + LibreOffice + Pandoc + Ghostscript + Calibre (~1.5GB)
│
├── packages/
│   └── shared-types/
│
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/nginx.conf
│   └── scripts/
│       ├── deploy.sh
│       └── backup-db.sh
│
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
│
├── docs/
│   ├── knyha-complete.html          # Повний прототип (24 екрани)
│   ├── TASKS.md
│   └── TECHNICAL-DECISIONS.md       # Wiki рішень (юридика, дистрибуція, договір)
├── CLAUDE.md                        # ← цей файл
├── turbo.json
└── package.json
```

---

## 🗄️ Схема бази даних (Prisma)

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  slug          String    @unique
  bio           String?
  avatarUrl     String?
  role          Role      @default(AUTHOR)
  books         Book[]
  orders        Order[]
  royalties     Royalty[]
  contractAcceptedAt DateTime?   // Дата акцепту публічної оферти
  createdAt     DateTime  @default(now())
}

model Book {
  id              String      @id @default(cuid())
  slug            String      @unique
  title           String
  description     String?
  authorId        String
  author          User        @relation(fields: [authorId], references: [id])
  status          BookStatus  @default(DRAFT)
  moderationStatus ModerationStatus @default(PENDING)
  isbn            String?     @unique
  coverUrl        String?
  originalDocxUrl String?
  // Формати
  pdfUrl          String?     // для онлайн перегляду
  epubUrl         String?
  fb2Url          String?
  mobiUrl         String?
  printPdfUrl     String?     // PDF/X-3 для типографії
  priceEbook      Decimal?
  pricePrint      Decimal?
  genre           String?
  language        String      @default("uk")
  pageCount       Int?
  // Стратегія дистрибуції
  distributionStrategy DistributionStrategy @default(WIDE)
  kdpSelectEnrolled    Boolean  @default(false)
  kdpSelectExpiry      DateTime?
  // Статуси на зовнішніх сервісах
  d2dStatus       ExternalStatus @default(NOT_SENT)
  d2dSentAt       DateTime?
  kdpStatus       ExternalStatus @default(NOT_SENT)
  kdpSentAt       DateTime?
  googleStatus    ExternalStatus @default(NOT_SENT)
  googleSentAt    DateTime?
  createdAt       DateTime    @default(now())
  publishedAt     DateTime?
}

model Order {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  items         OrderItem[]
  total         Decimal
  status        OrderStatus @default(PENDING)
  paymentId     String?
  createdAt     DateTime    @default(now())
}

model OrderItem {
  id       String @id @default(cuid())
  orderId  String
  order    Order  @relation(fields: [orderId], references: [id])
  bookId   String
  format   String  // EPUB | FB2 | MOBI | PRINT
  price    Decimal
}

model Royalty {
  id        String   @id @default(cuid())
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  bookId    String
  amount    Decimal
  source    String   // SITE | D2D | KDP | GOOGLE
  status    RoyaltyStatus @default(PENDING)
  paidAt    DateTime?
  createdAt DateTime @default(now())
}

enum BookStatus { DRAFT PROCESSING REVIEW PUBLISHED ARCHIVED }
enum ModerationStatus { PENDING APPROVED REJECTED }
enum DistributionStrategy { WIDE KDP_SELECT }
enum ExternalStatus { NOT_SENT SENT PUBLISHED ERROR }
enum Role { AUTHOR ADMIN }
enum OrderStatus { PENDING PAID FULFILLED CANCELLED }
enum RoyaltyStatus { PENDING PAID }
```

---

## 🔄 Процес публікації (flow)

```
1. Автор завантажує .docx
2. Job: LibreOffice → PDF (онлайн перегляд)
3. Автор редагує обкладинку (Fabric.js)
4. Автор заповнює метадані (назва, опис, жанр, ціна)
5. Автор обирає стратегію: ШИРОКЕ | KDP SELECT
6. Автор обирає формати: EBOOK | PRINT
7. Система присвоює ISBN
8. Паралельні jobs:
   ├── generate-epub   → Pandoc → EPUB 3
   ├── generate-fb2    → Calibre → FB2
   ├── generate-mobi   → Calibre → MOBI
   └── generate-print  → Ghostscript → PDF/X-3
9. Book.status = PUBLISHED → магазин

Якщо WIDE: → черга адміна → D2D + KDP вручну
Якщо KDP_SELECT: → тільки KDP, решта призупиняється 90 днів
```

---

## 🌐 API Routes (Fastify)

```
# Auth
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

# Books (автор)
GET    /api/books
POST   /api/books
GET    /api/books/:id
PATCH  /api/books/:id
DELETE /api/books/:id
POST   /api/books/:id/upload-docx
POST   /api/books/:id/upload-cover
POST   /api/books/:id/publish

# Store (публічний)
GET    /api/store/books
GET    /api/store/books/:slug
GET    /api/store/authors/:slug

# Admin
GET    /api/admin/books              # Всі книги
PATCH  /api/admin/books/:id/approve  # Схвалити
PATCH  /api/admin/books/:id/reject   # Відхилити
GET    /api/admin/distribution/queue # Черга відправки
PATCH  /api/admin/books/:id/distribution  # Оновити статус D2D/KDP/Google
POST   /api/admin/books/:id/export-package # ZIP для завантаження
GET    /api/admin/royalties
POST   /api/admin/royalties/:id/pay
GET    /api/admin/applications
PATCH  /api/admin/applications/:id

# Orders & Payments
POST   /api/orders
GET    /api/orders/:id
POST   /api/payments/liqpay/callback
POST   /api/payments/stripe/webhook
```

---

## 🐳 Docker Compose (dev)

```yaml
services:
  postgres:  image: postgres:16-alpine,  port: 5432
  redis:     image: redis:7-alpine,      port: 6379
  minio:     image: minio/minio,         port: 9000/9001
  api:       build: ./apps/api,          port: 3001
  web:       build: ./apps/web,          port: 3000
  worker:    build: ./apps/worker        # Ubuntu 22.04 + LibreOffice + Pandoc + Ghostscript + Calibre
```

> Worker Dockerfile базується на `ubuntu:22.04` (НЕ alpine). Розмір ~1.5GB — нормально.

---

## ⚙️ Змінні середовища (.env)

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/knyha"
REDIS_URL="redis://localhost:6379"

MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET_NAME="knyha-books"

NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

LIQPAY_PUBLIC_KEY=""
LIQPAY_PRIVATE_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""

ADMIN_EMAIL="admin@knyha.ua"
```

---

## 📋 Прототип — карта екранів

```
knyha-complete.html (24 екрани)
│
├── АВТОР / ПОКУПЕЦЬ
│   ├── 🏪 Магазин (головна)
│   ├── 📖 Сторінка книги
│   ├── 👤 Сторінка автора
│   ├── 📊 Кабінет автора
│   ├── 📤 Wizard публікації (5 кроків)
│   ├── 🎨 Редактор обкладинки
│   ├── 📡 KU vs Широке розповсюдження (крок 4)
│   ├── 👁 Preview/уривок (автор + покупець)
│   ├── 💳 Checkout
│   └── 🔐 Авторизація
│
└── АДМІН
    ├── 🏠 Dashboard (KPI + черга + події)
    ├── 📚 Книги + модерація (схвалити/відхилити)
    ├── 🚀 Відправка книги (D2D + KDP + Google — форми)
    ├── 📦 Масова відправка (ZIP-пакет)
    ├── 📋 Заявки API (KDP API / Google Books / D2D)
    ├── 💰 Виплати роялті
    ├── ⚙️ Сервіси (toggle on/off)
    └── 📜 Договір з автором (повний текст + accept bar)
```

---

## 🚀 Правила деплою на VPS

### VPS: `178.105.208.56` | проект: `/opt/knyha-platform`
### Reverse proxy: Caddy (`dddcore-caddy-1`) — **НЕ модифікувати dddcore проект**

### Команди деплою (завжди з `/opt/knyha-platform`):

```bash
# Стандартний деплой з кодом (після git pull) — ЗАВЖДИ REBUILD
set -a; source .env.production; set +a
docker compose --project-name knyha -f infra/docker-compose.prod.yml up -d --build api web worker

# Тільки env змінні змінились (без зміни коду) — force-recreate БЕЗ --build
docker compose --project-name knyha -f infra/docker-compose.prod.yml up -d --force-recreate web

# Перевірити стан контейнерів
docker compose --project-name knyha -f infra/docker-compose.prod.yml ps

# Логи конкретного сервісу
docker logs knyha-web --tail=50
docker logs knyha-api --tail=50
```

### КРИТИЧНЕ ПРАВИЛО: `--force-recreate` ≠ rebuild
- `--force-recreate` — перезапускає контейнер з ІСНУЮЧИМ образом (нового коду немає)
- `--build` — будує НОВИЙ образ з поточного коду (потрібно після будь-яких змін файлів)
- **Якщо змінився код → завжди `--build`. Якщо тільки .env → `--force-recreate`.**

### NextAuth v5 (важливо)
- Env змінна: `AUTH_SECRET` (НЕ `NEXTAUTH_SECRET`)
- Env змінна: `AUTH_URL=https://ulit.render.ua` (НЕ `NEXTAUTH_URL`)
- Caddy: `/api/auth/*` → `knyha-web:3000` (Next.js), `/api/*` → `knyha-api:3001` (Fastify)

### Health check
- Web контейнер завжди `(unhealthy)` бо `curl` не встановлено в `node:20-alpine` — це нормально, Next.js працює
- Перевіряти через: `docker exec dddcore-caddy-1 wget -qO- http://knyha-web:3000`

### Діагностика контейнера що рестартує
**Перший крок завжди**: `docker logs knyha-api --tail=50` — якщо контейнер рестартує, причина в логах.
Не треба перевіряти мережу, Caddyfile, або роутинг — поки не переконались що контейнер запущений.

---

## 🧠 Правила для Claude Code

1. **TypeScript скрізь**, `strict: true`
2. **Zod** для всіх вхідних даних API
3. **Кастомні помилки** `AppError` з HTTP кодом
4. **BullMQ jobs** — окремі файли з retry логікою
5. **MinIO** — файли авторів приватні, доступ через signed URLs (48 год)
6. **Conventional Commits** (`feat:`, `fix:`, `chore:`)
7. **Спільні типи** — тільки в `packages/shared-types`
8. **i18n-ready** — всі UI тексти через `next-intl` (uk/en)
9. **Admin middleware** — окремий guard для `/admin/*` routes
10. **Distribution service** — завжди перевіряти `kdpSelectExpiry` перед публікацією на не-Amazon платформах
11. **Fastify plugins** — мажорна версія `@fastify/*` плагінів ПОВИННА відповідати мажорній версії `fastify`. Fastify 4 → плагіни v7/v8. Fastify 5 → плагіни v8/v9. Після додавання нового плагіна — перевіряти сумісність.
12. **Next.js роутинг** — НІКОЛИ не створювати `app/page.tsx` якщо існує `app/(store)/page.tsx`. Route groups `(name)` не впливають на URL — обидва файли конкурують за `/` і `app/page.tsx` перемагає.
13. **`docs/ulit-reference/`** — тільки для ознайомлення. НЕ копіювати звідти код, стилі чи розмітку в проект. Використовувати лише як візуальний референс UX/UI.

---

## 🔥 Журнал вирішених проблем (Production Troubleshooting)

> Кожен запис = реальна проблема з VPS. Читати перед дебагом.

---

### 1. Fastify plugin version mismatch

**Симптом**: API контейнер рестартує одразу після старту. В логах:
```
FastifyError: fastify-plugin: @fastify/cors - expected '4.x' fastify version, '5.x' is installed
```

**Причина**: `@fastify/*` плагіни мають власну мажорну версію прив'язки до Fastify. Старі версії плагінів (cors@9, jwt@8, multipart@8, rate-limit@9) використовують `fastify-plugin@4.x` і несумісні з Fastify 5.

**Рішення**: Оновити всі `@fastify/*` плагіни до Fastify 5-сумісних версій:
```json
"@fastify/cors": "^11.0.0",
"@fastify/jwt": "^10.0.0",
"@fastify/multipart": "^10.0.0",
"@fastify/rate-limit": "^11.0.0",
"@fastify/formbody": "^8.0.0"
```
Після оновлення: `pnpm install` → rebuild API контейнера з `--build`.

**Правило**: При додаванні нового `@fastify/*` плагіна — перевіряти його `peerDependencies.fastify` перед `pnpm install`.

---

### 2. Prisma binary target на Alpine Docker

**Симптом**: API стартує, але падає при першому зверненні до БД:
```
PrismaClientInitializationError: Prisma Client could not locate the Query Engine for runtime "linux-musl-openssl-3.0.x"
```

**Причина**: `node:20-alpine` (Alpine 3.17+) використовує OpenSSL 3.0, але Prisma за замовчуванням генерує бінарник для `linux-musl` (OpenSSL 1.x).

**Рішення**: Додати `binaryTargets` у `apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```
Після зміни: `prisma generate` → rebuild з `--build --no-cache`.

---

### 3. Prisma migrations не застосовуються (таблиці не створюються)

**Симптом**: API запускається, але `POST /api/users/register` повертає 500. В логах Prisma:
```
No migration found in prisma/migrations
```
або помилка "relation does not exist".

**Причина**: `prisma migrate deploy` — no-op якщо немає файлів міграцій у `apps/api/prisma/migrations/`. Схема є, але таблиць немає.

**Рішення**: Згенерувати SQL міграцію з поточної схеми:
```bash
cd apps/api
pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20240101000000_init/migration.sql
```
Також потрібен `prisma/migrations/migration_lock.toml`:
```toml
# Please do not edit this file manually
provider = "postgresql"
```
Після цього `prisma migrate deploy` застосує SQL при старті контейнера.

---

### 4. NextAuth `/api/auth/*` → 404 (Fastify перехоплює)

**Симптом**: Логін не працює. В логах Fastify видно запити на `/api/auth/session`, `/api/auth/callback/credentials` → 404.

**Причина**: Caddy роутив весь `/api/*` на Fastify (`knyha-api:3001`), а NextAuth обробляє `/api/auth/*` у Next.js.

**Рішення**: Спростити Caddyfile — весь трафік `ulit.render.ua` направити на `knyha-web:3000`. Next.js rewrites самостійно проксують `/api/users/*`, `/api/books/*` тощо на Fastify через `API_INTERNAL_URL`:
```
ulit.render.ua {
    reverse_proxy knyha-web:3000
}
```
Next.js `next.config.mjs` rewrites компілюються під час `build` з `API_INTERNAL_URL=http://knyha-api:3001` (hardcoded у Dockerfile builder stage).

**Важливо**: Після зміни Caddyfile — перезавантажити: `docker exec dddcore-caddy-1 caddy reload --config /etc/caddy/Caddyfile`

---

### 5. Google OAuth ламає NextAuth при відсутніх env змінних

**Симптом**: Після деплою `/api/auth/session` повертає помилку або `/login` не рендериться. В логах Next.js:
```
TypeError: Cannot read properties of undefined (reading 'clientId')
```

**Причина**: `Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })` — TypeScript non-null assertion ігнорується в runtime. Якщо змінних немає, NextAuth ламається при ініціалізації.

**Рішення**: Зробити Google provider умовним у `apps/web/auth.ts`:
```typescript
...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
  : []),
```

---

### 6. Docker `--build` використовує кеш (старий код у контейнері)

**Симптом**: Деплой пройшов (`Building 0.9s FINISHED`), але поведінка не змінилась. В логах — стара версія.

**Причина**: Docker кешує шари. Якщо `package.json` і `pnpm-lock.yaml` не змінились, `RUN pnpm install` береться з кешу, і всі наступні шари теж.

**Рішення**: Примусовий rebuild без кешу:
```bash
docker compose --project-name knyha -f infra/docker-compose.prod.yml build --no-cache api
docker compose --project-name knyha -f infra/docker-compose.prod.yml up -d api
```

---

### 7. git divergent branches після force-push

**Симптом**: `git pull` на VPS або локально падає:
```
hint: You have divergent branches and need to specify how to reconcile them.
```

**Причина**: Гілка була force-pushed (rebase/reset) після того як VPS вже мав старі коміти.

**Рішення на VPS**:
```bash
git fetch origin
git reset --hard origin/dev
```
**Рішення локально** (якщо є конфлікти після rebase --abort):
```bash
git rebase --abort
git checkout origin/<branch> -- apps/api/package.json pnpm-lock.yaml
```

---

### 8. `useApi()` без мемоізації → нескінченний polling → rate limit / 500 / 502

**Симптом**: На сторінці рукопису (`/dashboard/books/:id/manuscript`) після певної дії (напр. вставка зображення) збереження зависає на "Збереження…", в мережі — десятки/сотні `GET /api/books/:id/manuscript` за секунду, бекенд відповідає `429` (rate limit), за тривалого навантаження — навіть `500`/`502`. Новий `POST`-запит (наприклад, завантаження зображення) може взагалі не дійти до бекенда — застряє позаду черги.

**Причина**: `apps/web/hooks/useApi.ts` повертав `apiFetch`/`apiUpload` як звичайні `function`-оголошення — нова ідентичність при кожному рендері компонента, що використовує хук. У `apps/web/app/dashboard/books/[id]/manuscript/page.tsx` є `poll` (`useCallback`, залежить від `apiFetch`) і `useEffect` (залежить від `poll`), що ставить `setInterval(poll, 3000)` для очікування конвертації docx. Оскільки `apiFetch` змінював ідентичність щорендеру → `poll` теж → `useEffect` перезапускався щорендеру → одразу викликав `poll()` і ставив ще один `setInterval`, поверх уже наявних — лавиноподібне зростання паралельних запитів. Будь-який інший компонент з ефектом, залежним від `apiFetch`, має той самий прихований ризик — просто ще не "вистрілив" так помітно.

**Рішення**: `apiFetch`/`apiUpload` в `useApi.ts` обгорнуті в `useCallback([token])` — стабільна ідентичність між рендерами, поки не змінюється токен. Додатково `manuscript/page.tsx`: ефект polling'у не переозброюється, якщо `manuscript.status` вже `"DONE"` (друга лінія захисту).

**Важливо для діагностики**: якщо після деплою фіксу флуд все одно триває — перевірити, чи немає **старої фонової вкладки браузера**, відкритої до деплою: вона й далі виконує старий JS у пам'яті (сторінка не підхоплює новий код без перезавантаження) і продовжить генерувати трафік, поки її не оновити (F5) чи закрити.

**Правило**: будь-яка функція, що повертається з хука і потрапляє в масив залежностей `useEffect`/`useCallback` (як `apiFetch` з `useApi()`), має бути стабільною (`useCallback`) — інакше будь-який ефект, залежний від неї, ризикує перезапускатись щорендеру.

---

### 9. Signed MinIO URL → `Mixed Content` (внутрішній `minio:9000` віддається браузеру)

**Симптом**: кнопка "Читати уривок" на сторінці книги — помилка "error loading book". Консоль браузера:
```
Mixed Content: The page at 'https://ulit.render.ua/...' was loaded over HTTPS,
but requested an insecure XMLHttpRequest endpoint 'http://minio:9000/knyha-books/...'.
This request has been blocked; the content must be served over HTTPS.
```
Стосується всього, що йде через `getSignedUrl()` — прев'ю EPUB (`/api/store/books/:slug/preview`), файли замовлень (48-год посилання), приватні документи (`identity`).

**Причина**: `minio.presignedGetObject()` (MinIO SDK) підписує URL проти endpoint'у, яким сконфігурований клієнт (`MINIO_ENDPOINT`/`MINIO_PORT` = `minio:9000`, внутрішній Docker-хост, без SSL) — і повертає його як є. Відданий браузеру напряму — це і Mixed Content (блокується на HTTPS-сайті), і взагалі недосяжний хост ззовні Docker-мережі.

**Рішення**: `getSignedUrl()` (`apps/api/src/services/storage.service.ts`) переписує origin присвоєного URL на `MINIO_PUBLIC_URL_BASE` (той самий `/storage`-проксі з `next.config.mjs`, яким уже користується `publicUrl()` для публічних файлів), прибираючи сегмент бакета зі шляху — він вже вшитий у ціль проксі. Підпис лишається валідним, бо `/storage`-rewrite при проксіюванні відтворює точно той самий шлях і `Host: minio:9000`, тож MinIO бачить той самий запит, що й підписував.

**Правило**: будь-яка НОВА функція, що генерує presigned/signed URL напряму через MinIO SDK (а не через `getSignedUrl()`/`publicUrl()`), матиме той самий баг — завжди йти через ці дві функції, ніколи не викликати `minio.presignedGetObject`/`minio.presignedPutObject` напряму в інших модулях.

---

### 10. Pandoc CLI-аргументи з кирилицею → U+FFFD (гарбл) у назві/авторі EPUB

**Симптом**: "Читати уривок" на сторінці книги показує ромбики-знаки питання (◆?) замість назви й імені автора; сам текст книги (body) рендериться нормально.

**Причина**: `generate-epub.ts` передає `--metadata title="${title}"` / `--metadata author="${author}"` як CLI-аргументи в `pandoc` (Haskell/GHC-бінарник). GHC декодує `argv` через локаль процесу (`LANG`/`LC_ALL`); `ubuntu:22.04`-контейнер воркера не мав жодної локалі виставленою. Текст самого docx (читається як байти файлу, кодування вказане в самому XML) цією проблемою не зачіпається — тільки CLI-аргументи.

**Рішення**: `ENV LANG=C.UTF-8` + `ENV LC_ALL=C.UTF-8` в `apps/worker/Dockerfile` — glibc в Ubuntu 22.04+ має локаль `C.UTF-8` з коробки, окремий пакет `locales` не потрібен.

**Правило**: будь-яка команда, що передає кирилицю/не-ASCII текст як CLI-аргумент (а не через вміст файлу) якомусь Haskell/GHC-інструменту (pandoc і подібні) в цьому контейнері, матиме той самий баг, якщо `LANG`/`LC_ALL` колись прибрати з Dockerfile. Заразом: не будувати shell-команди конкатенацією рядків з даними користувача (title/author тут — і назва книги, і ім'я автора, обидва редаговані користувачем) — використовувати `execFileSync`/`spawnSync` з масивом аргументів, а не `execSync` з рядком через shell.

---

### 11. `position: sticky` предок ловить `fixed z-50`-модалку нижче сайтового хедера

**Симптом**: кнопка "✕ Закрити" в EPUB-рідері уривка є в DOM (видно через accessibility tree / клік по ref спрацьовує в аудит-логах), але візуально не рендериться і не реагує на клік по реальних координатах — сайтовий хедер лишається "поверх" на тому самому місці.

**Причина**: `position: sticky` **завжди** створює новий stacking context (незалежно від того, чи виставлений `z-index`). `EpubReader` рендерився всередині `<div className="sticky top-20">` на сторінці книги (обгортка обкладинки + кнопки купівлі) — тож fixed-оверлей рідера (`z-50`) стекався лише ВСЕРЕДИНІ цього stacking context, а сам контекст, не маючи власного z-index вище хедерового, програвав сайтовому `<header className="sticky top-0 z-40">` на верхньому рівні.

**Рішення**: рідер рендериться через `createPortal(<EpubReaderInner .../>, document.body)` — уникає ЦІЄЇ конкретної пастки і будь-якої майбутньої, спричиненої іншими предками зі своїм stacking context (transform/filter/opacity<1/isolate теж це роблять).

**Правило**: будь-яка нова fixed/modal-подібна компонента, що рендериться НЕ через портал у `document.body`, а інлайново глибоко в дереві сторінки — ризикує тим самим багом, якщо якийсь предок (навіть майбутній, доданий пізніше) отримає `sticky`/`transform`/`filter`/`opacity<1`. За замовчуванням — портал.

---

### 12. BullMQ: повторний `add()` з тим самим `jobId` мовчки не запускає нову джобу

**Симптом**: повторний імпорт рукопису (кнопка "Перезавантажити" в редакторі) зависає назавжди — фронтенд опитує `GET /api/books/:id/manuscript` щосекунди, завжди отримує `PROCESSING`, лічильник секунд росте без кінця. У логах `knyha-worker` — жодного запису про нову джобу.

**Причина**: `GET /api/books/:id/manuscript` ставить `MANUSCRIPT_IMPORT` у чергу з детермінованим `jobId: manuscript-${id}`, коли `manuscriptImportedAt` дорівнює `null`. `POST /manuscript/reimport` скидає `manuscriptImportedAt` в `null`, щоб тригернути новий імпорт — але новий запит використовує ТОЙ САМИЙ jobId, що й перший (давно завершений) імпорт. BullMQ `Queue.add()` з jobId, який уже існує в Redis (completed-джоби лишаються там, поки не перевищено `removeOnComplete`-ліміт), мовчки повертає посилання на стару джобу замість створення нової — без помилки, без нового запуску воркера.

**Рішення**: перед `add()` — `getJob(jobId)`, і якщо стан `completed`/`failed`, викликати `.remove()` перед повторним `add()`. Якщо стан `active`/`waiting`/`delayed` — лишити як є (не дублювати роботу, що вже виконується).

**Правило**: будь-який НОВИЙ `bookQueue.add(..., { jobId: детермінований-з-entity-id })`, який може бути повторно викликаний для ТІЄЇ САМОЇ сутності (не лише manuscript-import — той самий патерн є в `pages.ts` з `jobId: pages-${id}`), матиме той самий баг, якщо є шлях повторного тригера вже завершеної джоби. Перевіряти й чистити стару джобу перед `add()`, а не покладатись на дефолтну поведінку BullMQ.

**Важливо для діагностики**: після ручного виправлення в проді (видалення застряглої джоби через `docker exec knyha-worker node -e "..."` з BullMQ `Queue`) — НЕ деплоїти вручну одразу після; якщо push уже стався, CI (`deploy.sh`, `concurrency: production-deploy`) або вже задеплоїв, або ще деплоїть, і паралельний ручний `docker compose up -d --build` б'ється з ним за імена контейнерів (спостерігалось: `knyha-api`/`knyha-worker` лишились пересозданими з хеш-префіксними іменами, короткий даунтайм, відновлено вручну `--force-recreate`). Довіряти автодеплою CI.

---

### 13. `react/no-unescaped-entities` ламає `next build` → `web` (і разом з ним `api`+`worker`) мовчки не деплояться

**Симптом**: ціла сесія комітів (`feat:`/`fix:`) успішно проходить `git push` і `CI` (зелений ✅ в GitHub), але жодна зміна не з'являється на проді — ні у веб-частині (кнопки, wizard, dashboard), ні навіть у **воркері** (наприклад, імпорт зображень у редактор рукопису, код якого вже давно в репозиторії й ніяк не змінювався). `knyha-web`/`knyha-worker` контейнери на VPS лишаються зі старим `Created`-таймстемпом, набагато старішим за останні коміти — жодних видимих помилок ні в `docker logs`, ні в GitHub Actions UI для `CI`.

**Причина**: `apps/web` містить українські JSX-рядки з нееекранованим апострофом/лапками (`м'яка`, `Ім'я`, `з'являться`, `«Умови»` тощо) у кількох файлах (`BookCard.tsx`, `BookDashboard.tsx`, `ContractText.tsx`, `ManuscriptEditor.tsx`, кілька `page.tsx`). Правило `react/no-unescaped-entities` в `eslint-config-next` має severity `error`, а `next build` **завжди** запускає ESLint і провалюється (exit code 1), якщо є хоч одна `error`-помилка — це відбувається ПІСЛЯ "✓ Compiled successfully", на кроці "Linting and checking validity of types". `pnpm lint` в `ci.yml` має `continue-on-error: true`, тож `CI`-джоба цього не ловить і показує зелений статус. Але `infra/scripts/deploy.sh` на VPS виконує РЕАЛЬНИЙ `docker compose --project-name knyha -f infra/docker-compose.prod.yml up -d --build --remove-orphans api web worker` — без жодного `continue-on-error`. Коли Docker-збірка сервісу `web` (яка усередині виконує `pnpm --filter web build`) падає, `docker compose up --build` для БАГАТЬОХ сервісів разом абортується цілком, до перестворення хоч одного контейнера — тобто падіння лише `web` заодно "заморожує" й `api`, і `worker`, хоча в них самих жодної помилки немає (`api`/`worker` не запускають ESLint узагалі, лише `tsc`).

**Рішення**: замінити всі нееекрановані `'`/`"` в JSX-тексті на `&apos;`/`&quot;` (суто заміна символів, без зміни поведінки). Перевіряти РЕАЛЬНОЮ командою збірки перед пушем — `pnpm --filter web build` (не `next lint`, не `tsc --noEmit`: жодне з них двох саме по собі не відтворює цю помилку — `tsc` не бачить ESLint-правил, а голий `eslint`/`next lint` не завжди явно показує, що саме ЦЕ й провалить `next build`).

**Правило**: будь-який НОВИЙ україномовний текст у JSX з апострофом (дуже частий випадок — присвійні форми, скорочення) чи прямими лапками матиме той самий баг. Перед `git push`, якщо змінювався `apps/web`, запускати `pnpm --filter web build` локально (не тільки `typecheck`/`lint`) — це єдина команда, що на 100% відтворює те, що реально виконає `deploy.sh` на VPS. Якщо `web` колись знову "тихо" перестане деплоїтись — перше, що перевіряти, це `ssh knyha "docker inspect knyha-web --format '{{.Created}}'"` і порівнювати з часом останніх комітів, а не шукати баг у коді фічі, яка "нібито не працює" (код фічі може бути повністю правильним і просто ніколи не докочуватись).

---

### 14. `require("shared-types")` у `api`/`worker` — сирий TypeScript у Docker-рантаймі, і pnpm-симлінк не в одному місці

**Симптом (варіант А, `api`)**: `knyha-api` контейнер рестартує одразу після старту. В логах:
```
Error: Cannot find module 'shared-types'
    at Object.<anonymous> (/app/dist/modules/books/book.js:6:24)
```

**Симптом (варіант Б, `worker`)**: `knyha-worker` контейнер рестартує. Docker-збірка проходить УСПІШНО (`docker compose build worker` не падає), і навіть `docker run --rm knyha-worker weasyprint --version` працює — але сам застосунок падає одразу при старті:
```
file:///app/packages/shared-types/src/index.ts:5
export type Role = "AUTHOR" | "ADMIN";
^^^^^^
SyntaxError: Unexpected token 'export'
    at Object.<anonymous> (/app/apps/worker/dist/jobs/generate-pdf-print.js:11:24)
```

**Причина**: `packages/shared-types/package.json` навмисно має `"main": "./src/index.ts"` (сирий TS, без збірки) — це працює для `apps/web`, бо Next.js/webpack резолвить TS напряму. Але `apps/api`/`apps/worker` компілюються звичайним `tsc` (не бандлером) — `require("shared-types")` лишається зовнішнім, нерозгорнутим викликом у скомпільованому JS, і плаский Node не вміє виконати `.ts`-файл напряму.
- **Варіант А**: multi-stage `apps/api/Dockerfile` копіював у runtime-стадію лише `apps/api/dist` + `node_modules` — сам каталог `packages/` (ціль pnpm-симлінка `node_modules/shared-types`) у фінальний образ не потрапляв узагалі, симлінк "висів у порожнечі".
- **Варіант Б**: `apps/worker/Dockerfile` — одностадійний, `packages/shared-types` присутній, і символьне посилання ЗАМІНЮЄТЬСЯ на CJS-збірку (`tsc -p tsconfig.cjs.json`) — але pnpm створює symlink `node_modules/shared-types` на **кожному рівні**, що оголошує цю залежність, не лише в кореневому `node_modules/`. Реально існують ОБИДВА: `/app/node_modules/shared-types` **і** `/app/apps/worker/node_modules/shared-types` (обидва → `packages/shared-types`, сирий `.ts`). Node резолвить `require()` від каталогу файлу, що робить виклик, вгору по дереву — тож вкладений симлінк під `apps/worker/` знаходиться ПЕРШИМ і перемагає кореневий, навіть якщо кореневий уже виправлено.

**Рішення**:
1. Дати `packages/shared-types` окремий CJS-білд: `tsconfig.cjs.json` (`module: commonjs`, `outDir: dist-cjs`) + виклик напряму (`pnpm --filter shared-types exec tsc -p tsconfig.cjs.json`), не через package.json-скрипт — щоб не чіпати публічний `main`/`exports` пакета (`apps/web` лишається на сирому TS, як і задумано).
2. `api`: додати `COPY --from=builder /app/packages/shared-types/dist-cjs ./node_modules/shared-types` у runtime-стадію (після `rm -f` дірявого симлінка).
3. `worker`: НЕ хардкодити один шлях. Знайти й замінити **всі** такі симлінки:
   ```dockerfile
   RUN find /app -type l -path '*/node_modules/shared-types' -print0 \
       | xargs -0 -I{} sh -c 'rm -f "{}" && cp -r /app/packages/shared-types/dist-cjs "{}"'
   ```

**Правило**: якщо будь-який НОВИЙ файл в `apps/api`/`apps/worker` починає імпортувати щось із `shared-types` (пакет без власної збірки), обидва Dockerfile треба звірити з цим патерном. **Перевіряти не лише `docker ... build` (успішна збірка НІЧОГО не каже про рантайм-помилку резолву модуля) і не лише `weasyprint --version`/подібні бінарники всередині контейнера** — а РЕАЛЬНИЙ запуск `node apps/worker/dist/index.js` (чи еквівалент для `api`) проти справжньої мережі (`docker run --network <compose-мережа> ...`). Саме такий запуск і зловив варіант Б — перевірка "чи існує файл" (`ls`/`require.resolve` з кореня `/app`) його пропустила, бо тестувала резолюцію не з того каталогу, з якого реально викликає застосунок.

---

### 15. `next build` НЕ ловить усі TypeScript-помилки, які ловить `tsc --noEmit` — CI `typecheck` впав, `next build` пройшов

**Симптом**: `git push` пройшов, локальний `pnpm --filter web build` (правило журналу #13) виконався БЕЗ помилок — але CI (`.github/workflows/ci.yml`, крок `pnpm typecheck` → `turbo typecheck` → `tsc --noEmit` в кожному пакеті) впав з `Property 'status' does not exist on type 'Book'.`, і деплой не відбувся взагалі (`deploy.yml`: `if: github.event.workflow_run.conclusion == 'success'` — CI не success → job деплою одразу `Skipped`, ніякого білда/SSH не було). GitHub Actions показав це в "Annotations", не в основному логі — легко пропустити, якщо дивитись тільки на статус run'у ("Deploy #228 completed, 3s" виглядає як "все ок", а не як явний сигнал "нічого не задеплоїлось").

**Причина**: `next build` теж типчекає проєкт, але не 1-в-1 еквівалентно голому `tsc --noEmit` — конкретний випадок: локальний `interface Book` на сторінці (`apps/web/app/admin/books/[id]/distribute/page.tsx`) не мав поля `status`, хоч API його завжди повертає; новий код прочитав `book.status` — `next build` це не підняв як фатальну помилку, а окремий `tsc --noEmit` (через `turbo typecheck`) підняв.

**Рішення**: додано відсутнє поле `status: string;` в `Book` interface.

**Правило**: перед `git push`, якщо змінювався `apps/web` (доповнення до правила журналу #13, не заміна) — окрім `pnpm --filter web build`, ще й ганяти `pnpm typecheck` (кореневий `turbo typecheck`, той самий, що й CI) — вони ловлять РІЗНІ підмножини помилок, жоден не покриває інший повністю. Якщо після пушу `Deploy to Production` завершується за секунди ("completed"/"Skipped", а не реальні хвилини SSH+docker build) — це і є сигнал "CI не success, деплой пропущено", перевіряти вкладку **Annotations** конкретного CI run, не сам факт "run completed".

---

### 16. `timeout-minutes: 10` на кроці "Deploy via SSH" вбиває `docker compose up --build` посеред пересоздання контейнерів → 502 без жодної помилки в коді

**Симптом**: `git push` пройшов, CI (`ci.yml`) зелений, "Deploy to Production" — `conclusion: failure`, сайт віддає 502. `docker compose ... ps` на VPS показує, що `knyha-api`/`knyha-web`/`knyha-worker` ВІДСУТНІ в списку контейнерів взагалі (не "exited", а не існують) — лише `postgres`/`redis`/`minio`/моніторинг лишились. Ручна збірка кожного образу окремо (`docker compose build web`, `build api`, `build worker`) на VPS проходить БЕЗ жодної помилки — код чистий.

**Причина**: `.github/workflows/deploy.yml`, крок "Deploy via SSH", мав `timeout-minutes: 10`. `infra/scripts/deploy.sh` виконує послідовно: DB backup → `docker compose up -d --build api web worker` (один `bake`-виклик, але без прогрітого layer-кешу збірка `worker` сама займає ~450с через `apt-get install libreoffice pandoc calibre ...`, `api` ~80с, `web` ~72с) → health-check. Без кешу сумарний час стабільно впирається в 10-хвилинну межу. GitHub Actions вбиває SSH-крок рівно на позначці таймауту — **всередині** `docker compose up --build`, яке вже встигло зупинити старі `api`/`web`/`worker` для пересоздання (bake будує всі образи одним викликом, а `up` застосовує їх послідовно), але вбитий процес так і не встиг запустити нові контейнери. Продакшн лишається без цих трьох сервісів — 502 — хоча жодного багу в самому коммiті немає.

**Рішення**: підняти `timeout-minutes` з 10 до 20 в `.github/workflows/deploy.yml`, щоб холодна збірка (без кешу) мала запас. Відновлення продакшну: якщо жоден CI-ран не виконується паралельно (перевірити через Actions API, [[reference_github_actions_status_check]]), просто повторно прогнати `bash infra/scripts/deploy.sh` вручну на VPS — образи вже частково/повністю зібрані з попередньої спроби, тож повторний прогін використовує Docker layer cache і завершується за 1-2 хв.

**Правило**: якщо `Deploy to Production` падає з `conclusion: failure` (не `Skipped` — це означає CI сам не пройшов, див. журнал #15) — перше, що перевіряти, це тривалість кроку "Deploy via SSH" в Annotations/логах run'у: тривалість, що впритул підходить до `timeout-minutes`, означає таймаут, а не помилку коду. Не витрачати час на пошук бага в останньому коммiті, поки не виключений таймаут — спроба відтворити збірку вручну (`docker compose build <service>`) швидко підтверджує/спростовує це. Якщо образи важчатимуть далі (`worker` вже 6.6GB) — може знадобитись піднімати ліміт ще раз або перейти на прогрітий build cache (BuildKit registry cache / `--cache-from`).
