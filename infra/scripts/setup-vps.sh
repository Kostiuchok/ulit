#!/bin/bash
# ═══════════════════════════════════════════════════════
# setup-vps.sh — Перший запуск на чистому VPS Ubuntu 22.04
# Запускати від root: bash setup-vps.sh YOUR_GITHUB_REPO_URL
# ═══════════════════════════════════════════════════════
set -e

REPO_URL="${1:-https://github.com/YOUR_ORG/knyha-platform.git}"
APP_DIR="/opt/knyha-platform"
APP_USER="knyha"

echo "🚀 Knyha Platform — VPS Setup"
echo "================================"
echo "Repo: $REPO_URL"
echo ""

# 1. Системні пакети
echo "[1/7] Системні пакети..."
apt-get update -q
apt-get install -y -q git curl wget unzip nginx certbot python3-certbot-nginx ufw fail2ban

# 2. Docker
echo "[2/7] Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
fi

# 3. Node.js 20 + pnpm
echo "[3/7] Node.js 20 + pnpm..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pnpm@9

# 4. Системний користувач
echo "[4/7] Користувач $APP_USER..."
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
  usermod -aG docker "$APP_USER"
fi

# 5. Клонування репо
echo "[5/7] Клонування $REPO_URL → $APP_DIR..."
mkdir -p "$APP_DIR" && chown "$APP_USER:$APP_USER" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
fi

# 6. Firewall
echo "[6/7] UFW firewall..."
ufw --force reset
ufw default deny incoming && ufw default allow outgoing
ufw allow ssh && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# 7. Підсумок
echo ""
echo "✅ Базова підготовка VPS завершена!"
echo ""
echo "Наступні кроки:"
echo "  1. cd $APP_DIR"
echo "  2. cp .env.example .env.production && nano .env.production"
echo "  3. bash infra/scripts/ssl.sh YOUR_DOMAIN YOUR_EMAIL"
echo "  4. bash infra/scripts/first-deploy.sh"
