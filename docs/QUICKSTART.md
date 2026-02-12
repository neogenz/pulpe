# ⚡ Quick Start Guide - Pulpe

> **Setup rapide** et **commandes essentielles** pour démarrer immédiatement

## 🚀 TLDR - Setup en 5 Minutes

```bash
# 1. Install dépendances
pnpm install

# 2. Setup environnement
cp backend-nest/.env.example backend-nest/.env  # Backend config
# frontend/.env.e2e est déjà versionné (pas besoin de copier)

# 3. Start services
supabase start                          # Database local
pnpm dev                               # Full stack (frontend + backend)

# 4. Accès applications
# Frontend: http://localhost:4200
# Backend: http://localhost:3000
# Supabase Studio: http://localhost:54323
```

## 📋 Commandes Essentielles par Cas d'Usage

### 🏗️ Développement Full Stack
```bash
# Développement complet (recommandé)
pnpm dev                               # Frontend + Backend + Shared

# Développement ciblé
pnpm dev:frontend-only                 # Frontend + shared uniquement
pnpm dev:backend-only                  # Backend + shared uniquement

# Services individuels
cd frontend && pnpm start              # Frontend seul (:4200)
cd backend-nest && bun run dev         # Backend seul (:3000)
```

### 🔨 Build & Quality
```bash
# Build production
pnpm build                             # Build tous les packages
pnpm build --filter=pulpe-shared       # Build package spécifique
pnpm build --force                     # Ignore cache Turborepo

# Quality assurance (avant commit)
pnpm quality                           # Type-check + lint + format
pnpm quality:fix                       # Auto-fix tout ce qui peut l'être

# Commandes individuelles
pnpm lint && pnpm lint:fix            # ESLint
pnpm format && pnpm format:check      # Prettier
pnpm type-check                        # TypeScript
```

### 🧪 Tests
```bash
# Tous les tests
pnpm test                              # Unit + E2E + Performance
pnpm test:watch                        # Mode watch
pnpm test:unit                         # Tests unitaires uniquement
pnpm test:e2e                          # Tests E2E Playwright

# Backend spécifique
cd backend-nest
bun test                               # Unit tests
bun test:performance                   # Load tests
bun test:watch                         # Watch mode

# Frontend spécifique
cd frontend
pnpm test                              # Vitest unit tests
pnpm test:e2e                          # Playwright E2E
pnpm test:e2e:ui                       # Playwright avec UI
```

### 🗃️ Database (Supabase)
```bash
# Services locaux
supabase start                         # Démarre tout (DB + Auth + Studio)
supabase stop                          # Arrête tout
supabase status                        # Status services
supabase reset                         # Reset DB (⚠️ perte données)

# Migrations
cd backend-nest
supabase migration new [description]   # Nouvelle migration
supabase db push                       # Applique migrations locales
supabase db pull                       # Sync depuis remote

# Types generation
bun run generate-types:local           # Types depuis DB locale
```

## 🎯 Workflows Spécialisés

### 📦 Gestion Packages (Changesets)
```bash
# Workflow version + release
pnpm changeset                         # Décrire changements
pnpm changeset:version                 # Bump versions + changelogs
git add . && git commit -m "chore: version bump"
git push origin main                   # Déclenche CI/CD
```

### 🔍 Debug & Analysis
```bash
# Frontend bundle analysis
cd frontend
pnpm analyze                           # Bundle analyzer treemap
pnpm analyze:sme                       # Source map explorer
pnpm deps:circular                     # Dépendances circulaires

# Backend debugging
cd backend-nest
DEBUG_PERFORMANCE=true bun test        # Tests avec métriques perf
bun run supabase:status                # Debug DB connection
```

### 🧹 Cache & Cleanup
```bash
# Nettoyage complet
rm -rf node_modules .turbo && pnpm install  # Reset complet

# Cache spécifique
turbo build --force                    # Ignore cache Turborepo
pnpm store prune                       # Nettoie store pnpm
```

## 🔧 Setup Initial Détaillé

### 1. Prérequis Système
```bash
# Versions requises
node --version                         # ≥ 22.x
pnpm --version                         # ≥ 10.12.1
bun --version                          # ≥ 1.2.17
docker --version                       # Pour Supabase local

# Installation si manquants
npm install -g pnpm@latest
curl -fsSL https://bun.sh/install | bash
```

### 2. Variables d'Environnement
```bash
# Backend (.env)
NODE_ENV=development
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Tests E2E (frontend/.env.e2e)
PUBLIC_ENVIRONMENT=test
PUBLIC_POSTHOG_ENABLED=false
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_BACKEND_API_URL=http://localhost:3000/api/v1
```

### 3. Première Exécution
```bash
# 1. Clone + install
git clone [repo] && cd pulpe-workspace
pnpm install

# 2. Database setup
supabase start
cd backend-nest && bun run generate-types:local

# 3. Test environment
pnpm build                             # Doit réussir
pnpm test:unit                         # Tests rapides
pnpm dev                               # Start dev servers
```

## 📱 Accès Applications

| Service | URL | Utilisation |
|---------|-----|-------------|
| **Frontend** | http://localhost:4200 | Application web |
| **Backend API** | http://localhost:3000 | API REST + Swagger |
| **Swagger Docs** | http://localhost:3000/api/docs | Documentation API |
| **Supabase Studio** | http://localhost:54323 | Interface DB |

## 🆘 Quick Debug

```bash
# Problème commun = solution rapide
rm -rf node_modules .turbo && pnpm install && pnpm build  # Reset global
supabase stop && supabase start           # Reset DB
rm -rf node_modules && pnpm install       # Reset deps

# Status global
supabase status                        # DB services
pnpm dev 2>&1 | tee debug.log          # Log debug
curl localhost:4200 && curl localhost:3000  # Test connectivity
```

## 🎓 Next Steps

Une fois le setup fonctionnel :
- **Configuration avancée** → [FRONTEND_CONFIG.md](./FRONTEND_CONFIG.md)
- **Monitoring setup** → [MONITORING.md](./MONITORING.md)
- **Pratiques backend** → [BACKEND_PRACTICES.md](./BACKEND_PRACTICES.md)
- **Déploiement** → [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Problème durant le setup ?** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
