FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
# Pandoc (GHC runtime) decodes argv using the process locale -- without a
# UTF-8 locale, non-ASCII CLI args (e.g. --metadata title="...") get mangled
# into U+FFFD even though file-based content (read as bytes) is unaffected.
# glibc ships C.UTF-8 by default since 22.04, no `locales` package needed.
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# System deps: LibreOffice, Pandoc, Ghostscript, Calibre, Node 20
# unzip -- reads word/document.xml straight out of an uploaded .docx to
# recover real Word image wrap-side info Pandoc's own AST drops (see
# apps/worker/src/lib/docxImageAlignment.ts)
RUN apt-get update && apt-get install -y \
    curl libreoffice pandoc ghostscript calibre redis-tools unzip \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@9 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install workspace deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter worker...

# Copy source + prisma schema (worker references apps/api/prisma/schema.prisma)
COPY apps/worker ./apps/worker
COPY apps/api/prisma ./apps/api/prisma
COPY packages/shared-types ./packages/shared-types
RUN node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma
RUN pnpm --filter worker build

CMD ["node", "apps/worker/dist/index.js"]
