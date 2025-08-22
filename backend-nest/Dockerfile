FROM oven/bun:1.2.15-alpine AS dependencies
WORKDIR /app

# Install git pour lefthook (build-time seulement)
RUN apk add --no-cache git

# Copy workspace structure pour pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY backend-nest/package.json ./backend-nest/

# Install toutes les dépendances
RUN git init && bun install --frozen-lockfile

FROM dependencies AS builder
WORKDIR /app

# Copy source après deps pour optimiser cache
COPY shared/ ./shared/
COPY backend-nest/ ./backend-nest/

# Build shared package
WORKDIR /app/shared
RUN bun run build

# Build backend avec TypeScript
WORKDIR /app/backend-nest
RUN bunx tsc -p tsconfig.build.json

# Production stage - Bun natif optimisé
FROM oven/bun:1.2.15-alpine
WORKDIR /app

# Copy runtime artifacts avec permissions
COPY --from=builder --chown=bun:bun /app/backend-nest/dist ./dist
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/backend-nest/package.json ./package.json

# Sécurité : utilisateur non-root (bun existe déjà)
USER bun

# Runtime configuration
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Start avec Bun runtime natif
CMD ["bun", "run", "dist/main.js"]