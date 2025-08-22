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

## Étape 2: Backend sur Railway

### Dockerfile (Déjà Optimisé)

Le `backend-nest/Dockerfile` existant est déjà optimisé et suit les meilleures pratiques 2024 :

```dockerfile
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
```

**Points forts** :
- ✅ Multi-stage build optimisé (3 stages)
- ✅ Gestion correcte du monorepo pnpm
- ✅ Sécurité renforcée (utilisateur non-root)
- ✅ Health check intégré
- ✅ Version Bun récente (1.2.15)

### Déployer

```bash
cd backend-nest
railway init  # Nom: pulpe-backend

# Configurer les variables d'environnement
railway variables --set "NODE_ENV=production" \
                  --set "SUPABASE_URL=[VOTRE_URL]" \
                  --set "SUPABASE_ANON_KEY=[VOTRE_KEY]" \
                  --set "SUPABASE_SERVICE_ROLE_KEY=[VOTRE_SERVICE_KEY]"

# Déployer et configurer le domaine
railway up
railway domain  # Récupérer l'URL
```

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

**IMPORTANT**: Pour monorepo pnpm avec packages partagés

`vercel.json` à la **RACINE** du monorepo:

```json
{
  "buildCommand": "npx turbo build --filter=pulpe-frontend",
  "outputDirectory": "frontend/dist/webapp/browser",
  "installCommand": "pnpm install --frozen-lockfile --filter=pulpe-frontend --filter=@pulpe/shared --ignore-scripts",
  "framework": "angular",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

`.vercelignore` à la **RACINE**:

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
# Depuis la RACINE du monorepo
vercel

# Réponses:
? Set up and deploy? → Y
? Which scope? → [Votre compte]
? Link to existing? → N
? Project name? → pulpe
? Directory? → ./
? Modify settings? → N

# Production
vercel --prod
```

## Checklist

- [ ] Supabase projet créé, credentials récupérés
- [ ] Backend Railway déployé, URL obtenue
- [ ] config.production.json créé avec vraies valeurs
- [ ] vercel.json à la racine du monorepo
- [ ] .vercelignore à la racine
- [ ] Scripts use-config.js et package.json mis à jour
- [ ] Frontend déployé sur Vercel
