#!/bin/bash
set -euo pipefail

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "[$(date)] Knyha Deploy — start"

git fetch origin main
git reset --hard origin/main

set -a; source "$APP_DIR/.env.production"; set +a
DC="docker compose --project-name knyha -f infra/docker-compose.prod.yml"

echo "[$(date)] Running pre-deploy DB backup..."
bash "$APP_DIR/infra/scripts/backup-db.sh"
echo "[$(date)] DB backup complete."

$DC up -d --build --remove-orphans api web worker

echo "[$(date)] Containers started, waiting 20s..."
sleep 20

HEALTH=$(docker exec knyha-api node -e \
  "const h=require('http');h.get('http://127.0.0.1:3001/api/health',(r)=>console.log(r.statusCode)).on('error',()=>console.log('ERR'))" 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
  echo "[$(date)] ✓ API health check passed (status: $HEALTH)"
else
  echo "[$(date)] ✗ API health check FAILED (status: $HEALTH) — logs:"
  docker logs knyha-api --tail=20
  exit 1
fi

echo "[$(date)] Deploy complete."
$DC ps --format "table {{.Service}}\t{{.Status}}"
