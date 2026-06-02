#!/bin/bash
# first-deploy.sh — Перший запуск платформи
set -e

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "🚀 Knyha — Перший деплой"
echo "========================="

[ ! -f ".env.production" ] && echo "❌ .env.production не знайдено!" && exit 1

# Symlink so docker compose finds vars for interpolation (it looks in infra/ — compose file dir)
ln -sf "$APP_DIR/.env.production" "$APP_DIR/infra/.env"

DC="docker compose -f infra/docker-compose.prod.yml --project-directory $APP_DIR"

echo "[1/3] Запуск інфраструктури (postgres, redis, minio)..."
$DC up -d postgres redis minio

echo "Чекаємо поки сервіси стануть healthy..."
sleep 15

echo "[2/3] Збірка та запуск (перший раз займає 5-10 хв)..."
$DC up -d --build api web worker node-exporter prometheus grafana

echo "[3/3] Статус:"
sleep 5
$DC ps

echo ""
echo "✅ Готово! https://ulit.render.ua"
echo "Логи: docker compose -f infra/docker-compose.prod.yml logs api -f"
