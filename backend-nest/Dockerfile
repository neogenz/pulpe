# Dockerfile optimisé pour Railway - NestJS + pnpm monorepo
# node:24.22.1-slim (LTS) pinné par digest multi-arch — Node 20 est EOL depuis mars 2026.
FROM node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base

# Configuration pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Git est requis uniquement par le postinstall Lefthook du workspace.
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les fichiers de configuration du monorepo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY shared/package.json ./shared/
COPY backend-nest/package.json ./backend-nest/

# Initialiser git pour lefthook puis installer les dépendances
RUN git init && pnpm install --frozen-lockfile

# Build shared package
COPY shared/ ./shared/
WORKDIR /app/shared
RUN pnpm run build

# Build backend avec TypeScript classique (meilleure compatibilité NestJS)
WORKDIR /app
COPY backend-nest/ ./backend-nest/
WORKDIR /app/backend-nest
RUN npx nest build

# Deploy stage - Créer un artifact minimal pour production
FROM base AS deploy
RUN pnpm --filter=backend-nest --prod deploy --legacy /prod/backend

# Stage production
FROM node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS production
WORKDIR /app

# Copier l'artifact minimal (sans devDependencies)
COPY --from=deploy /prod/backend ./

# Configuration production
ENV NODE_ENV=production
EXPOSE 3000

# Utilisateur non-root
USER node

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Démarrage avec Node.js (pas Bun en production)
CMD ["node", "dist/main.js"]
