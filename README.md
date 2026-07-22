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

## ⚙️ Setup (локальна машина)

> **Docker локально не потрібен.** Postgres/Redis/MinIO існують лише на VPS
> (`infra/docker-compose.prod.yml`). Локально код лише редагується,
> лінтиться, типчекається і покривається unit-тестами — жива інфраструктура
> (БД, файлове сховище, конвертація документів) є тільки в проді.

### Вимоги
- Node.js 20+
- pnpm 9+

### 1. Клонувати та встановити залежності

```bash
git clone https://github.com/YOUR_ORG/knyha-platform.git
cd knyha-platform
pnpm install
```

### 2. Локальні перевірки

```bash
pnpm lint
pnpm typecheck
pnpm --filter api test      # unit-тести API (без реальної БД)
```

### 3. UI без бекенду (опційно)

```bash
pnpm --filter web dev
# web → http://localhost:3000
```
Працює для верстки/UI-компонентів. Функції, що потребують API/БД/файлів
(публікація книги, оплата, дистрибуція), локально не спрацюють — для цього
є VPS.

---

## 🔄 Git workflow / метод роботи

Розробка йде **не** через локальний docker-compose стек, а через пряму
CI/CD-петлю на VPS:

```
main           — стабільна гілка, захищена, автодеплой на VPS
dev            — інтеграційна гілка (тільки CI, без деплою)
feat/<id>-name — фіча (від dev)
fix/<id>-name  — баг-фікс (від dev)
```

**Коміти:** Conventional Commits — `feat:` · `fix:` · `chore:` · `docs:` · `refactor:`

```
1. git checkout -b feat/<id>-name   (від dev)
2. Редагуєш код, локально: pnpm lint / pnpm typecheck / pnpm --filter api test
3. git push → PR у GitHub
4. CI (.github/workflows/ci.yml) на push/PR у main/dev:
   lint → typecheck → unit-тести API
5. Merge у main
6. CI знову проганяється на main → якщо success:
   .github/workflows/deploy.yml автоматично по SSH деплоїть
   на VPS (178.105.208.56, /opt/knyha-platform), rebuild контейнерів
7. E2E-тести (той самий CI, job `e2e`) ганяються вже
   проти прод-URL https://ulit.render.ua, а не проти localhost
8. Перевіряєш результат живого деплою на VPS
   (docker logs knyha-api / knyha-web, див. CLAUDE.md → журнал проблем)
```

**Важливо:**
- Auto-deploy спрацьовує тільки на `main` (branches: `[main]` у
  `deploy.yml`), і тільки якщо CI пройшло успішно.
- `dev` та `feat/*` гілки проходять лише CI (lint/typecheck/unit), без деплою.
- Детальні команди деплою, діагностика контейнерів і журнал вирішених
  production-проблем — у `CLAUDE.md` (розділи "Правила деплою на VPS" і
  "Журнал вирішених проблем").

---

## ⚙️ Змінні середовища

> Значення нижче — з `infra/docker-compose.yml` / dev-профілю, актуальні
> лише якщо колись знадобиться підняти Postgres/Redis/MinIO локально.
> Реальні прод-значення живуть у `.env.production` на VPS (не в репо).

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
