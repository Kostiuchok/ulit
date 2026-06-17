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
- Nginx reverse proxy + Certbot (Let's Encrypt)
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
git reset --hard origin/claude/git-setup-hetzner-deploy-USPFg
```
**Рішення локально** (якщо є конфлікти після rebase --abort):
```bash
git rebase --abort
git checkout origin/<branch> -- apps/api/package.json pnpm-lock.yaml
```
