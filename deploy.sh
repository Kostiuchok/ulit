#!/bin/bash
set -e

REPO="https://github.com/Kostiuchok/ulit.git"
BRANCH="claude/git-setup-hetzner-deploy-USPFg"
DIR="/root/ulit-app"
ENV_FILE="/root/ulit-services/.env"

echo "==> Pulling latest code..."
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$DIR"
fi

echo "==> Setting up environment..."
cd "$DIR"

# Generate JWT_SECRET if not set
if ! grep -q "JWT_SECRET" "$ENV_FILE" 2>/dev/null || grep -q "JWT_SECRET=$" "$ENV_FILE" 2>/dev/null; then
  echo "JWT_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
fi

# Set required defaults if missing
grep -q "ADMIN_EMAIL" "$ENV_FILE" || echo 'ADMIN_EMAIL=admin@ulit.ua' >> "$ENV_FILE"
grep -q "ADMIN_PASSWORD" "$ENV_FILE" || echo 'ADMIN_PASSWORD=admin123' >> "$ENV_FILE"
grep -q "APP_URL" "$ENV_FILE" || echo 'APP_URL=http://178.105.208.56' >> "$ENV_FILE"

# Copy env file
cp "$ENV_FILE" .env.production

echo "==> Building and starting containers..."
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d --build

echo "==> Waiting for database..."
sleep 10

echo "==> Running database migrations..."
docker compose -f docker-compose.production.yml exec app npx prisma db push --skip-generate

echo "==> Seeding admin user..."
docker compose -f docker-compose.production.yml exec app node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@ulit.ua';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) { console.log('Admin already exists:', email); return; }
  const hash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { email, passwordHash: hash, firstName: 'Admin', role: 'SUPER_ADMIN', status: 'ACTIVE' } });
  console.log('Admin created:', email);
}
seed().catch(console.error).finally(() => db.\$disconnect());
"

echo ""
echo "✓ Ulit is running at http://178.105.208.56:3000"
echo "✓ Admin: http://178.105.208.56:3000/admin"
echo "✓ MinIO console: http://178.105.208.56:9001"
