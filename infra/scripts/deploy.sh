#!/bin/bash
# deploy.sh — розгортання нової версії на VPS
# Викликається з GitHub Actions через SSH
set -euo pipefail

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "[$(date)] Knyha Deploy — start"

# 1. Pull latest
git fetch origin main
git reset --hard origin/main

# 2. Dependencies
pnpm install --frozen-lockfile

# 3. Build
pnpm build

# 4. DB migrations
pnpm --filter api db:migrate:prod

# 5. Rolling restart (zero-downtime for stateless services)
DC="docker compose -f infra/docker-compose.prod.yml --project-directory $APP_DIR"
$DC pull 2>/dev/null || true
$DC up -d --build --remove-orphans api web worker

echo "[$(date)] Deploy complete."
$DC ps --format "table {{.Service}}\t{{.Status}}"
