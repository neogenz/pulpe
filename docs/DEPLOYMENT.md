# 🚀 Deployment Guide - Pulpe

## 🚀 TLDR - Déploiement Rapide

```bash
# 1. Qualité check
pnpm quality:fix && pnpm test && pnpm test:e2e

# 2. Release avec changeset
pnpm changeset:version    # Bump versions
git add . && git commit -m "chore: release version bump"

# 3. Push vers main
git push origin main      # Déclenche CI/CD automatique
```

## ✅ Pré-requis

- Compte Supabase
- Compte Railway (backend)
- Compte Vercel (frontend)
- CLIs installées : `supabase`, `railway`, `vercel`

## ⚙️ Configuration Initiale

### Base de données (Supabase)

#### Créer le projet
1. Aller sur https://supabase.com/dashboard
2. **New Project** → `pulpe-production` → Region : `eu-central-1`
3. Récupérer les credentials dans **Settings > API** : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

#### Migrer la base

```bash
cd backend-nest
supabase link --project-ref [PROJECT_REF]
supabase db push
```

- Les migrations se déclenchent automatiquement lors du push sur `main` si des fichiers existent dans `backend-nest/supabase/migrations/`.
- Pour créer une nouvelle migration : `supabase migration new [description]` puis `supabase db push` après avoir édité le SQL généré. Attention, ça va pousser sur le projet linked (prod).

##### Appliquer les migrations en local

```bash
supabase migration up
```
Ensuite le `db push` appliquera les nouvelles migrations sur la base de données distante.


### Backend (Railway)

Configurer un service Railway avec ces variables d'environnement :

```env
NODE_ENV=production
RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile
PORT=3000
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
CORS_ORIGIN=https://app.pulpe.ch
```

Déployer :

```bash
railway link
railway up
railway domain  # Récupérer l'URL publique
```

### Frontend (Vercel)

Configurer les variables d'environnement Production dans Vercel :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `PUBLIC_SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` | URL du projet Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | `[ANON_KEY]` | Clé anonyme Supabase |
| `PUBLIC_BACKEND_API_URL` | `https://[RAILWAY_URL]/api/v1` | URL du backend Railway |
| `PUBLIC_ENVIRONMENT` | `production` | Environnement actuel |

Le build Vercel exécute `frontend/scripts/generate-config.js`, qui lit les variables `PUBLIC_*`, génère `config.json` et applique des valeurs par défaut si nécessaire.

Variables additionnelles pour PostHog (Production) :

```env
POSTHOG_PERSONAL_API_KEY=phc_...
POSTHOG_CLI_ENV_ID=12345
POSTHOG_HOST=https://eu.i.posthog.com
```

Déployer :

```bash
vercel --prod
```

### Branches de preview (Vercel)

Pour une branch preview, n'ajouter que les variables qui diffèrent de la production. Exemple :

- **Name** : `PUBLIC_BACKEND_API_URL`
- **Value** : `https://backend-preview-xyz.railway.app/api/v1`
- **Environment** : Preview

Les autres variables héritent des valeurs de production.

### Développement local

Créer un `.env.local` dans `frontend/` pour surcharger les valeurs sans modifier le code :

```env
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
PUBLIC_BACKEND_API_URL=http://localhost:3000/api/v1
PUBLIC_ENVIRONMENT=local
```

Le fichier est ignoré par Git. Ensuite :

```bash
cd frontend
node scripts/generate-config.js
```

## 📋 Processus de Release Complet

### 1. Pré-Release Checks

```bash
# Vérifications locales
pnpm build                # Tout build sans erreur
pnpm quality              # Lint + format + type-check
pnpm test                 # Tests unitaires + intégration
pnpm test:e2e             # Tests E2E (Playwright)
pnpm test:performance     # Tests de charge backend
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

### GitHub Actions (CI/CD)

```bash
# Vérifier les derniers runs
gh run list --limit 5

# Inspecter les logs d'un run
gh run view [RUN_ID] --log

# Erreurs courantes
# - Tests E2E timeout → relancer
# - Build cache corrompu → clear cache via l'UI GitHub
```

### Backend (Railway)

```bash
# Logs et état du service	railway logs
railway status
```

- **Backend build fail** : vérifier `RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile`.
- **Variables d'environnement manquantes** : s'assurer que `SUPABASE_*`, `CORS_ORIGIN` et `PORT` sont renseignés.
- **CORS errors** : mettre à jour `CORS_ORIGIN` avec l'URL Vercel finale.
- **Container OOM** : envisager un upgrade du plan Railway.
- **Database connection fail** : vérifier les credentials Supabase côté Railway.

### Frontend (Vercel)

```bash
# Récupérer la configuration actuelle
vercel env pull
```

- **Config.json non généré** : vérifier que `frontend/scripts/generate-config.js` s'exécute bien dans les logs Vercel.
- **Variables d'environnement manquantes** : toutes doivent commencer par `PUBLIC_` et être définies pour l'environnement correct.
- **Mauvaise configuration utilisée** : consulter `/config.json` dans le navigateur pour voir la config générée.
- **Supabase/PostHog keys incorrectes** : mettre à jour depuis le dashboard Vercel.

## 📊 Monitoring Post-Déploiement

### Health Checks Automatiques
- **Frontend (Vercel)** : monitoring intégré
- **Backend (Railway)** : endpoint `/api/v1/health`
- **Database (Supabase)** : dashboard monitoring

### Vérifications Manuelles

```bash
# Frontend accessible
curl https://app.pulpe.ch

# Backend API
curl https://pulpe-backend.railway.app/api/v1/health

# PostHog sourcemaps uploaded
# → Vercel build logs: "PostHog source maps processing completed!"
```

## ⚠️ Checklist Pré-Production

- [ ] Supabase : projet créé + migrations appliquées
- [ ] Railway : variables d'environnement configurées + backend déployé
- [ ] Vercel : variables `PUBLIC_*` et PostHog configurées
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
vercel logs                # Frontend logs
railway logs               # Backend logs
```
