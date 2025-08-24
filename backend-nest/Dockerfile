# Dockerfile optimisé pour Railway - NestJS + pnpm monorepo
FROM node:20-slim AS base

# Configuration pnpm + Git (requis pour lefthook)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Installation Bun + Git pour le build
RUN apt-get update && apt-get install -y curl unzip git && \
    curl -fsSL https://bun.sh/install | bash && \
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
FROM node:20-slim AS production
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