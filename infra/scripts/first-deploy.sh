#!/bin/bash
# first-deploy.sh — Перший запуск платформи
set -e

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "🚀 Knyha — Перший деплой"
echo "========================="

[ ! -f ".env.production" ] && echo "❌ .env.production не знайдено!" && exit 1

echo "[1/3] Запуск інфраструктури (postgres, redis, minio)..."
docker compose -f infra/docker-compose.prod.yml up -d postgres redis minio

echo "Чекаємо поки сервіси стануть healthy..."
sleep 15

echo "[2/3] Збірка та запуск (перший раз займає 5-10 хв)..."
docker compose -f infra/docker-compose.prod.yml up -d --build api web worker node-exporter prometheus grafana

echo "[3/3] Статус:"
sleep 5
docker compose -f infra/docker-compose.prod.yml ps

echo ""
echo "✅ Готово! https://ulit.render.ua"
echo "Логи: docker compose -f infra/docker-compose.prod.yml logs api -f"
