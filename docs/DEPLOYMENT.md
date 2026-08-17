# Deployment Guide - Pulpe

## TLDR - Quick Deploy

```text
# 1. Quality check
pnpm quality && pnpm test && pnpm test:e2e

# 2. Run the agent release workflow from a clean, synchronized preview
/release
```

`/release` prepares one `release/vX.Y.Z` branch and one version commit. GitHub then
promotes the same candidate through a preparation PR to `preview` and a production
PR to `main`. A human approves production; the protected workflow publishes the tag
and GitHub Release only after the exact production tree and deployments are proven.

## Prerequisites

- Supabase account
- Railway account (backend)
- Vercel account (frontend + landing)
- CLIs installed: `supabase`, `railway`, `vercel`
- Domain `pulpe.app` (see [Custom domain](#custom-domain-pulpeapp))

## Architecture

| Domain                        | Content        | Vercel Project   | Framework               |
| ----------------------------- | -------------- | ---------------- | ----------------------- |
| `pulpe.app` / `www.pulpe.app` | Landing page   | `pulpe-landing`  | Next.js (static export) |
| `app.pulpe.app`               | Angular webapp | `pulpe-frontend` | Angular                 |
| `api.pulpe.app`               | Backend NestJS | Railway          | -                       |

## Branch Model

| Branch    | Role                                                                    | Environment                                     |
| --------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| `preview` | **Default branch** — sprint integration + QA. Feature branches PR here. | Staging (Vercel Preview, Railway `preview` env) |
| `main`    | **Release / production** — fed by `preview` at release time.            | Production                                      |

Day-to-day work branches off `preview` and merges back via PR. A release starts from
the current `preview` head, adds one version commit on `release/vX.Y.Z`, validates its
merge commit in staging, freezes that proven candidate, then promotes it to `main`
without another version change. `preview` and production remain independent
environments. Full contributor workflow: [../CONTRIBUTING.md](../CONTRIBUTING.md).

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

- Migrations run automatically on push to `main` if files changed in
  `backend-nest/supabase/migrations/`. No pull-request job receives the
  production environment or its secrets.
- After the main CI succeeds and the protected `production` environment is
  approved, the migration job verifies its pinned Supabase CLI archive, runs
  `supabase db push --dry-run`, then applies the migration from the same commit.
- To create a new migration: `supabase migration new [description]` then `supabase db push` after editing the generated SQL. Warning: this pushes to the linked (prod) project.

##### Apply migrations locally

```bash
supabase migration up
```

Then `db push` will apply new migrations to the remote database.

#### Pre-rollout data gates

Run this aggregate-only query with read-only production access. It returns no
identity or financial value:

```sql
WITH financial_users AS (
  SELECT user_id FROM monthly_budget WHERE ending_balance IS NOT NULL
  UNION SELECT mb.user_id FROM budget_line bl
    JOIN monthly_budget mb ON mb.id = bl.budget_id
    WHERE bl.amount IS NOT NULL OR bl.original_amount IS NOT NULL
  UNION SELECT mb.user_id FROM transaction tx
    JOIN monthly_budget mb ON mb.id = tx.budget_id
    WHERE tx.amount IS NOT NULL OR tx.original_amount IS NOT NULL
  UNION SELECT t.user_id FROM template_line tl
    JOIN template t ON t.id = tl.template_id
    WHERE tl.amount IS NOT NULL OR tl.original_amount IS NOT NULL
  UNION SELECT user_id FROM savings_goal
    WHERE target_amount IS NOT NULL OR initial_amount IS NOT NULL OR original_target_amount IS NOT NULL
)
SELECT
  count(*) FILTER (WHERE k.user_id IS NULL OR k.key_check IS NULL) AS financial_users_without_key_check,
  count(*) FILTER (WHERE k.user_id IS NOT NULL AND k.wrapped_dek IS NULL) AS vaults_without_wrapped_dek
FROM financial_users f LEFT JOIN user_encryption_key k ON k.user_id = f.user_id;
```

`financial_users_without_key_check` must be zero before the strict backend rollout.
Review `vaults_without_wrapped_dek` separately; never export the matching users.

Railway `MAINTENANCE_MODE=true` freezes the API during a maintenance window: all
non-exempt routes return `503 MAINTENANCE`, while `/health`, `/`,
`/api/v1/maintenance/status`, and `/api/v1/app/version` stay available for control
and rollback. Set it, wait for the deployment, then verify both the public status
and a protected route:

```bash
curl https://api.pulpe.app/api/v1/maintenance/status
# {"maintenanceMode":true,...}
curl -i https://api.pulpe.app/api/v1/budgets
# HTTP 503 with code MAINTENANCE
```

Set `MAINTENANCE_MODE=false`, wait for Railway, then verify `maintenanceMode: false`
and `/health`. Deletion claims live in server-owned `app_metadata`; the runtime has
no fallback to client-writable `user_metadata`.

For a strict vault rollout, publish the iOS client that creates a vault through
`/encryption/setup-recovery` first and wait until it is downloadable from the App
Store. Only then deploy an incompatible backend or raise `MIN_IOS_VERSION`; use the
rollback procedure in [VERSIONING.md](./VERSIONING.md) if the gate was raised early.

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

| Variable                   | Value                               | Description            |
| -------------------------- | ----------------------------------- | ---------------------- |
| `PUBLIC_SUPABASE_URL`      | `https://[PROJECT_REF].supabase.co` | Supabase project URL   |
| `PUBLIC_SUPABASE_ANON_KEY` | `[ANON_KEY]`                        | Supabase anonymous key |
| `PUBLIC_BACKEND_API_URL`   | `https://[RAILWAY_URL]/api/v1`      | Railway backend URL    |
| `PUBLIC_ENVIRONMENT`       | `production`                        | Current environment    |

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

| Variable                        | Value                      | Description                                                                   |
| ------------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ANGULAR_APP_URL`   | `https://app.pulpe.app`    | Webapp URL for CTA links                                                      |
| `NEXT_PUBLIC_SUPABASE_URL`      | (same as frontend project) | Auth redirect detection                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (same as frontend project) | Auth redirect detection                                                       |
| `PUBLIC_POSTHOG_API_KEY`        | `phc_...`                  | PostHog project key (Pulpe Webapp, ID 87621)                                  |
| `PUBLIC_POSTHOG_HOST`           | `/ph`                      | Reverse proxy (see landing/vercel.json)                                       |
| `PUBLIC_POSTHOG_ENABLED`        | `true`                     | Enable analytics                                                              |
| `POSTHOG_PERSONAL_API_KEY`      | `phx_...`                  | Release creation on deploy (see [POSTHOG_RELEASES.md](./POSTHOG_RELEASES.md)) |
| `POSTHOG_CLI_ENV_ID`            | `87621`                    | PostHog project ID (same as webapp)                                           |

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

| Type  | Name | Value                                    |
| ----- | ---- | ---------------------------------------- |
| A     | @    | `76.76.21.21`                            |
| CNAME | www  | `cname.vercel-dns.com`                   |
| CNAME | app  | `cname.vercel-dns.com`                   |
| CNAME | api  | `backend-production-e7df.up.railway.app` |

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
  - `https://app.pulpe.app/reset-password`
  - `https://www.pulpe.app/**`

Les previews Vercel ne doivent pas utiliser `https://*.vercel.app/**`. Si un
callback de preview est nécessaire, ajouter manuellement uniquement le motif
borné au slug réel de l’équipe propriétaire, puis le consigner ici.

**Vérifications manuelles après déploiement du reset iOS**:

- [ ] Les projets Supabase preview et production autorisent exactement `https://app.pulpe.app/reset-password`
- [ ] `https://app.pulpe.app/.well-known/apple-app-site-association` répond en `application/json`
- [ ] Le fichier AASA contient uniquement `AJ37X7C82G.app.pulpe.ios` et `/reset-password`
- [ ] Le lien ouvre l’app signée sur appareil réel
- [ ] Sans l’app, `/reset-password` ouvre le parcours Angular
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

| Secret                          | Value                    | Used by                                                     |
| ------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`         | Supabase CLI token       | Migration CI                                                |
| `PRODUCTION_DB_PASSWORD`        | Supabase DB password     | Migration CI                                                |
| `PRODUCTION_PROJECT_ID`         | Supabase project ref     | Migration CI                                                |
| `POSTHOG_PERSONAL_API_KEY`      | PostHog personal API key | CI annotations + iOS releases                               |
| `POSTHOG_WEBAPP_PROJECT_ID`     | `87621`                  | CI annotations + iOS releases (single project for all apps) |
| `PULPE_RELEASE_APP_ID`          | GitHub App ID            | Opens protected release PRs                                 |
| `PULPE_RELEASE_APP_PRIVATE_KEY` | GitHub App private key   | Creates short-lived release tokens                          |
| `RAILWAY_PREVIEW_TOKEN`         | Railway project token    | Verifies and synchronizes the preview web-version gate      |
| `RAILWAY_PRODUCTION_TOKEN`      | Railway project token    | Verifies and synchronizes the production web-version gate   |

See [POSTHOG_RELEASES.md](./POSTHOG_RELEASES.md) for the full PostHog release architecture.

## Release Process

### 1. Prepare one release candidate

Run `/release` from a clean, synchronized local `preview`. The skill analyzes the
changes, asks approval for the version and multilingual product copy, applies the
Changesets fixed-mode bump, validates the release surfaces, then creates exactly one
commit on `release/vX.Y.Z`. A second explicit approval publishes only that branch and
dispatches `🚦 Release Promotion`.

Detailed versioning and force-update gate rules: [VERSIONING.md](./VERSIONING.md).

### 2. Validate the candidate in preview

1. The GitHub App opens `release/vX.Y.Z → preview`.
2. The preparation PR runs the complete CI matrix and is merged with a merge commit.
3. The current post-merge CI finishes, then Vercel and Railway deploy the independent
   preview environment. Railway's successful `deployment_status` starts
   `✅ Staging Ready (shadow)`; starting it earlier would deadlock with Railway's
   `Wait for CI` setting.
4. `Staging Ready` verifies the canonical PR artifact, identical Git tree, exact
   provider SHAs/statuses and staging health checks.
5. Until that proof is green, do not merge another PR into `preview`. Afterwards,
   normal feature merges may resume: the release branch is advanced to the proven
   merge commit and frozen, so later `preview` changes cannot enter the release.

### 3. Approve and publish production

1. `🚦 Release Promotion` opens `release/vX.Y.Z → main` only for an App-authored
   preparation PR with a valid staging proof. A normal feature PR stops here.
2. `✅ Release Gate` checks the frozen candidate, version, ancestry, absent tag and
   immutable proof without executing untrusted PR code or receiving production secrets.
3. A human other than the App approves and merges the production PR. This is the
   release decision; no administrator push is part of the normal process.
4. `🏭 Production Release` revalidates the approval and proofs, waits for the exact
   `main` CI plus Vercel/Railway production deployments, checks the three public
   endpoints, and records an immutable production proof.
5. Only then does the workflow create `vX.Y.Z`, publish the French GitHub Release and
   synchronize Railway `LATEST_WEB_VERSION` in preview and production. iOS remains
   governed by App Store distribution; the backend resolves its published version
   from Apple.

### 4. Current canary state

The protected workflows are deployed, and the post-Railway staging proof has passed
on a normal preview PR. The first real release still serves as the end-to-end canary.
Until it succeeds, the full `push` CI on `preview` and `main`, the existing required
`✅ CI Success` check and the legacy administrator bypass remain available. They are
not used by the normal release path and are removed only during the documented
cutover in the [release-promotion plan](../aidd_docs/tasks/2026_08/2026_08_16_protected-release-promotion/plan.md).

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
