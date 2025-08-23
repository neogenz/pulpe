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

## Étape 2: Backend sur Railway (monorepo pnpm + Bun build + Node.js runtime)

### Principe

- Build depuis la racine du monorepo pour résoudre `workspace:*` (pnpm)
- **Build avec Bun** pour les performances (comme spécifié dans package.json)
- **Runtime Node.js** pour la stabilité Railway
- Dockerfile multi-stage optimisé pour monorepos
- .dockerignore inclus pour optimiser le contexte de build

### Dockerfile (standards 2025)

Le `backend-nest/Dockerfile` utilise pnpm + Bun build + Node.js runtime:

```dockerfile
# Dockerfile optimisé pour Railway - NestJS + pnpm monorepo
FROM node:20-slim AS base

# Configuration pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Installation Bun pour le build uniquement
RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# Copier les fichiers de configuration du monorepo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY shared/package.json ./shared/
COPY backend-nest/package.json ./backend-nest/

# Installer les dépendances
RUN pnpm install --frozen-lockfile

# Build shared package
COPY shared/ ./shared/
WORKDIR /app/shared
RUN pnpm run build

# Build backend avec Bun
WORKDIR /app
COPY backend-nest/ ./backend-nest/
WORKDIR /app/backend-nest
RUN bun build src/main.ts --outdir=dist --target=node --minify --packages=external

# Stage production
FROM node:20-slim AS production
WORKDIR /app

# Copier uniquement les fichiers nécessaires
COPY --from=base /app/backend-nest/dist ./dist
COPY --from=base /app/backend-nest/package.json ./
COPY --from=base /app/node_modules ./node_modules

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
```

### Configuration Railway

- Projet: créer/ouvrir le projet Railway
- Service: créer un service Docker (build context = racine du repo)
- Paramètres du service:
  - Build from: GitHub repo (monorepo) ou CLI
  - **Variable critique**: `RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile`
  - Watch Paths: `backend-nest/**`, `shared/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, `turbo.json`
  - Variables d'environnement requises:
    - `NODE_ENV=production`
    - `RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile`
    - `CORS_ORIGIN=https://[FRONTEND_DOMAIN]` _(critique pour CORS)_
    - `SUPABASE_URL=https://[PROJECT_REF].supabase.co`
    - `SUPABASE_ANON_KEY=[ANON_KEY]`

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
