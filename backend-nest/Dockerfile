# Dockerfile optimisé pour Railway - NestJS + pnpm monorepo
# node:24-slim (LTS) pinné par digest multi-arch — Node 20 est EOL depuis mars 2026.
FROM node:24-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS base

# Configuration pnpm + Git (requis pour lefthook)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Installation Bun (version pinnée = BUN_VERSION de la CI) + Git pour le build
RUN apt-get update && apt-get install -y curl unzip git && \
    curl -fsSL https://bun.sh/install | bash -s "bun-v1.2.17" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:$PATH"

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
FROM node:24-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS production
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