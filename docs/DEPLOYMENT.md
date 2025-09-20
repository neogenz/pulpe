# 🚀 Deployment Guide - Pulpe

## 🚀 TLDR - Déploiement Rapide

```bash
# 1. Qualité check
pnpm quality:fix && pnpm test && pnpm test:e2e

# 2. Release avec changeset
pnpm changeset:version    # Bump versions
git add . && git commit -m "chore: release version bump"

# 3. Push vers main
git push origin main      # Déclanche CI/CD automatique
```

## 📋 Processus de Release Complet

### 1. Pré-Release Checks
```bash
# Vérifications locales
pnpm build                # Tout build sans erreur
pnpm quality              # Lint + format + type-check
pnpm test                 # Tests unitaires + E2E
pnpm test:performance     # Tests de charge backend
pnpm test:e2e     # Tests de charge backend
```

### 2. Versioning (Changesets)
```bash
# Créer changeset (décrit changements)
pnpm changeset

# Appliquer versions + update changelogs
pnpm changeset:version

# Commit version bump
git add .
git commit -m "chore: release version bump"
```

### 3. Déploiement Production
```bash
# Push main déclenche CI/CD
git push origin main

# Monitoring automatique
# → GitHub Actions CI/CD
# → Vercel (Frontend)
# → Railway (Backend)
# → Supabase (Migrations si applicable)
```

## 🔧 Troubleshooting Déploiement

### GitHub Actions CI Fail
```bash
# Vérifier logs
gh run list --limit 5
gh run view [RUN_ID] --log

# Erreurs courantes
# - Tests E2E timeout → Relancer
# - Build cache corrompu → Clear cache dans UI GitHub
```

### Vercel Build Fail
```bash
# Vérifier variables environnement
vercel env pull

# Erreurs courantes
# - PUBLIC_* variables manquantes
# - Supabase keys incorrectes
# - Config.json generation fail

# Fix via Vercel Dashboard > Settings > Environment Variables
```

### Railway Backend Fail
```bash
# Logs en temps réel
railway logs

# Status service
railway status

# Erreurs courantes
# - Variables env manquantes (SUPABASE_URL, etc.)
# - Container OOM → Upgrade plan
# - Database connection fail → Check Supabase
```

## 🗃️ Gestion Base de Données (Supabase) {#supabase}

### Migration Automatique
Les migrations se déclenchent automatiquement lors du push sur `main` si fichiers dans `backend-nest/supabase/migrations/`.

### Migration Manuelle (Urgence)
```bash
# Local vers Production
cd backend-nest
supabase db push

# Créer nouvelle migration
supabase migration new [description]
# Éditer le fichier SQL généré
supabase db push
```

## 📊 Monitoring Post-Déploiement

### Health Checks Automatiques
- **Frontend (Vercel)** : Monitoring intégré
- **Backend (Railway)** : Health endpoint `/api/v1/health`
- **Database (Supabase)** : Dashboard monitoring

### Vérifications Manuelles
```bash
# Frontend accessible
curl https://app.pulpe.ch

# Backend API
curl https://pulpe-backend.railway.app/api/v1/health

# PostHog sourcemaps uploaded
# → Vercel build logs: "PostHog source maps processing completed!"
```

## 📚 Variables d'Environnement Critiques

### Frontend (Vercel)
```env
# OBLIGATOIRES en production
PUBLIC_SUPABASE_URL=https://[project].supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
PUBLIC_BACKEND_API_URL=https://pulpe-backend.railway.app/api/v1
PUBLIC_ENVIRONMENT=production

# PostHog (sourcemaps)
POSTHOG_PERSONAL_API_KEY=phc_...
POSTHOG_CLI_ENV_ID=12345
POSTHOG_HOST=https://eu.i.posthog.com
```

### Backend (Railway)
```env
# OBLIGATOIRES en production
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CORS_ORIGIN=https://app.pulpe.ch
```

## ⚠️ Checklist Pré-Production

- [ ] Variables environnement configurées (Vercel + Railway)
- [ ] Database migrations appliquées
- [ ] Tests E2E passent sur staging
- [ ] PostHog sourcemaps upload configuré
- [ ] Monitoring alerts configurés
- [ ] Documentation à jour
- [ ] Backup database récent disponible

---

## 🎯 Commandes de Debug Rapide

```bash
# Status global
gh run list --limit 3      # CI/CD status
vercel ls                  # Frontend deployments
railway status             # Backend status

# Logs en cas de problème
gh run view --log          # CI logs
vercel logs               # Frontend logs
railway logs              # Backend logs
```