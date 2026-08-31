# Deployment Guide - Pulpe

## TLDR - Quick Deploy

```text
# 1. Quality check
pnpm quality && pnpm test && pnpm test:e2e

# 2. Run the agent release workflow from a clean, synchronized main
/release
```

`/release` prepares one `release/vX.Y.Z` branch and one version commit, merged into
`main` through its single preparation PR. The manual `🚦 Release Promotion` entry then
drives two modes: `plan` (read-only manifest) and `publish` on the merged `main`
(production environment approval, migrations, `production` pointer advance, provider
deploys, tag and Release).

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
  between the last published release and the candidate. No pull-request job receives
  production secrets.
- Published migration files are immutable. Every new file starts, before any SQL, with
  `-- pulpe:migration-phase expand` or `-- pulpe:migration-phase contract`. Contract
  files also require `-- pulpe:safe-after vX.Y.Z`; that release tag must already be an
  ancestor of, or content-integrated into, the release baseline.
- Expand migrations reject destructive/security-weakening SQL, `DO`, dynamic `EXECUTE`, unsafe required
  columns and unclassified procedural bodies. Prefer additive tables, columns with a
  default, indexes, policies and explicit `CREATE OR REPLACE FUNCTION` definitions.
- The checker is deliberately conservative and heuristic, not a PostgreSQL parser or
  a substitute for SQL review. Split ambiguous changes or classify them as contract.
- CI checks the PR range and includes the result in `ci-success`. Production replays
  the exact published-anchor/candidate range before the protected Supabase dry-run
  and apply.
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

> Repository Settings → Secrets and variables → Actions → New repository secret

| Secret                          | Value                    | Used by                              |
| ------------------------------- | ------------------------ | ------------------------------------ |
| `SUPABASE_ACCESS_TOKEN`         | Supabase CLI token       | Production Release migrations        |
| `PRODUCTION_DB_PASSWORD`        | Supabase DB password     | Production Release migrations        |
| `PRODUCTION_PROJECT_ID`         | Supabase project ref     | Production Release migrations        |
| `POSTHOG_PERSONAL_API_KEY`      | PostHog personal API key | iOS releases                         |
| `POSTHOG_WEBAPP_PROJECT_ID`     | `87621`                  | iOS releases                         |
| `PULPE_RELEASE_APP_ID`          | GitHub App ID            | Advances `production`, tags releases |
| `PULPE_RELEASE_APP_PRIVATE_KEY` | GitHub App private key   | Creates short-lived release tokens   |
| `RAILWAY_PRODUCTION_TOKEN`      | Railway project token    | Verifies the active production SHA   |

See [POSTHOG_RELEASES.md](./POSTHOG_RELEASES.md) for the full PostHog release architecture.

## Release Process

Every production mutation runs behind the GitHub `production` environment
approval; the read-only `plan` mode is the only one without it.

1. Run `/release` from a clean synchronized `main`. It creates one
   `release/vX.Y.Z` commit and its single preparation PR to `main` (body line 1:
   the `pulpe-release` marker; then the `## vX.Y.Z` notes).
2. Merge it once `✅ CI Success` is green, **with a merge commit** — the candidate
   must be a 2-parent merge of the release commit, merged by the repository owner
   (`authorize` re-verifies both). No approving review exists on a solo repository;
   the human authorization is the `production` environment approval in step 4.
   The merge pushes `main`, which deploys staging and produces
   `✅ Staging Ready (shadow)`, bound to the exact workflow run, attempt,
   successful job and artifact.
   Nothing else may land on `main` until publish: the candidate must stay the exact tip.
3. Dispatch `🚦 Release Promotion` in `plan` mode. The read-only job — no
   secret, no environment — resolves the proven staging candidate, verifies it
   is still the tip of `main`, anchors the rollback on the latest published
   release (annotated tag + GitHub Release), replays the content lineage, lists
   the migrations in scope since that anchor and the provider deployment IDs,
   then uploads the `release-plan` manifest with the planned mutations and rollback.
4. Dispatch `publish` on `main`. The reusable `production.yml` re-verifies the
   whole chain, including an exact match between the submitted release branch
   and the preparation PR. A mismatch stops `authorize` before any protected
   job or production mutation. It then waits for the `production` environment approval, keeps the
   migration dry-run → apply order and the replayed migration contract behind
   that environment (skipped entirely when the release carries no migration),
   then `advance` fast-forwards the `production` pointer — the push that
   triggers the Vercel and Railway production deploys — and waits for the exact
   web client.
5. Railway's exact successful production `deployment_status` starts
   `✅ Production Finalized`, which proves Railway, Vercel, `/health` and
   `/api/v1/app/version`, then idempotently publishes `vX.Y.Z` and the GitHub
   Release. That workflow must never be a Railway-required check.

