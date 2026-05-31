#!/bin/bash
# first-deploy.sh — Перший запуск платформи
set -e

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "🚀 Knyha — Перший деплой"
echo "========================="

[ ! -f ".env.production" ] && echo "❌ .env.production не знайдено! cp .env.example .env.production" && exit 1

echo "[1/5] Залежності..."
pnpm install --frozen-lockfile

echo "[2/5] Збірка..."
pnpm build

echo "[3/5] Запуск postgres + redis + minio..."
docker compose -f infra/docker-compose.prod.yml up -d postgres redis minio
echo "Чекаємо 20 сек..."
sleep 20

echo "[4/5] Міграції БД..."
pnpm --filter api db:migrate

echo "[5/5] Запуск всіх сервісів..."
docker compose -f infra/docker-compose.prod.yml up -d

echo ""
echo "✅ Платформа запущена!"
docker compose -f infra/docker-compose.prod.yml ps
