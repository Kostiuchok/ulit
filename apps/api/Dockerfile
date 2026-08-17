FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# ─── deps ────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile --filter api...

# ─── build ───────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build
# shared-types' own package.json points "main" at raw TypeScript (bundler-only
# tsconfig, module: ESNext) -- fine for webpack (apps/web) but unrequireable
# by plain Node at runtime. Build a CommonJS copy just for that runtime use
# (invoked directly, not via a package.json script, so this doesn't require
# any change to shared-types' own package.json/public main-exports -- apps/web
# is completely unaffected).
RUN pnpm --filter shared-types exec tsc -p tsconfig.cjs.json

# ─── runtime ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl unzip
RUN npm install -g pnpm@9
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
# node_modules/shared-types is a pnpm workspace symlink to
# ../packages/shared-types, which is TypeScript source -- unrequireable by
# plain Node, and (until now) packages/ wasn't even copied into this stage,
# so the symlink dangled ("Cannot find module 'shared-types'"). Replace it
# with the CommonJS build made in the builder stage above.
RUN rm -f ./node_modules/shared-types
COPY --from=builder /app/packages/shared-types/dist-cjs ./node_modules/shared-types

ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
