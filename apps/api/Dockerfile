FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# ─── deps ────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile --filter api...

# ─── build ───────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types
RUN pnpm --filter api build
RUN pnpm --filter api exec prisma generate

# ─── runtime ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
