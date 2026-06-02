#!/bin/bash
# ssl.sh — отримати/поновити Let's Encrypt сертифікат через Certbot
# Запуск: bash ssl.sh knyha.ua admin@knyha.ua
set -euo pipefail

DOMAIN="${1:?Usage: ssl.sh <domain> <email>}"
EMAIL="${2:?Usage: ssl.sh <domain> <email>}"

echo "🔐 Отримуємо SSL сертифікат для $DOMAIN..."

# Stop nginx if running standalone
systemctl stop nginx 2>/dev/null || true

certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --domain "$DOMAIN"

echo "✅ Сертифікат отримано: /etc/letsencrypt/live/$DOMAIN/"

# Patch nginx.conf with domain
sed -i "s/\${DOMAIN}/$DOMAIN/g" /opt/knyha-platform/infra/nginx/nginx.conf

# Setup auto-renew cron (certbot renew + nginx reload)
CRON_LINE="0 2 * * * certbot renew --quiet && docker exec knyha-nginx nginx -s reload"
(crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_LINE") | crontab -

echo "✅ Auto-renew cron встановлено."
