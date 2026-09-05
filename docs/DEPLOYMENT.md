# Deployment Guide - Pulpe

## TLDR - Quick Deploy

```text
# 1. Quality check
pnpm quality && pnpm test && pnpm test:e2e

# 2. Run the agent release workflow from a clean, synchronized main
/release
```

`/release` prepares one `release/vX.Y.Z` branch and one version commit, merged into
`main` through its single preparation PR. Approval of the exact version and notes is
the only human release gate. Canonical CI then drives the native auto-merge, staging
proof, migrations, `production` pointer advance, provider proofs, tag/Release and,
when declared, strict App Store validation and review submission.

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

| Branch       | Role                                                                      | Environment                                     |
| ------------ | ------------------------------------------------------------------------- | ----------------------------------------------- |
| `main`       | **Default branch** — trunk + permanent staging. Feature branches PR here. | Staging (Vercel Preview, Railway `preview` env) |
| `production` | **Production pointer** — advanced only by the release publish job.        | Production                                      |

Day-to-day work branches off `main` and merges back via PR; every merge deploys
staging. A release starts from the current `main` head, adds one version commit on
`release/vX.Y.Z`, and merges it back into `main` through its preparation PR — that
merge commit is the candidate. Publishing fast-forwards `production` onto it without
another version change. Staging and production remain independent environments.
Full contributor workflow: [../CONTRIBUTING.md](../CONTRIBUTING.md).

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
supabase unlink
```

This remote bootstrap is only for the newly created project above. The persistent
staging branch follows Git `main`; subsequent production migrations are applied only
by the protected release workflow described below.

- `🏭 Production Release` detects changes in `backend-nest/supabase/migrations/`
  between the last published release and the candidate. That published anchor must be
  a strict ancestor of the candidate; the authorized `production` pointer must equal
  the published anchor; partial production advancement stops for inspection. No
  pull-request job receives production secrets.
- Published migration files are immutable. Every new file starts, before any SQL, with
  `-- pulpe:migration-phase expand` or `-- pulpe:migration-phase contract`. Contract
  files also require `-- pulpe:safe-after vX.Y.Z`; that release tag must already be an
  ancestor of, or content-integrated into, the release baseline.
- Expand migrations reject destructive/security-weakening SQL, `DO`, dynamic
  `EXECUTE`, unsafe required columns and unclassified procedural bodies. Added
  `CHECK` and `FOREIGN KEY` table constraints require `NOT VALID`; `UNIQUE`,
  `PRIMARY KEY`, `EXCLUDE` and unknown immediate constraints belong in a later
  contract migration. A new `CREATE VIEW` is additive, but `CREATE OR REPLACE VIEW`
  is rejected because it can change existing client behavior. Prefer additive tables,
  columns with a default, indexes, policies and explicit `CREATE OR REPLACE FUNCTION`
  definitions.
- On PostgreSQL 17, `NOT VALID` skips the initial table scan for `CHECK` and
  `FOREIGN KEY`, while still enforcing the constraint on new writes. It reduces
  rollout scan and lock pressure; it does not prove compatibility with older clients.
- The checker is deliberately conservative and heuristic, not a PostgreSQL parser or
  a substitute for SQL review. Split ambiguous changes or classify them as contract.
- CI checks the PR range and includes the result in `ci-success`. Production replays
  the exact published-anchor/candidate range before the protected Supabase dry-run
  and apply. It rechecks the authorized `production` SHA immediately before `db push`,
  then queries `supabase_migrations.schema_migrations` and requires the complete remote
  version list to equal the local migration filenames before the pointer can advance.
- Create locally with `supabase migration new [description]`. Never run `db push`
  against the linked production project outside the protected workflow.

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

Initial bootstrap only: `railway link`, `railway up --detach`, then
`railway domain`. Normal production releases always use the event-driven flow
below; operators never run `railway up` for a release.

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

> Production and signing credentials belong to their restricted GitHub Environments. Never expose them to PR jobs.

| Secret                          | Value                    | Used by                                                    |
| ------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`         | Supabase CLI token       | Production Release migrations                              |
| `PRODUCTION_DB_PASSWORD`        | Supabase DB password     | Production Release migrations                              |
| `PRODUCTION_PROJECT_ID`         | Supabase project ref     | Production Release migrations                              |
| `POSTHOG_PERSONAL_API_KEY`      | PostHog personal API key | iOS releases                                               |
| `POSTHOG_WEBAPP_PROJECT_ID`     | `87621`                  | iOS releases                                               |
| `PULPE_RELEASE_APP_ID`          | GitHub App ID            | Advances `production`, tags releases |
| `PULPE_RELEASE_APP_PRIVATE_KEY` | GitHub App private key   | Creates short-lived release tokens                         |
| `RAILWAY_PRODUCTION_TOKEN`      | Railway project token    | Verifies the active production SHA                         |

