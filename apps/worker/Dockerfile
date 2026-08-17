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
# version. apt libs verified 2026-08-17 by actually building this exact list
# in a throwaway `ubuntu:22.04` container on the VPS (real target
# environment) -- an earlier draft mixed in libharfbuzz-subset0 from
# WeasyPrint's Debian install docs, which doesn't exist as a package on
# Ubuntu jammy at all (apt-get fails outright); Ubuntu's own docs list
# libharfbuzz0b instead. Also confirmed there: `pip3 install weasyprint`
# installs cleanly from wheels (no compiler toolchain pulled in), and a
# break-before:recto test document rendered to the correct page count.
# libcairo2/libgdk-pixbuf2.0-0/shared-mime-info/fonts-dejavu are extras
# beyond WeasyPrint's own minimal list (embedded-image rendering and actual
# glyphs to draw -- ubuntu:22.04 ships no fonts at all otherwise), kept since
# they're low-cost and plausibly load-bearing for real manuscript content.
RUN apt-get update && apt-get install -y \
    curl libreoffice pandoc ghostscript calibre redis-tools unzip \
    python3-pip libpango-1.0-0 libharfbuzz0b libpangoft2-1.0-0 \
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
#
# pnpm creates a node_modules/shared-types symlink at EVERY level that
# depends on it, not just the workspace root -- confirmed here at both
# /app/node_modules/shared-types AND /app/apps/worker/node_modules/shared-types
# (both -> packages/shared-types, i.e. raw .ts). Node's require() resolution
# walks up from the requiring file's own directory, so the nested one under
# apps/worker/ is found FIRST and wins over the root one -- swapping only the
# root symlink (as this line originally did) left the nested one dangling at
# the raw TS source, which crashed generate-pdf-print.js at runtime
# ("Unexpected token 'export'") despite the build itself succeeding and
# `weasyprint --version` working. `find` catches every such symlink,
# wherever pnpm put one, instead of hardcoding each path.
RUN pnpm --filter shared-types build:cjs
RUN find /app -type l -path '*/node_modules/shared-types' -print0 \
    | xargs -0 -I{} sh -c 'rm -f "{}" && cp -r /app/packages/shared-types/dist-cjs "{}"'

CMD ["node", "apps/worker/dist/index.js"]
