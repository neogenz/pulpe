# Dockerfile optimisé pour Railway + Node.js runtime (monorepo pnpm)
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Dependencies stage - Install avec pnpm pour workspace resolution
FROM base AS install
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
RUN apk add --no-cache git

# Copy workspace files pour pnpm resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY backend-nest/package.json ./backend-nest/

# Install toutes les dépendances (sans cache BuildKit)
RUN git init && pnpm install --frozen-lockfile

# Build stage
FROM install AS build
COPY shared/ ./shared/
COPY backend-nest/ ./backend-nest/

# Build shared package FIRST (direct build, not turbo)
WORKDIR /usr/src/app/shared
RUN pnpm run build
WORKDIR /usr/src/app

# Build backend avec TypeScript (Node.js runtime)
WORKDIR /usr/src/app/backend-nest
RUN npx tsc --build

# Production stage - Runtime Node.js
FROM node:20-alpine AS production
WORKDIR /app

# Copier les artefacts de build
COPY --from=build --chown=node:node /usr/src/app/backend-nest/dist ./dist
COPY --from=build --chown=node:node /usr/src/app/backend-nest/package.json ./
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules

# Sécurité : utilisateur non-root
USER node

# Configuration Railway
ENV NODE_ENV=production
EXPOSE 3000

# Health check pour Railway
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Start avec Node.js runtime
ENTRYPOINT ["node", "dist/main.js"]