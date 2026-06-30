#!/bin/bash
# backup-db.sh — щоденний бекап PostgreSQL → MinIO
# Викликати через cron: 0 3 * * * /opt/knyha-platform/infra/scripts/backup-db.sh >> /var/log/knyha-backup.log 2>&1
set -euo pipefail

APP_DIR="/opt/knyha-platform"
ENV_FILE="$APP_DIR/.env.production"

# Load env
set -a; source "$ENV_FILE"; set +a

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/knyha-db-${TIMESTAMP}.sql.gz"
BUCKET="${MINIO_BUCKET_NAME:-knyha-books}"
OBJECT_PATH="backups/db-${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting PostgreSQL backup..."

# Dump + compress
docker exec knyha-postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  | gzip > "$BACKUP_FILE"

echo "[$(date)] Dump complete: $(du -sh "$BACKUP_FILE" | cut -f1)"

# Upload to MinIO via mc (MinIO Client)
if ! command -v mc &>/dev/null; then
  echo "[$(date)] mc not installed — downloading..."
  curl -fsSL "https://dl.min.io/client/mc/release/linux-amd64/mc" -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
fi

# Resolve MinIO endpoint: use container IP when MINIO_ENDPOINT is a Docker service name
# (Docker DNS names are only resolvable inside containers, not from the host)
MINIO_HOST="${MINIO_ENDPOINT:-localhost}"
if ! echo "$MINIO_HOST" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$|^localhost$|^127\.'; then
  # Looks like a Docker service name — resolve to container IP
  MINIO_HOST=$(docker inspect "knyha-minio-1" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "localhost")
fi

mc alias set knyha \
  "http://${MINIO_HOST}:${MINIO_PORT:-9000}" \
  "${MINIO_ACCESS_KEY}" \
  "${MINIO_SECRET_KEY}" \
  --quiet

mc cp "$BACKUP_FILE" "knyha/${BUCKET}/${OBJECT_PATH}" --quiet

echo "[$(date)] Uploaded to minio://${BUCKET}/${OBJECT_PATH}"

# Cleanup local file
rm -f "$BACKUP_FILE"

# Prune backups older than 30 days
mc rm --recursive --force --older-than 30d "knyha/${BUCKET}/backups/" --quiet 2>/dev/null || true

echo "[$(date)] Backup complete."
