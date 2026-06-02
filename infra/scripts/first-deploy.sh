#!/bin/bash
# first-deploy.sh — Перший запуск платформи
set -e

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "🚀 Knyha — Перший деплой"
echo "========================="

[ ! -f ".env.production" ] && echo "❌ .env.production не знайдено!" && exit 1

# Export vars into the shell so docker compose can interpolate ${VAR} in the compose file
set -a
# shellcheck source=.env.production
source "$APP_DIR/.env.production"
set +a

DC="docker compose --project-name knyha -f infra/docker-compose.prod.yml"

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
