# Continuous Integration

`.github/workflows/ci.yml` is the executable source of truth. It runs once for pull
requests targeting `preview`, with one active run per ref. Pushes and production PRs
reuse immutable evidence instead of rebuilding the same tree.

Security-sensitive workflow contracts are explicit: a read-only token
(`contents: read` is the only workflow permission), `NODE_VERSION: "24"`, and
CLI Supabase 2.113.0. E2E failures are diagnosed through the native Playwright
reporters — GitHub annotations, JUnit and blob — plus the report and
test-results artifacts uploaded on every outcome; no job writes checks or PR
comments.

## Required jobs

```mermaid
flowchart LR
    Classify[Classify] --> Automation[Automation gates]
    Classify --> Workspace[Workspace]
    Classify --> BackendDB[Backend & Database]
    Classify --> IOS[iOS tests]
    Workspace --> E2E[E2E]
    Classify --> Success[CI Success]
    Automation --> Success
    Workspace --> Success
    BackendDB --> Success
    E2E --> Success
    IOS --> Success
    Actionlint[actionlint] --> Success
    Migration[Migration contract] --> Success
```

### Routing

`classify` decides which units a PR must prove. The Git classifier owns only
the boundaries the package graph cannot see; files inside pnpm packages go
through `turbo query` so the existing graph stays the single source of
dependency truth. Any error, unknown surface, or ambiguity degrades to a full
run with its reason, and `✅ CI Success` accepts a skipped unit only when the
decision explicitly declares it not required — the decision is recorded in
`ci-evidence.json` under `routing`. `on.pull_request` keeps no `paths` filter,
so the required check exists (and can never hang Pending) on every PR.

| Change surface                                                                                           | Units that run                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `.github/**` (static automation)                                                                         | Automation gates                         |
| `.github/actions/**`, `.github/scripts/start-supabase.sh` (executed inside runtime jobs)                 | Full run (all units)                     |
| `ios/**`                                                                                                 | Automation gates, iOS tests              |
| `frontend/**`                                                                                            | Workspace (affected), E2E                |
| `backend-nest/**`                                                                                        | Workspace (affected), Backend & Database |
| `landing/**`, `android/**`                                                                               | Workspace (affected)                     |
| `shared/**`, `ios/Pulpe/Domain/Formulas/**`, release branches, root contracts, self-edits, anything else | Full run (all units)                     |

`classify`, `actionlint` and `migration-contract` run on every PR. Self-edits
are `ci.yml`, the classifier and its test, and the CI security test; root
contracts are `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`turbo.json`, `.changeset/config.json` and `android/app.json`. When the
decision is routed, the workspace runs `build`, unit tests and `lint` with
`turbo --affected` against the PR base; full runs execute everything.

- `workspace` is the single Node unit: one checkout, one frozen pnpm install,
  then build, unit tests, lint, format, the root quality gate (repository
  security and vocabulary tests included), `deps:check` (Expo compatibility
  plus the frontend and Android circularity graphs) and the critical audit as
  separate steps sharing the local Turbo cache, before uploading the build
  artifacts E2E consumes. There is no separate install prewarm job: every job
  that needs Node declares its own install and pnpm cache.
- `backend-db` is the single database runner, parallel to `workspace`: it
  starts local Supabase exactly once, runs every SQL suite with
  `ON_ERROR_STOP`, verifies the committed TypeScript types, then runs the Bun
  integration and E2E specs against the same stack — no Supabase state
  artifact crosses runners. Stack images resolve from the GHCR mirror
  (`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`, exported by the
  setup-supabase-cli action) so Public ECR throttling stays off the critical
  path. `postgres-meta` only serves type generation, so both it and the types
  check run only when the PR touches the DB contract (migrations,
  `supabase/config.toml`, `database.types.ts`) — detection fails closed to
  checking. Types are generated into a temporary file and compared to the
  committed `database.types.ts`: a drift fails the job with a readable diff
  and the tracked file is never rewritten.
- `test-e2e` runs the two mocked Playwright projects (`Critical User Journeys`,
  `Feature Tests`) explicitly in one runner — Playwright parallelizes internally
  with a single checkout, pnpm install, Chromium and Angular `webServer`. One
  artifact set (report, JUnit, traces, screenshots, videos) is uploaded on
  every outcome; `Chromium - Smoke` never runs implicitly.
- `automation` runs the root gate that lives outside the packages
  (`pnpm quality:automation`: automation formatting plus the CI, release,
  routing, and lexicon invariant tests) when the workspace does not run — the
  workspace quality gate is a strict superset of it.
- `actionlint` validates workflow syntax and shell fragments.
- `test-ios` generates the Xcode project and runs one `xcodebuild test -scheme
PulpeLocal` invocation on macOS: the scheme compiles the app and the widget,
  then executes the Swift tests. There is no second iOS build workflow.
- `migration-contract` validates new migration metadata, additive SQL and immutable history.
- `ci-success` is the single protected status and fails unless every required
  job succeeded — a unit may be skipped only when the routing decision
  declares it not required.

There is no performance-test job: the former job selected a deleted test file, so Bun ran
zero tests while reporting success.

## Release proofs

The release path reuses the complete CI result from the preparation PR instead
of treating a second build as the identity of the candidate:

```mermaid
flowchart LR
    PR["release/vX.Y.Z → preview"] --> CI["Complete PR CI"]
    CI --> Merge["Merge commit P on preview"]
    Merge --> Deploy["Vercel and Railway preview"]
    Deploy --> Proof["Staging Ready from Railway deployment_status"]
    Proof --> Plan["🚦 Release Promotion · read-only plan"]
    Plan --> Apply["apply · production env approval → production PR"]
    Apply --> Publish["publish on main → production.yml"]
