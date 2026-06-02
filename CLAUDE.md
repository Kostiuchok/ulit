# CLAUDE.md — Knyha Platform

> Платформа самовидавництва для українських авторів. Аналог Ridero.
> Автор завантажує книгу → ISBN → публікує у електронному та/або друкованому форматі → магазин + зовнішні сервіси.
> **Прототип:** `knyha-complete.html` — 24 екрани (автор + адмін + договір + KU-вибір)

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
├── knyha-complete.html              # Повний прототип (24 екрани)
├── CLAUDE.md                        # ← цей файл
├── TASKS.md
├── TECHNICAL-DECISIONS.md           # Wiki рішень (юридика, дистрибуція, договір)
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
