# Guide de Déploiement Production - Pulpe

## Ordre de Déploiement

1. **Supabase** → Créer projet et récupérer credentials
2. **Backend Railway** → Déployer et obtenir URL
3. **Config** → Créer `config.production.json`
4. **Frontend Vercel** → Déployer

## Étape 1: Supabase

### Créer le projet

```bash
# Sur https://supabase.com/dashboard
# New Project > pulpe-production > Region: eu-central-1
```

### Récupérer les credentials

```bash
# Settings > API
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_KEY]
```

### Migrer la DB

```bash
cd backend-nest
supabase link --project-ref [PROJECT_REF]
supabase db push
```

## Étape 2: Backend sur Railway (monorepo pnpm + Node.js)

### Principe

- Build depuis la racine du monorepo pour résoudre `workspace:*` (pnpm)
- **Runtime Node.js** pour la stabilité (images Bun peuvent être indisponibles)
- Dockerfile multi-stage optimisé avec BuildKit cache
- Build avec Bun → Runtime avec Node.js (meilleur compromis performance/fiabilité)

### Dockerfile (production-ready)

Le `backend-nest/Dockerfile` utilise pnpm via corepack + Node.js runtime:

```dockerfile
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

# Install toutes les dépendances avec cache optimisé
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    git init && pnpm install --frozen-lockfile

# Build stage
FROM install AS build
COPY shared/ ./shared/
COPY backend-nest/ ./backend-nest/

# Build shared package FIRST (dependency requirement)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm build --filter=@pulpe/shared

# Build backend avec Bun (targeting Node.js runtime)
WORKDIR /usr/src/app/backend-nest
RUN bun build src/main.ts --outdir=dist --target=node --minify --packages=external

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
```

### Configuration Railway

- Projet: créer/ouvrir le projet Railway
- Service: créer un service Docker (build context = racine du repo)
- Paramètres du service:
  - Build from: GitHub repo (monorepo) ou CLI
  - **Variable critique**: `RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile`
  - Watch Paths: `backend-nest/**`, `shared/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`
  - Variables d'environnement requises:
    - `NODE_ENV=production`
    - `PORT` (Railway l'injecte automatiquement)
    - `FRONTEND_URL=https://[FRONTEND_DOMAIN]`
    - `SUPABASE_URL=https://[PROJECT_REF].supabase.co`
    - `SUPABASE_ANON_KEY=[ANON_KEY]`
    - `SUPABASE_SERVICE_ROLE_KEY=[SERVICE_KEY]`
    - `DEBUG_HTTP_FULL=false`

### Déploiement via CLI

Depuis la racine du dépôt:

```bash
# Lier le répertoire au projet/service Railway
railway link

# (Optionnel) Sélectionner le service si plusieurs
railway service

# Déployer (Docker build depuis la racine, Dockerfile path configuré côté service)
railway up

# Récupérer l’URL publique
railway domain
```

### Diagnostic des Problèmes Courants

#### ❌ Problème : "No deployments found" ou builds en échec infini
**Cause** : Images Docker indisponibles (ex: `oven/bun:*` en timeout)
**Solution** : Vérifier localement avec `docker pull node:20-alpine` puis basculer vers Node.js

#### ❌ Problème : Erreurs de résolution `workspace:*`  
**Cause** : Build context incorrect ou fichiers workspace manquants
**Solution** : Vérifier la présence de `pnpm-workspace.yaml` et `pnpm-lock.yaml` à la racine

### Notes importantes

- **Critique** : Railway doit définir `RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile` pour localiser le Dockerfile dans le monorepo.
- **Port** : Automatiquement injecté via `PORT` par Railway.
- **Performance** : Build avec Bun + Runtime Node.js = bon compromis stabilité/performance.

## Étape 3: Configuration Frontend

### Créer config.production.json

`frontend/projects/webapp/public/config.production.json`:

```json
{
  "supabase": {
    "url": "https://[PROJECT_REF].supabase.co",
    "anonKey": "[ANON_KEY]"
  },
  "backend": {
    "apiUrl": "https://[RAILWAY_URL]/api/v1"
  },
  "environment": "production"
}
```

### Configurer Vercel (Monorepo)

`vercel.json` à la racine:

```json
{
  "buildCommand": "npx turbo build --filter=pulpe-frontend",
  "outputDirectory": "frontend/dist/webapp/browser",
  "installCommand": "pnpm install --frozen-lockfile --filter=pulpe-frontend --filter=@pulpe/shared --ignore-scripts",
  "framework": "angular",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`.vercelignore` à la racine:

```
backend-nest/
mobile/
**/*.spec.ts
**/node_modules/
```

## Étape 4: Déployer Frontend

### Script de config

`frontend/scripts/use-config.js`:

```javascript
#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const env = process.argv[2] || "local";
const configDir = path.join(__dirname, "../projects/webapp/public");
const sourceFile = path.join(configDir, `config.${env}.json`);
const targetFile = path.join(configDir, "config.json");
fs.copyFileSync(sourceFile, targetFile);
console.log(`✅ Configuration '${env}' activée`);
```

### Scripts package.json

`frontend/package.json`:

```json
{
  "scripts": {
    "config:production": "node scripts/use-config.js production",
    "build": "npm run config:production && ng build --configuration production",
    "build:vercel": "cd .. && npx turbo build --filter=pulpe-frontend"
  }
}
```

### Déployer

```bash
# Depuis la racine du monorepo
vercel
vercel --prod
```

## Checklist

- [ ] Supabase projet créé, credentials récupérés
- [ ] Backend Railway déployé, URL obtenue
- [ ] config.production.json créé avec vraies valeurs
- [ ] vercel.json et .vercelignore à la racine
- [ ] Frontend déployé sur Vercel