```

`Staging Ready` is triggered by Railway's successful preview `deployment_status`.
When an authorized bypass merges a PR before its canonical CI finishes, the proof
waits on that exact run for at most 30 minutes and fails closed if the run fails,
its state is unknown, the API is unavailable, or `preview` moves.
The proof compares the tested and merged Git trees, requires exact provider SHAs, and
runs staging health checks. A release additionally proves that the release commit and
the merge commit share the same original `preview` base; a feature merged during the
short release freeze therefore stops promotion. Normal preview PRs produce a proof but
are not promoted.

`🚦 Release Promotion` (`release-promotion.yml`) is the single manual release
entry, with three dispatch modes. `plan` runs one read-only job — no secret,
environment, or write permission — that resolves the proven staging candidate,
the fully published current `main`, the content lineage, the migrations in
scope and the provider deployment IDs, then uploads a `release-plan` manifest
with the planned mutations and the rollback anchor. `apply` recomputes that
plan, waits for the GitHub `production` environment approval, then a
short-lived App token freezes the release branch on the candidate
(fast-forward only) and opens the single production PR to `main`. `publish`,
dispatched on `main` after that PR merges, is the sole caller of the reusable
`production.yml`.

## Quality boundary

```bash
pnpm quality
```

This runs package quality tasks through Turbo, checks automation formatting, and executes the
CI security, public-surface, and product-lexicon tests. Angular templates are compiled by the
build job; `tsc` alone does not validate them.

Lefthook runs a change-scoped variant before ordinary commits and skips it during merge and
rebase. CI always runs the complete gate.

## Migrations and production

`production.yml` is exposed only as a reusable `workflow_call` workflow whose
single caller is the `publish` mode of `release-promotion.yml`, dispatched on
`main`. Its jobs authenticate the approved release PR, detect migration
changes against the previous `main`, and only a release containing migrations
enters the protected `production` environment for dry-run and apply — the
migration contract is replayed on the exact merge-parent/merge range before
touching Supabase. Each new migration declares `expand` or `contract` in its
initial comment header, and published files cannot be changed. Once migrations
are in, the `advance` job fast-forwards the `production` branch pointer to the
authorized merge SHA — that push is what triggers the Vercel and Railway
production deployments — and the final job waits for the exact web client.
After provider deployment, `production-finalize.yml` verifies the exact
Railway and Vercel deployments plus the public health and version endpoints,
then publishes the production proof, immutable tag and GitHub Release.

## Local equivalents

```bash
pnpm build
pnpm test
pnpm test:e2e
pnpm quality

cd backend-nest
bun run test:integration
```

Run Supabase commands from `backend-nest/`. Versions used by CI are pinned near the top of the
workflow and in the workspace lockfile.
