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

### Créer Dockerfile

`backend-nest/Dockerfile`:

```dockerfile
FROM oven/bun:1.1.42-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
COPY ../shared/package.json ../shared/
COPY ../package.json ../pnpm-workspace.yaml ../
RUN bun install --frozen-lockfile
COPY . .
COPY ../shared ../shared
WORKDIR /app/../shared
RUN bun run build
WORKDIR /app
RUN bun run build

FROM oven/bun:1.1.42-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", "start:prod"]
```

### Déployer

```bash
cd backend-nest
railway init  # Nom: pulpe-backend
railway variables set NODE_ENV=production
railway variables set SUPABASE_URL=[VOTRE_URL]
railway variables set SUPABASE_ANON_KEY=[VOTRE_KEY]
railway variables set SUPABASE_SERVICE_ROLE_KEY=[VOTRE_SERVICE_KEY]
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