See [POSTHOG_RELEASES.md](./POSTHOG_RELEASES.md) for the full PostHog release architecture.

### One-time automatic-release setup

This is an infrastructure change, not a release authorization. Merge its PR manually.
Afterward, with explicit owner consent and no release running:

- Enable the repository's native **Allow auto-merge** setting (currently disabled).
- Keep `main` PR-only with required `✅ CI Success`, strict/up-to-date checks and no bypass.
- Remove the **production required reviewer** rule (currently `neogenz`) only after explicit security-setting consent. YAML does not remove it. Keep its secrets and branch restrictions; the automatic caller runs on protected `main`.
- Keep `ios-distribution` restricted to protected `main` for automatic release and internal TestFlight; no reviewer gate. Preserve temporary signing credentials and cleanup.
- The production GitHub App needs Contents write only, for fast-forward `production`, tags and releases. Native PR auto-merge uses the approving releaser's GitHub identity, not an App bypass.
- Read back every changed repository/environment/ruleset setting before starting a release.

## Release Process

The canonical proposal and preparation procedure is [.claude/skills/release/SKILL.md](../.claude/skills/release/SKILL.md).
The owner's approval of the exact version, notes and optional iOS identity authorizes one preparation PR. GitHub does not attest chat approval: the approving releaser creates the one-commit `release/vX.Y.Z` PR and enables native auto-merge for its exact head. Never enable it on the infrastructure PR.

1. Native GitHub auto-merge waits for protected PR CI and creates a merge commit. The approved notes live in `.release/manifest.json`, mirrored in the PR body below the version/head-SHA marker. Do not edit or rebase the approved head.
2. The `main` push runs `staging-proof.yml`: canonical PR CI, exact tested tree, three provider deployments and smoke checks. Feature PRs stop here.
3. Only a release branch continues through `needs` to reusable `production.yml`: verify the one-commit approval, merge parents, exact manifest, unchanged `main` and published production anchor; migration contract → dry-run → apply → migration ledger readback; then fast-forward and read back `production`.
4. The same run calls reusable `production-finalize.yml`. It waits for exact Vercel/Railway deployments, checks public health/version, creates the annotated tag and GitHub Release from committed notes and reads both back. No deployment webhook, cross-run production artifacts or release lock are needed.
5. An iOS contract for this product version calls `ios-distribute.yml` after publication. It verifies the exact production SHA/tag, archives/uploads once, reads back a valid exact build, copies published metadata (no partial metadata directory/deletes), writes approved notes, validates strictly and submits once with `AFTER_APPROVAL`. Apple review is external. Internal TestFlight remains a separate manual dispatch and never submits for review.

The non-cancelling `release-main` concurrency group spans the complete DAG; iOS also shares `ios-distribution` with internal uploads. GitHub concurrency is not a merge freeze or FIFO queue. Avoid merging another PR during a release; if `main` moves, the exact-SHA checks stop rather than silently promoting a newer candidate. Pending runs may be replaced by GitHub; an interrupted release requires inspection, not automatic recovery.

On failure, stop and inspect the run plus remote production/tag/release/ASC state. No force push, provider deploy, compensating rollback or automatic retry. A partially advanced production pointer must be reconciled explicitly. Automatic iOS is first-attempt-only and requires a fresh version/build: an existing build/version, ambiguous upload or partial submission stops without uploading/submitting again. Even a successful Apple mutation can be followed by an eventual-consistency error; inspect the exact remote version before any separately authorized recovery. Never allocate a new identity to hide uncertainty.

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
