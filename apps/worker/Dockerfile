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
#
# WeasyPrint (T-2057, renderManuscriptPdf) -- picked over Puppeteer/Chromium
# specifically for native `break-before/after: recto/verso` support (CSS GCPM,
# see docs/T-2057-checklist.md section 3). Installed via pip for a recent
# version. apt libs cross-checked 2026-08-17 against WeasyPrint's own install
# docs (doc.courtbouillon.org/weasyprint/stable/first_steps.html), Ubuntu
# >=20.04 "with wheels" list specifically (not the Debian list -- Ubuntu
# needs libharfbuzz0b, which an earlier draft of this line, copied from the
# Debian list, omitted). libcairo2/libgdk-pixbuf2.0-0/shared-mime-info/
# fonts-dejavu are extras beyond that minimal list (embedded-image rendering
# and actual glyphs to draw -- ubuntu:22.04 ships no fonts at all otherwise),
# kept since they're low-cost and plausibly load-bearing for real manuscript
# content, not because they're independently confirmed necessary.
# STILL NOT independently verified by actually running it in this exact
# image (no Docker available in the dev environment this was written in).
# First deploy after this change MUST confirm `weasyprint --version` runs and
# that `break-before: recto` actually inserts a blank verso page, the same
# empirical check already done for the Puppeteer alternative (checklist
# section 3) -- do not trust this comment over that live test.
RUN apt-get update && apt-get install -y \
    curl libreoffice pandoc ghostscript calibre redis-tools unzip \
    python3-pip libpango-1.0-0 libharfbuzz0b libpangoft2-1.0-0 libharfbuzz-subset0 \
    libcairo2 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info fonts-dejavu \
    && pip3 install --no-cache-dir weasyprint \
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

# shared-types' package.json "main" points at raw TypeScript (bundler-only --
# fine for apps/web's webpack, unrequireable by plain `node`). Build a
# CommonJS copy for this runtime and swap it in for the workspace symlink,
# same fix as apps/api/Dockerfile. node_modules/shared-types (no package.json
# of its own once swapped) resolves via Node's plain index.js default, since
# tsconfig.cjs.json's outDir mirrors src/ 1:1.
RUN pnpm --filter shared-types build:cjs
RUN rm -f node_modules/shared-types && cp -r packages/shared-types/dist-cjs node_modules/shared-types

CMD ["node", "apps/worker/dist/index.js"]
