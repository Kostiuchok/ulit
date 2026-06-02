# Git + VPS — Покрокова інструкція

## 1. Ініціалізація локального репо і перший push

```bash
# В папці проекту (на вашому комп'ютері або VPS)
cd knyha-platform

git init
git add .
git commit -m "feat: initial project structure"

git remote add origin https://github.com/YOUR_ORG/knyha-platform.git
git branch -M main
git push -u origin main
```

---

## 2. Налаштування VPS (перший раз)

```bash
# Зайти на VPS
ssh root@YOUR_VPS_IP

# Скачати і запустити скрипт налаштування
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/knyha-platform/main/infra/scripts/setup-vps.sh | \
  bash -s https://github.com/YOUR_ORG/knyha-platform.git
```

---

## 3. Production .env

```bash
# На VPS
cd /opt/knyha-platform
cp .env.example .env.production
nano .env.production   # заповнити всі CHANGE_ME значення

# Згенерувати NEXTAUTH_SECRET:
openssl rand -base64 32
```

---

## 4. SSL сертифікат

```bash
# DNS knyha.ua → IP вашого VPS вже повинен бути налаштований
bash /opt/knyha-platform/infra/scripts/ssl.sh knyha.ua admin@knyha.ua
```

---

## 5. Перший запуск платформи

```bash
bash /opt/knyha-platform/infra/scripts/first-deploy.sh
```

---

## 6. GitHub Actions — Secrets для автодеплою

В репозиторії → Settings → Secrets and variables → Actions:

| Secret | Значення |
|--------|----------|
| `VPS_HOST` | IP адреса VPS |
| `VPS_USER` | `knyha` (або `root`) |
| `VPS_SSH_KEY` | Приватний SSH ключ (`cat ~/.ssh/id_rsa`) |
| `VPS_PORT` | `22` (або інший якщо змінили) |

Після цього кожен push в `main` → автоматичний деплой.

---

## 7. Корисні команди на VPS

```bash
# Стан контейнерів
docker compose -f /opt/knyha-platform/infra/docker-compose.prod.yml ps

# Логи (всі)
docker compose -f /opt/knyha-platform/infra/docker-compose.prod.yml logs -f

# Логи конкретного сервісу
docker compose -f /opt/knyha-platform/infra/docker-compose.prod.yml logs -f api

# Перезапустити сервіс
docker compose -f /opt/knyha-platform/infra/docker-compose.prod.yml restart api

# Зайти в контейнер
docker compose -f /opt/knyha-platform/infra/docker-compose.prod.yml exec api sh

# MinIO UI (через SSH tunnel)
ssh -L 9001:localhost:9001 knyha@YOUR_VPS_IP
# Відкрити: http://localhost:9001
```

---

## 8. Налаштування щоденного бекапу

```bash
# На VPS
crontab -e
# Додати:
0 2 * * * bash /opt/knyha-platform/infra/scripts/backup-db.sh >> /var/log/knyha-backup.log 2>&1
```
