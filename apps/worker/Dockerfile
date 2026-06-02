FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# System deps: LibreOffice, Pandoc, Ghostscript, Calibre, Node 20
RUN apt-get update && apt-get install -y \
    curl libreoffice pandoc ghostscript calibre \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@9 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install workspace deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter worker...

# Copy source + prisma schema (worker references apps/api/prisma/schema.prisma)
COPY apps/worker ./apps/worker
COPY apps/api/prisma ./apps/api/prisma
COPY packages/shared-types ./packages/shared-types
# Generate prisma client from api dir (schema lives there — avoids auto-install confusion)
RUN cd apps/api && ../../node_modules/.bin/prisma generate
RUN pnpm --filter worker build

CMD ["node", "apps/worker/dist/index.js"]
