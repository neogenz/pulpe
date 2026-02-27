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
- Domaine `pulpe.app` (optionnel, voir [Domaine personnalisé](#domaine-personnalisé-pulpeapp))

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
Pour la branche preview :
supabase db push --db-url "postgresql://postgres.uzsgvcwchwqcuwejjtdb:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
supabase unlink
```

- Les migrations se déclenchent automatiquement lors du push sur `main` si des fichiers existent dans `backend-nest/supabase/migrations/`.
- Pour créer une nouvelle migration : `supabase migration new [description]` puis `supabase db push` après avoir édité le SQL généré. Attention, ça va pousser sur le projet linked (prod).

##### Appliquer les migrations en local

```bash
supabase migration up
```
Ensuite le `db push` appliquera les nouvelles migrations sur la base de données distante.

#### Exporter les données (optionnel)

```bash
supabase link --project-ref [PROJECT_REF]
supabase db dump --linked -f supabase/[timestamp]_data.sql --data-only --use-copy
supabase unlink
```

#### Importer des données (optionnel)

```bash
psql "postgresql://postgres.uzsgvcwchwqcuwejjtdb:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres" \
  --single-transaction \
  --variable=ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file ./supabase/data.sql
```


### Backend (Railway)

Configurer un service Railway avec ces variables d'environnement :

```env
NODE_ENV=production
RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile
PORT=3000
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]  # REQUIRED in production/preview
CORS_ORIGIN=https://pulpe.app
```

> ⚠️ **SUPABASE_SERVICE_ROLE_KEY est obligatoire** en production/preview pour le nettoyage automatique des utilisateurs démo. L'application **ne démarrera pas** sans cette variable.

Déployer :

```bash
railway link
railway up --detach
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

Le build Vercel exécute `frontend/scripts/generate-config.ts` (via `pnpm generate:config`), qui lit les variables `PUBLIC_*`, valide avec Zod, et génère `config.json`.

Variables additionnelles pour PostHog (Production) :

```env
PUBLIC_POSTHOG_HOST=/ph                          # Reverse proxy (voir vercel.json)
POSTHOG_PERSONAL_API_KEY=phc_...                 # Sourcemaps upload (CI)
POSTHOG_CLI_ENV_ID=12345                         # Sourcemaps upload (CI)
POSTHOG_HOST=https://eu.i.posthog.com            # Sourcemaps upload (CI, accès direct)
```

> **Note** : `PUBLIC_POSTHOG_HOST=/ph` route le trafic analytics via le reverse proxy Vercel (`/ph/*` → `eu.i.posthog.com`), contournant les ad-blockers. Voir `docs/VERCEL_ROUTING.md`.

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
pnpm generate:config
```

### Domaine personnalisé (pulpe.app)

#### Registrar

Domaine acheté chez **Infomaniak**.

#### Configuration DNS (Infomaniak)

| Type | Name | Value |
|------|------|-------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |
| CNAME | api | `backend-production-e7df.up.railway.app` |

#### Vercel (Frontend)

1. **Settings > Domains** → `pulpe.app` et `www.pulpe.app` ajoutés
2. **Variable Production** :
   ```
   PUBLIC_BACKEND_API_URL=https://api.pulpe.app/api/v1
   ```

#### Railway (Backend API)

1. **Settings > Networking > Custom Domain** → `api.pulpe.app` (port 8080)
2. **Variable** :
   ```
   CORS_ORIGIN=https://pulpe.app
   ```

#### Supabase (Auth)

**Dashboard > Authentication > URL Configuration** :
- **Site URL** : `https://pulpe.app`
- **Redirect URLs** :
  - `https://pulpe.app/**`
  - `https://www.pulpe.app/**`
  - `https://*.vercel.app/**` (previews)

#### Google OAuth (Cloud Console)

**APIs & Services > Credentials > OAuth 2.0 Client IDs** :
- **Authorized JavaScript origins** : `https://pulpe.app`
- **Redirect URI** : `https://[PROJECT_ID].supabase.co/auth/v1/callback` (inchangé)

#### Cloudflare Turnstile

**Dashboard > Turnstile > Widget** :
- Domaine ajouté : `pulpe.app`

#### PostHog

**Settings > Toolbar Authorized URLs** :
- URL ajoutée : `https://pulpe.app`

#### Checklist domaine personnalisé

- [x] Domaine acheté (Infomaniak)
- [x] DNS configuré (A + CNAME)
- [x] Domaines ajoutés dans Vercel
- [x] `api.pulpe.app` ajouté dans Railway
- [x] `PUBLIC_BACKEND_API_URL` mis à jour dans Vercel
- [x] `CORS_ORIGIN` mis à jour dans Railway
- [x] Supabase URL Configuration mis à jour
- [x] Google OAuth origins mis à jour
- [x] Turnstile domaine ajouté
- [x] PostHog toolbar URL ajoutée
- [ ] Test auth flow complet

> **Note** : Les environnements Preview (Vercel, Railway, Supabase) n'ont pas besoin de modification — ils utilisent leurs propres URLs auto-générées.

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

## 📊 Monitoring Post-Déploiement

### Health Checks Automatiques
- **Frontend (Vercel)** : monitoring intégré
- **Backend (Railway)** : endpoint `/health`
- **Database (Supabase)** : dashboard monitoring

### Vérifications Manuelles

```bash
curl https://www.pulpe.app                     # Frontend accessible
curl https://api.pulpe.app/health              # Backend API
# PostHog sourcemaps → Vercel build logs: "PostHog source maps processing completed!"
```

## ⚠️ Checklist Pré-Production

- [ ] Supabase : projet créé + migrations appliquées
- [ ] Railway : variables d'environnement configurées + backend déployé
- [ ] Vercel : variables `PUBLIC_*` et PostHog configurées
- [ ] Domaine personnalisé configuré (DNS, Vercel, Railway, Supabase)
- [ ] Tests E2E passent sur staging
- [ ] PostHog sourcemaps upload configuré
- [ ] Monitoring alerts configurés
- [ ] Documentation à jour
- [ ] Backup database récent disponible

---

**Problème en production ?** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
