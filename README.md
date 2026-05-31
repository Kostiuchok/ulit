# 📚 Knyha Platform

> Платформа самовидавництва для українських авторів.  
> Автор завантажує рукопис → отримує ISBN → публікує електронну та друковану книгу → продає через власний магазин і зовнішні сервіси (Amazon, Apple Books, Kobo та ін.)

---

## 🚀 Технологічний стек

| Шар | Технологія |
|-----|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Node.js 20 + TypeScript + Fastify |
| База даних | PostgreSQL 16 + Redis 7 |
| Конвертація | LibreOffice · Pandoc · Ghostscript · Calibre |
| Черга | BullMQ + Redis |
| Storage | MinIO (self-hosted S3) |
| Auth | NextAuth.js v5 (Google OAuth + Email) |
| Платежі | LiqPay (UA) · Stripe (міжнародні) |
| Інфра | Docker + Nginx + Certbot · GitHub Actions CI/CD |

---

## 📁 Структура монорепо

```
knyha-platform/
├── apps/
│   ├── web/        # Next.js 14 frontend
│   ├── api/        # Fastify backend
│   └── worker/     # Ubuntu 22.04 + LibreOffice + Pandoc + Ghostscript + Calibre
├── packages/
│   └── shared-types/
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
├── docs/
│   ├── knyha-complete.html   # Повний прототип (24 екрани)
│   ├── TECHNICAL-DECISIONS.md
│   └── TASKS.md
├── CLAUDE.md
├── turbo.json
└── package.json
```

---

## ⚡ Швидкий старт (локально)

### Вимоги
- Node.js 20+
- Docker + Docker Compose
- pnpm 9+

### 1. Клонувати та встановити залежності

```bash
git clone https://github.com/YOUR_ORG/knyha-platform.git
cd knyha-platform
pnpm install
```

### 2. Налаштувати змінні середовища

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Заповнити .env файли (дивись секцію нижче)
```

### 3. Запустити інфраструктуру (PostgreSQL + Redis + MinIO)

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 4. Міграції та seed

```bash
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

### 5. Запустити dev сервери

```bash
pnpm dev
# web  → http://localhost:3000
# api  → http://localhost:3001
# minio → http://localhost:9001 (admin UI)
```

---

## ⚙️ Змінні середовища

### `apps/api/.env`

```env
DATABASE_URL="postgresql://knyha:knyha@localhost:5432/knyha"
REDIS_URL="redis://localhost:6379"

MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET_NAME="knyha-books"

NEXTAUTH_SECRET="change-me-in-production"
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

### `apps/web/.env`

```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me-in-production"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## 🗂️ Документація

| Файл | Опис |
|------|------|
| [`CLAUDE.md`](./CLAUDE.md) | Архітектура, стек, схема БД, API routes — для Claude Code |
| [`docs/TASKS.md`](./docs/TASKS.md) | ~140 задач по 14 фазах розробки |
| [`docs/TECHNICAL-DECISIONS.md`](./docs/TECHNICAL-DECISIONS.md) | Wiki рішень: юридика, договір з автором, дистрибуція |
| [`docs/knyha-complete.html`](./docs/knyha-complete.html) | Повний UI прототип (24 екрани, відкрити у браузері) |

---

## 🔄 Git workflow

```
main          — стабільна гілка, захищена
dev           — інтеграційна гілка
feat/<id>-name — фіча (від dev)
fix/<id>-name  — баг-фікс (від dev)
```

**Коміти:** Conventional Commits  
`feat:` · `fix:` · `chore:` · `docs:` · `refactor:`

---

## 📋 Roadmap (фази)

- **Фаза 0–2** — Monorepo, auth, профіль автора
- **Фаза 3–5** — Dashboard, конвертація, редактор обкладинки
- **Фаза 6–7** — KU/Wide вибір, ISBN, публікація
- **Фаза 8–9** — Магазин, оплата LiqPay
- **Фаза 10** — Preview/уривок
- **Фаза 11–12** — Адмін-панель, юридика
- **Фаза 13–14** — Деплой, тести

Детально → [`docs/TASKS.md`](./docs/TASKS.md)

---

## 📜 Ліцензія

Приватний репозиторій. Всі права захищені.
