#!/bin/bash
# deploy.sh — розгортання нової версії на VPS
# Викликається з GitHub Actions через SSH
set -euo pipefail

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "[$(date)] Knyha Deploy — start"

# 1. Pull latest code
git fetch origin main
git reset --hard origin/main

# 2. Build and restart services (Docker handles build + migrations internally)
set -a; source "$APP_DIR/.env.production"; set +a
DC="docker compose --project-name knyha -f infra/docker-compose.prod.yml"

$DC up -d --build --remove-orphans api web worker

echo "[$(date)] Containers started, waiting 15s for health checks..."
sleep 15

# 3. Smoke test — verify API is responding
if curl -sf "http://localhost:3001/api/health" > /dev/null; then
  echo "[$(date)] ✓ API health check passed"
else
  echo "[$(date)] ✗ API health check FAILED — check logs:"
  docker logs knyha-api --tail=30
  exit 1
fi

echo "[$(date)] Deploy complete."
$DC ps --format "table {{.Service}}\t{{.Status}}"
