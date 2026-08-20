# Release Process Proof and Hardening Implementation Plan

> **For Hermes:** Implement task-by-task with strict RED → GREEN → REFACTOR and small commits.

**Goal:** Make Pulpe's release train provably deadlock-free, deterministic across reruns, free from routine `main → preview` synchronization, and explicit about version and migration compatibility.

**Architecture:** Keep the Railway-owned event-driven model. Model the release as a finite state machine whose terminal publication state is reachable only from trusted, SHA-correlated provider evidence. Replace commit-ancestry coupling with a release-lineage invariant based on trees and the previous promoted candidate. Keep migrations before Railway and require schema changes to be backward-compatible while independently deployed clients may overlap.

**Tech Stack:** GitHub Actions YAML, GitHub REST API/`gh`, Node `node:test`, Bash/JQ, Bun/NestJS, Supabase SQL.

---

## Invariants

1. `production.yml` contains only authorization, migration and Railway pre-deploy preparation; it never waits for or triggers Railway.
2. Railway is the only routine backend production deploy owner and starts only after the pre-deploy check succeeds.
3. `production-finalize.yml` is not a Railway precondition; it accepts only a Railway-created successful status bound to the verified Deployment and active Railway SHA.
4. Publication requires exact production SHA/tree, exact successful pre-deploy run attempt, Vercel success, public health and one immutable proof.
5. Duplicate statuses and reruns are idempotent; failed/skipped later attempts cannot erase an older valid proof.
6. Normal GitHub merge commits on `main` do not require back-merging into `preview`; a main-only hotfix or content divergence fails closed.
7. `LATEST_WEB_VERSION` has one deterministic source and cannot require a post-deploy mutation/redeploy.
8. Migrations executed before independently deployed clients are expand/backward-compatible; destructive contract migrations require an explicit later phase.

## State machine

`candidate_prepared → preview_merged → staging_proven → production_approved → predeploy_authorized → migrations_applied_or_skipped → railway_deployed → providers_correlated → production_proven → published`

Failure from any state is terminal for that attempt. Recovery creates a new attempt/event against the same immutable SHA; it never rewrites history or bypasses a gate.

### Task 1: Executable state-machine scenarios

**Files:**
- Modify: `.github/scripts/ci-security.test.mjs`

**RED:** Add table-driven scenarios for happy path, Railway failure then manual same-SHA redeploy, forged status, wrong active SHA, duplicate success, skipped finalizer run, failed rerun after prior success, and Vercel mismatch. Require only the valid path to reach `published` and publication to occur once.

**Verify RED:** `pnpm test:ci-security` fails because the release transition model is absent.

**GREEN:** Add the smallest pure transition reducer/helper inside the existing test file. Bind every modeled transition to a static YAML assertion so the model cannot silently diverge from workflow guards.

**Verify:** `pnpm test:ci-security` passes.

**Commit:** `test(ci): model release state transitions`

### Task 2: Release lineage without routine back-merges

**Files:**
- Modify: `.github/scripts/ci-security.test.mjs`
- Modify: `.github/workflows/release-promotion.yml`
- Modify: `.claude/skills/release/SKILL.md`
- Modify: `docs/DEPLOYMENT.md`

**Invariant:** Accept when `main` is already an ancestor of the candidate, or when current `main` is a trusted production merge whose tree equals its second-parent promoted candidate and that second parent is an ancestor of the new candidate. Reject a one-parent main commit, a merge whose tree differs from its promoted parent, or a previous candidate absent from the new preview lineage.

**RED:** Add synthetic commit-graph tests for normal sequential releases, main-only hotfix, modified merge result and candidate regression. Add static assertions forbidding bare `behind_by == 0`/`merge-base --is-ancestor origin/main` as the sole release preflight.

**GREEN:** Implement GitHub API lineage verification in both `prepare` and `promote`, and document the same local preflight in the canonical release skill.

**Verify:** `pnpm test:ci-security`, automation formatting, `git diff --check`.

**Commit:** `fix(ci): verify release lineage by promoted trees`

### Task 3: Deterministic web version source

**Files likely:**
- Modify: `backend-nest/src/modules/app-version/app-version-payload.ts`
- Modify: `backend-nest/src/modules/app-version/app-version-payload.spec.ts`
- Modify: `backend-nest/src/config/environment.ts`
- Modify: `backend-nest/src/config/environment.spec.ts`
- Modify: `backend-nest/.env.example`
- Modify: `.github/workflows/production.yml`
- Modify: `docs/VERSIONING.md`, `docs/DEPLOYMENT.md`

**Decision gate:** Prefer embedding `backend-nest/package.json` version in the Bun bundle and using the lockstep product version as web `latestVersion`. Keep only `MIN_WEB_VERSION` as a provider policy variable. First prove JSON import/bundle behavior with a focused test/build; if Bun/NodeNext makes this fragile, retain pre-deploy `--skip-deploys` but add a symmetric preview precondition rather than a post-deploy mutation.

**RED:** Payload test expects web latest version from the build version, not `ConfigService`; environment tests reject reliance on `LATEST_WEB_VERSION`.

**GREEN:** Embed/use build version, remove routine Railway latest-version staging, update docs.

**Verify:** focused Bun tests, backend typecheck/build, public-surface tests, `pnpm quality`.

**Commit:** `refactor(backend): derive web version from build`

### Task 4: Migration compatibility contract

**Files likely:**
- Create: `.github/scripts/check-migration-compatibility.mjs`
- Create: `.github/scripts/check-migration-compatibility.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/production.yml` or `release-gate.yml`
- Modify: `docs/DEPLOYMENT.md`

**Policy:** The release containing new application code may include expand operations and compatible function replacement, but not table/column/type removal, rename, incompatible type conversion, or immediate `SET NOT NULL`. Contract migrations require an explicit marker and a later release after old clients/code have been removed.

**RED:** Fixture tests classify safe `ADD COLUMN`, `CREATE OR REPLACE`, indexes and policies as allowed; destructive column/table operations, rename, incompatible type and immediate `SET NOT NULL` as blocked.

**GREEN:** Implement a changed-migration scanner and run it before production migration dry-run. Keep parsing deliberately narrow and fail closed on recognized destructive forms.

**Verify:** scanner tests, historical migration corpus classification, CI security, `pnpm quality`.

**Commit:** `ci: enforce expand-contract migrations`

### Task 5: Documentation, independent review and CI

**Files:**
- Modify stale release/deployment memory and canonical docs only where they contradict code.

**Steps:**
1. Remove old `serviceInstanceDeployV2`, SHA-only proof and post-deploy version-sync claims.
2. Run Prettier, targeted tests, backend build/typecheck, `pnpm quality`, `git diff --check`.
3. Inspect net LOC and secrets.
4. Request one frozen-diff independent review focused on workflow semantics and recovery.
5. Fix blockers with RED tests, commit, push and wait for #646 CI.

**Completion:** PR #646 is `CLEAN`, all checks green, no provider mutation performed during development, and the documented state machine matches executable guards.

## Risks and controls

- GitHub comparison semantics: use immutable commit/tree API objects, not branch names after initial resolution.
- Workflow/model drift: pair each modeled transition with a static assertion against the responsible YAML guard.
- SQL false positives: classify only schema-destructive syntax; function/trigger/policy replacement remains allowed.
- Scope: stop and split before +300 net LOC from `origin/preview`; current branch is +97 net LOC before this second pass.
- Provider contract: prove orchestration locally and with historical event replay; use preview/canary integration only with explicit provider-mutation approval.
