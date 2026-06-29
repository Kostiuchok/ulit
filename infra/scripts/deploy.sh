#!/bin/bash
set -euo pipefail

APP_DIR="/opt/knyha-platform"
cd "$APP_DIR"

echo "[$(date)] Knyha Deploy — start"

git fetch origin main
git reset --hard origin/main

set -a; source "$APP_DIR/.env.production"; set +a
DC="docker compose --project-name knyha -f infra/docker-compose.prod.yml"

$DC up -d --build --remove-orphans api web worker

echo "[$(date)] Containers started, waiting 20s..."
sleep 20

if docker exec knyha-api node -e "const h=require('http');h.get('http://127.0.0.1:3001/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"; then
  echo "[$(date)] ✓ API health check passed"
else
  echo "[$(date)] ✗ API health check FAILED — logs:"
  docker logs knyha-api --tail=20
  exit 1
fi

echo "[$(date)] Deploy complete."
$DC ps --format "table {{.Service}}\t{{.Status}}"
