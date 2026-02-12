# 🔧 Troubleshooting Guide - Pulpe

> **Solutions rapides** aux problèmes les plus courants du projet Pulpe

## 🚨 Problèmes Critiques (Production)

### 🔥 Application inaccessible
```bash
# 1. Vérifier status général
curl https://www.pulpe.app                   # Frontend
curl https://api.pulpe.app/health            # Backend

# 2. Si Frontend down
vercel ls                     # Check deployments
# → Rollback via Vercel Dashboard si nécessaire

# 3. Si Backend down
railway logs                  # Check errors
railway status               # Service status
```

### 🔥 Database connexion fail
```bash
# Vérifier Supabase status
# → https://status.supabase.com

# Test connexion locale
cd backend-nest
bun run generate-types:local  # Should connect

# Si erreur auth → Check SUPABASE_SERVICE_ROLE_KEY
```

## 🚀 Problèmes de Déploiement

### GitHub Actions CI Fail
**Symptômes** : CI rouge, tests échouent, build fail

```bash
# 1. Identifier le problème
gh run list --limit 5
gh run view [RUN_ID] --log

# 2. Solutions courantes
# - Tests E2E timeout → Relancer workflow
# - Cache corrompu → Clear cache via GitHub UI
# - Supabase local fail → Check Docker Desktop
```

### Vercel Build Fail {#vercel}
**Symptômes** : Build fail, variables env manquantes

```bash
# 1. Check variables env
vercel env pull

# 2. Erreurs courantes + solutions
# PUBLIC_SUPABASE_URL manquante → Ajouter dans Vercel Dashboard
# Config.json generation fail → Check scripts/generate-config.ts
# Sourcemaps upload fail → Check POSTHOG_PERSONAL_API_KEY

# 3. Debug local
cd frontend
pnpm build                    # Reproduire erreur localement
```

### Railway Backend Fail {#railway}
**Symptômes** : 500 errors, API inaccessible

```bash
# 1. Logs temps réel
railway logs

# 2. Check variables critiques
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NODE_ENV=production

# 3. Solutions courantes
# OOM error → Upgrade Railway plan
# Port binding → Vérifier PORT=3000
# DB connection → Check Supabase credentials
```

## 🖥️ Problèmes de Développement Local

### Turborepo Cache Issues
**Symptômes** : Builds incohérents, shared package pas à jour

```bash
# Solution rapide
rm -rf .turbo                 # Clear Turborepo cache
turbo build --force           # Force rebuild all

# Si problème persiste
rm -rf node_modules .turbo
pnpm install
pnpm build
```

### Supabase Local Connection
**Symptômes** : Backend can't connect, auth fail

```bash
# 1. Vérifier services
supabase status

# 2. Si services down
supabase stop
docker system prune -a        # Clean Docker
supabase start

# 3. Check configuration
# .env should have: SUPABASE_URL=http://localhost:54321
```

### Tests E2E Fail
**Symptômes** : Playwright tests timeout, config errors

```bash
# 1. Vérifier .env.e2e existe et complet
ls -la frontend/.env.e2e

# 2. Variables critiques dans .env.e2e
# PUBLIC_ENVIRONMENT=test
# PUBLIC_POSTHOG_ENABLED=false
# PUBLIC_SUPABASE_URL=http://localhost:54321

# 3. Relancer tests avec debug
cd frontend
pnpm test:e2e:debug
```

## 🔧 Configuration & Setup

### TypeScript Errors après Changes
**Symptômes** : TS errors sur shared package, types outdated

```bash
# 1. Rebuild shared package
cd shared && pnpm build

# 2. Si problème persiste
# Restart TypeScript dans VS Code: Ctrl+Shift+P → "Restart TS Server"

# 3. Check workspace sync
pnpm build --filter=pulpe-shared
```

### Environment Variables Setup
**Symptômes** : App crash, config undefined, auth fail

```bash
# 1. Copier templates
cp backend-nest/.env.example backend-nest/.env
# frontend/.env.e2e est déjà versionné

# 2. Vérifier variables critiques
# SUPABASE_URL, SUPABASE_ANON_KEY obligatoires
# PUBLIC_* pour frontend

# 3. Test configuration
cd frontend && pnpm generate:config  # Should work
```

## 📊 Monitoring & Performance

### PostHog Sourcemaps Issues
**Symptômes** : Stack traces minifiées, sourcemaps fail

```bash
# Vérifier upload dans build logs Vercel
# Chercher: "PostHog source maps processing completed!"
```

→ Guide complet : [MONITORING.md#troubleshooting](./MONITORING.md#troubleshooting)

### Performance Issues
**Symptômes** : App lente, bundle trop gros

```bash
# 1. Analyser bundle
cd frontend
pnpm analyze                  # Bundle analyzer
pnpm analyze:sme             # Source map explorer

# 2. Check dépendances circulaires
pnpm deps:circular

# 3. Backend performance
cd backend-nest
DEBUG_PERFORMANCE=true bun test  # Perf tests
```

## 🗃️ Database & Auth

### RLS Policy Issues
**Symptômes** : 403 Forbidden, unauthorized access

Vérifier policies dans Supabase Dashboard : Tables → [table] → RLS → Policies.

→ Patterns détaillés : [BACKEND_PRACTICES.md#auth](./BACKEND_PRACTICES.md#auth)

### Migration Fails
**Symptômes** : Schema out of sync, migration errors

```bash
# 1. Check migration status
cd backend-nest
supabase migration list

# 2. Reset si nécessaire (DANGER: perte données)
supabase db reset

# 3. Alternative: Fix migration manuelle
supabase migration new fix_[issue]
# Éditer fichier SQL
supabase db push
```

## 📚 Quick Debug Commands

```bash
# Status général infrastructure
gh run list --limit 3         # CI/CD status
vercel ls                     # Frontend deployments
railway status                # Backend status
supabase status               # Local DB status

# Logs debug
gh run view --log             # CI logs dernière run
vercel logs                   # Frontend logs
railway logs                  # Backend logs
```

## 🎯 Escalation Matrix

| Problème | Temps | Action |
|----------|-------|--------|
| **CI/CD fail** | 5 min | Relancer workflow |
| **Vercel down** | 10 min | Check Vercel status + rollback |
| **Railway down** | 10 min | Check Railway logs + redeploy |
| **Database issues** | 15 min | Supabase support + backup restore |
| **Persistent issues** | 30 min | Full system debug + docs review |

---

**Pas trouvé votre problème ?** Consultez la [documentation spécialisée](./INDEX.md#par-problème-spécifique) ou les logs détaillés.