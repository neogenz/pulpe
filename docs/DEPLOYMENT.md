# Deployment Guide - Pulpe

## TLDR - Quick Deploy

```text
# 1. Quality check
pnpm quality && pnpm test && pnpm test:e2e

# 2. Run the agent release workflow from a synchronized preview or main
/release
```

`/release` validates one SHA on `preview`, promotes that exact SHA to `main`, and waits for the production proofs. The resulting `main` push starts the production webhooks immediately. The release is published only after the `main` CI, Vercel, Railway, and public health checks all validate that exact SHA.

## Prerequisites

- Supabase account
- Railway account (backend)
- Vercel account (frontend + landing)
- CLIs installed: `supabase`, `railway`, `vercel`
- Domain `pulpe.app` (see [Custom domain](#custom-domain-pulpeapp))

## Architecture

| Domain | Content | Vercel Project | Framework |
|--------|---------|----------------|-----------|
| `pulpe.app` / `www.pulpe.app` | Landing page | `pulpe-landing` | Next.js (static export) |
| `app.pulpe.app` | Angular webapp | `pulpe-frontend` | Angular |
| `api.pulpe.app` | Backend NestJS | Railway | - |

## Branch Model

| Branch | Role | Environment |
|--------|------|-------------|
| `preview` | **Default branch** — sprint integration + QA. Feature branches PR here. | Staging (Vercel Preview, Railway `preview` env) |
| `main` | **Release / production** — fed by `preview` at release time. | Production |

Day-to-day work branches off `preview` and merges back via PR. A **release promotes one commit validated on `preview` to `main`**; `/release` may start from a synchronized `preview` or `main`, but always validates the release SHA on `preview` first. Both branches are protected (PR + 1 review + `✅ CI Success`, no force-push, no deletion); release tags `v*` are immutable. Full contributor workflow: [../CONTRIBUTING.md](../CONTRIBUTING.md).

## Initial Setup

### Database (Supabase)

#### Create project
1. Go to https://supabase.com/dashboard
2. **New Project** > `pulpe-production` > Region: `eu-central-1`
3. Get credentials from **Settings > API**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

#### Run migrations

```bash
cd backend-nest
supabase link --project-ref [PROJECT_REF]
supabase db push
For preview branch:
supabase db push --db-url "postgresql://postgres.uzsgvcwchwqcuwejjtdb:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
supabase unlink
```

- Migrations run automatically on push to `main` if files exist in `backend-nest/supabase/migrations/`.
- To create a new migration: `supabase migration new [description]` then `supabase db push` after editing the generated SQL. Warning: this pushes to the linked (prod) project.

##### Apply migrations locally

```bash
supabase migration up
```
Then `db push` will apply new migrations to the remote database.

#### Account-deletion metadata migration

Before deploying the switch to server-owned deletion claims:

1. With a one-off service-role script, list users whose
   `user_metadata.scheduledDeletionAt` is a valid ISO date and whose
   `app_metadata.scheduledDeletionAt` is absent.
2. Copy that date with `auth.admin.updateUserById`, preserving every existing
   `app_metadata` key.
3. Re-list users and verify that no valid legacy-only deletion remains.
4. Deploy the backend and clients only after this verification. The runtime
   intentionally has no fallback to client-writable `user_metadata`.

#### Export data (optional)

```bash
supabase link --project-ref [PROJECT_REF]
supabase db dump --linked -f supabase/[timestamp]_data.sql --data-only --use-copy
supabase unlink
```

#### Import data (optional)

```bash
psql "postgresql://postgres.uzsgvcwchwqcuwejjtdb:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres" \
  --single-transaction \
  --variable=ON_ERROR_STOP=1 \
  --command 'SET session_replication_role = replica' \
  --file ./supabase/data.sql
```

### Backend (Railway)

Configure a Railway service with these environment variables:

```env
NODE_ENV=production
RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile
PORT=3000
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]  # REQUIRED in production/preview
CORS_ORIGIN=https://app.pulpe.app
```

> **SUPABASE_SERVICE_ROLE_KEY is mandatory** in production/preview for automatic demo user cleanup. The application **will not start** without this variable.

Deploy:

```bash
railway link
railway up --detach
railway domain  # Get the public URL
```

### Frontend — Angular App (Vercel project: `pulpe-frontend`)

**Domain:** `app.pulpe.app`

Configure Production environment variables in Vercel:

| Variable | Value | Description |
|----------|-------|-------------|
| `PUBLIC_SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | `[ANON_KEY]` | Supabase anonymous key |
| `PUBLIC_BACKEND_API_URL` | `https://[RAILWAY_URL]/api/v1` | Railway backend URL |
| `PUBLIC_ENVIRONMENT` | `production` | Current environment |

The Vercel build runs `frontend/scripts/generate-config.ts` (via `pnpm generate:config`), which reads `PUBLIC_*` variables, validates with Zod, and generates `config.json`.

PostHog variables (Production):

```env
PUBLIC_POSTHOG_HOST=/ph                          # Reverse proxy (see vercel.json)
POSTHOG_PERSONAL_API_KEY=phx_...                 # Sourcemaps upload (CI)
POSTHOG_CLI_ENV_ID=12345                         # Sourcemaps upload (CI)
POSTHOG_HOST=https://eu.i.posthog.com            # Sourcemaps upload (CI, direct access)
```

> **Note**: `PUBLIC_POSTHOG_HOST=/ph` routes analytics traffic via the Vercel reverse proxy (`/ph/*` > `eu.i.posthog.com`), bypassing ad-blockers.

**Ignored Build Step** (skip build when only landing changed):
```
git diff --quiet HEAD^ HEAD -- frontend/ shared/
```

### Frontend — Landing Page (Vercel project: `pulpe-landing`)

**Domain:** `pulpe.app`, `www.pulpe.app`

1. **Add New Project**: connect the same GitHub repo
2. **Root Directory**: `landing`
3. **Framework Preset**: Next.js
4. **Build Command**: `cd .. && pnpm build:shared && cd landing && pnpm build`
5. **Output Directory**: leave default (Next.js manages it)
6. **Install Command**: `cd .. && pnpm install --frozen-lockfile --filter=pulpe-landing --filter=pulpe-shared --ignore-scripts`

Environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_ANGULAR_APP_URL` | `https://app.pulpe.app` | Webapp URL for CTA links |
| `NEXT_PUBLIC_SUPABASE_URL` | (same as frontend project) | Auth redirect detection |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (same as frontend project) | Auth redirect detection |
| `PUBLIC_POSTHOG_API_KEY` | `phc_...` | PostHog project key (Pulpe Webapp, ID 87621) |
| `PUBLIC_POSTHOG_HOST` | `/ph` | Reverse proxy (see landing/vercel.json) |
| `PUBLIC_POSTHOG_ENABLED` | `true` | Enable analytics |
| `POSTHOG_PERSONAL_API_KEY` | `phx_...` | Release creation on deploy (see [POSTHOG_RELEASES.md](./POSTHOG_RELEASES.md)) |
| `POSTHOG_CLI_ENV_ID` | `87621` | PostHog project ID (same as webapp) |

**Ignored Build Step** (skip build when only frontend changed):
```
git diff --quiet HEAD^ HEAD -- landing/ shared/
```

### Preview branches (Vercel)

For a preview branch, only add variables that differ from production. Example:

- **Name**: `PUBLIC_BACKEND_API_URL`
- **Value**: `https://backend-preview-xyz.railway.app/api/v1`
- **Environment**: Preview

Other variables inherit from production values.

### Local development

Create a `.env.local` in `frontend/` to override values without modifying code:

```env
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
PUBLIC_BACKEND_API_URL=http://localhost:3000/api/v1
PUBLIC_ENVIRONMENT=local
```

The file is git-ignored. Then:

```bash
cd frontend
pnpm generate:config
```

### Custom domain (pulpe.app)

#### Registrar

Domain purchased at **Infomaniak**.

#### DNS Configuration (Infomaniak)

| Type | Name | Value |
|------|------|-------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |
| CNAME | app | `cname.vercel-dns.com` |
| CNAME | api | `backend-production-e7df.up.railway.app` |

#### Vercel — Angular App (`pulpe-frontend`)

1. **Settings > Domains** > `app.pulpe.app`
2. **Variable Production**:
   ```
   PUBLIC_BACKEND_API_URL=https://api.pulpe.app/api/v1
   ```

#### Vercel — Landing (`pulpe-landing`)

1. **Settings > Domains** > `pulpe.app` and `www.pulpe.app`

#### Railway (Backend API)

1. **Settings > Networking > Custom Domain** > `api.pulpe.app` (port 8080)
2. **Variable**:
   ```
   CORS_ORIGIN=https://app.pulpe.app
   ```

#### Supabase (Auth)

**Dashboard > Authentication > URL Configuration**:
- **Site URL**: `https://app.pulpe.app`
- **Redirect URLs**:
  - `https://app.pulpe.app/**`
  - `https://pulpe.app/app/reset-password`
  - `https://www.pulpe.app/**`

Les previews Vercel ne doivent pas utiliser `https://*.vercel.app/**`. Si un
callback de preview est nécessaire, ajouter manuellement uniquement le motif
borné au slug réel de l’équipe propriétaire, puis le consigner ici.

**Vérifications manuelles après déploiement du reset iOS**:

- [ ] Les projets Supabase preview et production autorisent exactement `https://pulpe.app/app/reset-password`
- [ ] `https://pulpe.app/.well-known/apple-app-site-association` répond en `application/json`
- [ ] Le fichier AASA contient uniquement `AJ37X7C82G.app.pulpe.ios` et `/app/reset-password`
- [ ] Le lien ouvre l’app signée sur appareil réel
- [ ] Sans l’app, `/app/reset-password` redirige vers `https://app.pulpe.app/reset-password`
- [ ] Une app qui déclare seulement `pulpe://` ne reçoit pas le callback de récupération

#### Google OAuth (Cloud Console)

**APIs & Services > Credentials > OAuth 2.0 Client IDs**:
- **Authorized JavaScript origins**: `https://app.pulpe.app`, `https://pulpe.app`
- **Redirect URI**: `https://[PROJECT_ID].supabase.co/auth/v1/callback` (unchanged)

#### Cloudflare Turnstile

**Dashboard > Turnstile > Widget**:
- Domains: `pulpe.app`, `app.pulpe.app`

#### PostHog

**Settings > Toolbar Authorized URLs**:
- `https://pulpe.app`
- `https://app.pulpe.app`

#### Subdomain migration checklist

- [ ] DNS: add CNAME `app` > `cname.vercel-dns.com`
- [ ] Vercel: create `pulpe-landing` project, configure domains + env vars
- [ ] Vercel: update `pulpe-frontend` project (domain `app.pulpe.app`, remove `pulpe.app`/`www.pulpe.app`)
- [ ] Railway: `CORS_ORIGIN=https://app.pulpe.app`
- [ ] Supabase: Site URL > `https://app.pulpe.app`, add redirect URLs
- [ ] Google OAuth: add `https://app.pulpe.app` to authorized origins
- [ ] Turnstile: add `app.pulpe.app`
- [ ] PostHog: add `https://app.pulpe.app` to toolbar URLs
- [ ] Test: landing on `pulpe.app`, app on `app.pulpe.app`, auth flow, Google OAuth, legal pages from iOS

### GitHub Actions Secrets

> Repository Settings → Secrets and variables → Actions → New repository secret

| Secret | Value | Used by |
|--------|-------|---------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI token | Migration CI |
| `PRODUCTION_DB_PASSWORD` | Supabase DB password | Migration CI |
| `PRODUCTION_PROJECT_ID` | Supabase project ref | Migration CI |
| `POSTHOG_PERSONAL_API_KEY` | PostHog personal API key | CI annotations + iOS releases |
| `POSTHOG_WEBAPP_PROJECT_ID` | `87621` | CI annotations + iOS releases (single project for all apps) |

See [POSTHOG_RELEASES.md](./POSTHOG_RELEASES.md) for the full PostHog release architecture.

## Release Process

### 1. Pre-Release Checks

```bash
# Local checks
pnpm build                # Everything builds without error
pnpm quality              # Lint + format + type-check
pnpm test                 # Unit + integration tests
pnpm test:e2e             # E2E tests (Playwright)
pnpm test:performance     # Backend load tests
```

### 2. Versioning (Changesets)

Run `/release` from a clean, synchronized `preview` or `main`. The skill analyzes the diff, obtains approval for the version and release notes, applies the lockstep Changesets bump, updates the relevant What's New surfaces, and creates the release commit without a tag.

Detailed versioning and force-update gate rules: [VERSIONING.md](./VERSIONING.md).

### 3. Production Deployment

Let `SHA` be the release commit created by `/release`.

```bash
# Validate the exact release object on preview
git push origin "$SHA:refs/heads/preview"
# Wait for ci.yml: event push, branch preview, head SHA == $SHA

# Refetch after green CI and reject drift
git fetch origin main preview
test "$(git rev-parse origin/preview)" = "$SHA"
git merge-base --is-ancestor origin/main "$SHA"

# The admin bypass documented in CONTRIBUTING.md permits this direct fast-forward
git push --dry-run origin "$SHA:refs/heads/main"
git push origin "$SHA:refs/heads/main"
```

Never promote `origin/preview` directly: that ref can advance after its validated CI run. Never use a force push.

The `main` push starts Vercel and Railway production deployments immediately through their GitHub integrations. Those webhooks are not delayed by `ci-success`. In GitHub Actions, the main-only `migrate`, `posthog-annotate`, and `verify-prod-csp` jobs do depend on `ci-success`.

Before creating the immutable tag or GitHub Release:

1. Require the `ci.yml` run for event `push`, branch `main`, and exact `SHA` to finish successfully.
2. Require both Vercel production projects and the Railway production deployment to report that same Git SHA and a ready/successful status.
3. Run the three public health checks below.
4. Refetch and confirm `origin/main` still equals `SHA`.

Only then create the tag and GitHub Release. Update Railway `LATEST_WEB_VERSION` after the web release is public and verify `/api/v1/app/version`. Update `LATEST_IOS_VERSION` only after the corresponding marketing version is publicly available on the App Store; otherwise leave it unchanged and complete that operation later.

## Post-Deployment Monitoring

### Automatic Health Checks
- **Frontend (Vercel)**: built-in monitoring
- **Landing (Vercel)**: built-in monitoring
- **Backend (Railway)**: endpoint `/health`
- **Database (Supabase)**: dashboard monitoring

### Manual Checks

```bash
curl https://pulpe.app                           # Landing accessible
curl https://app.pulpe.app                       # Angular app accessible
curl https://api.pulpe.app/health                # Backend API
# PostHog sourcemaps > Vercel build logs: "PostHog source maps processing completed!"
```

## Pre-Production Checklist

- [ ] Supabase: project created + migrations applied
- [ ] Railway: environment variables configured + backend deployed
- [ ] Vercel (frontend): `PUBLIC_*` and PostHog variables configured
- [ ] Vercel (landing): env vars configured (`NEXT_PUBLIC_ANGULAR_APP_URL`, etc.)
- [ ] Custom domain configured (DNS, Vercel x2, Railway, Supabase)
- [ ] E2E tests pass on staging
- [ ] PostHog sourcemaps upload configured
- [ ] Monitoring alerts configured
- [ ] Documentation up to date
- [ ] Recent database backup available

---

**Production issue?** > [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