Rollback: applications roll back by redeploying the published anchor recorded in
the plan manifest (Vercel rollback / Railway redeploy of the exact SHA);
migrations stay forward-only — ship a corrective migration instead.

### Release identity and resume

A release intention is identified by its workflow plus its exact fields — version for
`release-promotion.yml`; SHA, marketing version, channel and build number for
`ios-distribute.yml`. Each workflow exposes that identity as its `run-name`
(`🚦 <mode> release/vX.Y.Z`, `📲 iOS <channel> v<version> (<build>) <sha>`), so the
GitHub run list is the source of truth — no client keeps local state, and the GitHub
UI `workflow_dispatch` button and `gh` CLI are the reference interfaces. Agent skills
only prepare inputs, invoke the workflow, and display the derived state.

`node .github/scripts/resolve-release-state.mjs` resolves the unique remote state of
one identity before any dispatch: `absent` (first dispatch allowed),
`active`/`succeeded` (the existing run and open release PR are returned; an identical
invocation is a no-op), `failed` (pass the latest failed run to `--retry <run-id>`,
then dispatch the same identity once from the current protected workflow ref),
`published` (the tag already exists). Do not use `gh run rerun` after a workflow fix:
GitHub would execute the workflow definition and SHA associated with the failed run.
Duplicate active runs, ambiguous branch refs or PRs, drifted PR heads and incomplete
pagination fail closed without mutating anything. Changing any identity field (new
SHA, version, channel or build) is a new intention. The same identity fields feed the
candidate manifest rather than a second format.

### Audit without an agent

In GitHub, open **Actions → Production Finalized** for the production SHA and
verify both successful jobs plus the `production-proof-*` artifact. Then open
**Releases** to verify the immutable annotated tag, and **Branches** to verify that
only `main` and `production` are durable. The same proof is available from the CLI:

```bash
gh release view "v$VERSION" --json tagName,targetCommitish,isDraft,isPrerelease
gh run list --workflow production-finalize.yml --commit "$SHA"
gh run view "$FINALIZER_RUN_ID"
gh run list --workflow ios-distribute.yml --commit "$SHA"
git ls-remote --heads origin main production preview
gh api repos/neogenz/pulpe/rulesets --jq '.[].name'
```

For the first observed release, `v0.47.1` and its annotated tag resolve to
`aefa93bd66cd45ebbfdc0aa474056c63d7e02a1a`; finalizer run `33278908054`
succeeded on attempt 3, and iOS run `33298625338` proved release `1.4.3` build 11.
PR #701 retains the release marker and notes, so the complete intention can be
reconstructed without local agent memory.

### Recovery

- Railway `FAILED`: manually redeploy the **same SHA** once from Railway, then rerun or
  wait for the finalizer. Never call `serviceInstanceDeployV2` or `railway redeploy` in
  the normal workflow.
- Finalizer failure: fix the provider issue, then use **Re-run failed jobs** in the
  same Actions run or `gh run rerun <run-id> --failed`. An identical tag or Release
  is accepted; any contradictory existing object fails closed. Never dispatch a
  second release intention.
- **Tag exists but the GitHub Release is missing**: rerun the finalizer. It accepts the
  exact annotated tag and creates only the missing Release; a mismatch fails closed.
- **Duplicate Railway success**: duplicate events for the same SHA are serialized and
  idempotent. Let the existing finalizer finish or rerun its failed attempt; do not deploy.
- **Main advances**: any commit landing on `main` between the preparation merge and
  `publish` moves the tip away from the candidate, and authorization fails closed.
  Prepare a new release branch from the new head; never force the stale candidate.
- Migration failure: keep recovery forward-only and ship a corrective migration; do
  not automate rollback.
- iOS build already valid succeeds without archive/upload; processing polls the same version/build without allocating or uploading another. A `release` dispatch from `main` without the release tag is accepted only as promotion of an exact, unexpired `internal` upload intent from `main`; it consumes the staging proof and refuses a missing App Store build before Xcode.
- A transient GitHub `HTTP 404` while a just-created staging deployment exposes no status is retried inside the bounded proof loop. Every other API error still fails closed.
- PostHog and CSP diagnostics are useful monitoring signals, not publication gates.

The retired pre-cutover Git branch `preview` ended at
`35117a4fc7930f609c9e4f8708d3307d98842f82`; its ruleset and remote branch were
removed after every active dependency was checked. Recreate that archival ref only
for incident investigation with:

```bash
git push origin 35117a4fc7930f609c9e4f8708d3307d98842f82:refs/heads/preview
```

Detailed versioning and force-update rules: [VERSIONING.md](./VERSIONING.md).

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
