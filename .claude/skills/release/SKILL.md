---
name: release
description: Unified release workflow that analyzes git changes, bumps the product version, updates the public changelog, and curates platform-specific web and iOS What's New content. Use when the user says "release", "prepare a release", "bump versions", "préparer une release", or asks to generate release notes.
---

# Release

Analyze code changes to produce a unified product release with clear, user-focused changelog entries in French.

**Release model:** One SemVer version, one git tag (`vX.Y.Z`), one GitHub Release. Every npm sub-package in the workspace mirrors the root version via Changesets `fixed` mode — there is no per-package version drift.

**Source of truth:** the root `package.json` (`pulpe-workspace`). All decisions start from `version` in that file.

**Critical rules:**

- NEVER apply versions without explicit user approval
- NEVER mutate Railway, push, tag, or create a GitHub Release without a separate explicit user approval after local validation
- NEVER push to `main` before `✅ CI Success` is green for the exact release SHA on `preview`
- NEVER tag or create the GitHub Release before that exact SHA is verified in production; update a `LATEST_*` gate only after its client is public (web deployment or App Store)
- NEVER use `--force`, `--force-with-lease`, or `git push --tags`
- If changes are ambiguous, ASK — do not guess
- When uncertain about bump severity, prefer the HIGHER bump
- After bumping, ALL of: root, frontend, landing, backend-nest, shared MUST show the same version. If they don't, stop.
- Use the interaction, file-editing, GitHub, and Railway capabilities available in the current agent. Never assume a Claude Code or Codex-specific tool name.

## Input

Use the user's invocation text as the argument (`$ARGUMENTS` in Claude Code, the full triggering request in Codex).

| Format                  | Meaning                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `depuis le dernier tag` | Analyze since last git tag                                                                            |
| `depuis main`           | Analyze since divergence from main                                                                    |
| _(empty)_               | Default to "depuis le dernier tag"                                                                    |
| `--skip-whats-new`      | Keep public and visible in-app What's New quiet; Step 5c still records an intentional silent release. |

**Flag detection:** Set `SKIP_WHATS_NEW=true` (and strip the flag/keyword from the base reference argument) when ANY of these conditions are met:

1. `$ARGUMENTS` contains `--skip-whats-new`
2. The user said "sans what's new", "skip what's new", "pas de what's new"
3. **The user described the release as technical-only** — phrases like "release technique", "patch interne", "technical-only", "release technique uniquement", "rien de visible utilisateur". Trust the user's framing here even if a single commit looks vaguely user-impacting (cache recovery, telemetry, error handling). The cost of a false-positive toast — user sees "Nouveautés" with nothing meaningful — is much higher than missing a small mention. When the user signals technical-only, just skip.

## Workflow

### Step 0: Release preflight

Run this before modifying release files. A failed check stops the workflow without changing local or remote state.

1. Require a clean worktree, fetch the release branches and tags, and accept only `preview` or `main`:

   ```bash
   test -z "$(git status --porcelain)"
   git fetch origin main preview --tags

   RELEASE_BRANCH=$(git branch --show-current)
   case "$RELEASE_BRANCH" in
     preview|main) ;;
     *) echo "Release must start from preview or main"; exit 1 ;;
   esac

   test "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$RELEASE_BRANCH")"
   git merge-base --is-ancestor origin/main HEAD
   git merge-base --is-ancestor origin/preview HEAD
   ```

   A feature branch must reach `preview` through its normal PR first. Both release branches must already be ancestors of the synchronized `HEAD`: starting from `preview` therefore refuses a hotfix present only on `main`, while starting from `main` refuses a `preview` change that has not been promoted. Resolve either divergence through the normal branch flow before releasing.

2. Resolve the branch ruleset by name, never by a stored numeric id. Require exactly one `main-protection` result and `current_user_can_bypass == "exempt"`:

   ```bash
   RULESET_IDS=$(gh api --paginate repos/neogenz/pulpe/rulesets \
     --jq '.[] | select(.name == "main-protection") | .id')
   test "$(printf '%s\n' "$RULESET_IDS" | grep -c .)" -eq 1
   RULESET_ID=$RULESET_IDS
   test "$(gh api "repos/neogenz/pulpe/rulesets/$RULESET_ID" \
     --jq .current_user_can_bypass)" = "exempt"
   ```

   Without that bypass, direct promotion is impossible for the solo maintainer. Stop rather than opening a release PR that cannot satisfy the self-approval rule.

### Step 1: Determine base reference

```bash
BASE_REF=$(git tag -l "v*" --sort=-creatordate | head -1)
# Fallback if no v* tag exists:
# BASE_REF=$(git tag -l --sort=-creatordate | head -1)
```

If "depuis main": `BASE_REF="main"`

### Step 2: Analyze git changes

Run in parallel:

```bash
git diff $BASE_REF..HEAD --name-only
git log $BASE_REF..HEAD --oneline
git diff $BASE_REF..HEAD --stat
```

**Revert handling:** A `Revert "fix(...): ..."` cancels the original commit. Pair them up and exclude both from the changelog and bump calculation. Only count the net effect.

**Stop immediately** if changes contain ONLY non-functional commits (`refactor:`, `test:`, `chore:`, `ci:`, `docs:`, `style:`, `build:`) or only reverted pairs. Output: "Aucun changeset nécessaire — modifications techniques uniquement."

### Step 3: Detect affected packages

Map files to packages:

| File Pattern      | Package  |
| ----------------- | -------- |
| `frontend/**`     | Frontend |
| `backend-nest/**` | Backend  |
| `shared/**`       | Shared   |
| `landing/**`      | Landing  |
| `ios/**`          | iOS      |

Extract relevant commits per package:

```bash
git log $BASE_REF..HEAD --oneline -- frontend/
git log $BASE_REF..HEAD --oneline -- backend-nest/
git log $BASE_REF..HEAD --oneline -- shared/
git log $BASE_REF..HEAD --oneline -- landing/
git log $BASE_REF..HEAD --oneline -- ios/
```

Only `feat:`, `fix:`, `feat!:`, `BREAKING CHANGE:`, `perf:` trigger version bumps. See [references/semver-conventions.md](references/semver-conventions.md).

### Step 4: Determine product version bump

Read current version from root `package.json` (`version` field) — that is the only version that matters. All sub-packages already mirror it via Changesets fixed mode and will follow automatically in Step 6.

The product version bump is the **highest** across all affected packages:

- ANY `feat!:` or `BREAKING CHANGE:` → **MAJOR**
- ANY `feat:` → **MINOR**
- ANY `fix:` or `perf:` → **PATCH**

Compute the **target version** now (e.g. `0.33.1` + minor → `0.34.0`). You'll need it for Step 6.

Before proposing or writing that version, require all three publication identities to be absent:

- no local `vX.Y.Z` tag;
- no `refs/tags/vX.Y.Z` on `origin`;
- no GitHub Release `vX.Y.Z`.

For the GitHub Release lookup, only a confirmed `404` means absent. Authentication, network, or other API errors stop the workflow.

When `ios/**` changed, resolve the iOS release decision now, before writing changelog data:

1. Read the current `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` from `ios/project.yml`.
2. Classify whether the release ships a user-facing iOS change worth a new App Store version, following the versioning rules in `references/ios-release.md`.
3. Propose `build` when it does not. Otherwise propose `patch`, `minor`, or an explicit target version.
4. Compute the resulting build number and set `IOS_MARKETING_VERSION` to the resulting marketing version. Leave it unset for a build-only release.
5. Include the iOS decision in the Step 5 release proposal. Do not apply it until the releaser approves that proposal.

The iOS what's-new feed compares bundle marketing versions, not the product version. Never copy the product `X.Y.Z` into `IOS_MARKETING_VERSION`.

### Step 5: Propose changelog

**Display the changelog as regular text FIRST, then ask for confirmation.**

Use this exact template for the **proposal** (shown in terminal):

```markdown
## Proposition de release

### Version proposée

**vX.Y.Z** (MINOR)

### Version iOS proposée (si `ios/**` a changé)

**build** (`1.1.0 (42)` → `1.1.0 (43)`) ou **patch** (`1.1.0 (42)` → `1.1.1 (1)`)

### Packages impactés

- Frontend, Backend, iOS

### Notes de release

#### Nouveautés

- **Titre court** — Description en une phrase

#### Corrections

- **Titre court** — Description en une phrase

#### Technique

- Description si pertinent

_Les changements techniques internes ont été exclus._
```

Use this exact template for the **GitHub Release** (created in Step 9):

```markdown
## vX.Y.Z

### Nouveautés

- **Titre court** — Description en une phrase

### Corrections

- **Titre court** — Description en une phrase

### Technique

- Description si pertinent

---

_[Roadmap](https://github.com/neogenz/pulpe/milestones) — [Issues](https://github.com/neogenz/pulpe/issues)_
```

Rules for writing notes:

- French with proper accents (é, è, ê, à, ù, ô, î, ç, etc.) — NEVER omit accents
- No emojis, no package names
- Grouped by type (Nouveautés / Corrections / Technique), NOT by package
- User-focused: describe what changed for the user, not technical details
- Each entry: **bold short title** + em dash + one sentence description
- Omit empty sections (if no corrections, skip "Corrections")
- Footer with links to roadmap and issues
- Release title is always `vX.Y.Z` — nothing else added
- Keep an internal scope for every proposed feature/fix (`web`, `ios`, or both), derived from the actual diff and consumers. Do not publish these scope labels.
- Never assume every note applies to every platform because the release-level `platforms` array contains both. Ask before approval when an item's scope is ambiguous.

Then ask: "Approuves-tu cette proposition ?" → "Oui, appliquer" / "Non, ajuster" using the current agent's available user-input mechanism.

### Step 5b: Update landing changelog data

**Skip if `SKIP_WHATS_NEW=true`.** When the user signaled a technical-only release (or passed `--skip-whats-new`), the public landing changelog page on pulpe.app/changelog must ALSO stay quiet — the same logic that hides the in-app toast must hide the public-facing entry. Otherwise you'd publish "fix télémétrie" or similar internal infrastructure work to all visitors of the marketing site, which is exactly the v0.33.1-class mistake one layer further out. The git tag and GitHub Release (Step 9) still record the version for internal traceability.

Otherwise, update `landing/data/releases.json` with the new release.

**Procedure:**

1. Read `landing/data/releases.json`.
2. Build a new release object from the approved Step 5 data:

```json
{
  "version": "X.Y.Z",
  "iosVersion": "1.2.0",
  "date": "YYYY-MM-DD",
  "githubUrl": "https://github.com/neogenz/pulpe/releases/tag/vX.Y.Z",
  "platforms": ["web", "ios"],
  "changes": {
    "features": [
      { "title": "Titre court", "description": "Description en une phrase" }
    ],
    "fixes": [],
    "technical": []
  }
}
```

3. Insert it at position 0 (first element) of the array
4. Write back the full JSON with `JSON.stringify(releases, null, 2)` using the available file-editing tool.

**Field rules:**

| Field               | Value                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `version`           | Version from Step 4 (without `v` prefix)                                                                     |
| `iosVersion`        | `IOS_MARKETING_VERSION` confirmed in Step 4; include only when the release ships a new iOS marketing version |
| `date`              | Today's date in `YYYY-MM-DD` format                                                                          |
| `githubUrl`         | `https://github.com/neogenz/pulpe/releases/tag/vX.Y.Z`                                                       |
| `platforms`         | Derived from affected packages (see mapping below)                                                           |
| `changes.features`  | From approved "Nouveautés" entries                                                                           |
| `changes.fixes`     | From approved "Corrections" entries                                                                          |
| `changes.technical` | From approved "Technique" entries                                                                            |

Each entry: `{ "title": "Bold title from Step 5", "description": "Description from Step 5" }`

**Platform mapping** — derived from packages that contributed at least one **bump-triggering commit** in Step 3 (i.e. `feat:`, `fix:`, `feat!:`, `BREAKING CHANGE:`, `perf:`). Files touched only by `chore:`/`refactor:`/`test:`/`docs:`/`ci:`/`build:`/`style:` commits do NOT count, even though they live under one of the package paths.

- `frontend/**`, `backend-nest/**`, `shared/**`, `landing/**` (with bumping commits) → `"web"`
- `ios/**` (with bumping commits) → `"ios"`
- `android/**` (with bumping commits) → `"android"` (future)

Deduplicate: if both frontend and backend contributed bumping commits, `"web"` appears once.
Empty sections stay as `[]` (never omit the key).

### Step 5b-bis: Sync iOS whats-new backend data

**Skip if `SKIP_WHATS_NEW=true`** (same rule as Step 5b — a technical-only release must stay invisible to the iOS "what's new" dialog too).

**Auto-skip silently** if `"ios"` is not in the `platforms` array computed in Step 5b or `IOS_MARKETING_VERSION` is unset. A build-only release does not change the version observed by clients, so it cannot produce a new one-shot dialog.

The iOS app's "what's new" dialog (PUL-186) is served by `backend-nest/src/modules/whats-new/`, which reads a TypeScript literal — not `landing/data/releases.json` directly, because the deployed backend artifact (`pnpm --filter=backend-nest --prod deploy`) never includes the `landing/` package. `landing/data/releases.json` remains the source for release metadata and approved copy, but the backend entry is an **iOS-specific projection**, not a blind copy of every release item.

**Procedure:**

1. Read the curation rules in [references/ios-release.md](references/ios-release.md), then read `backend-nest/src/modules/whats-new/domain/releases-data.ts`.
2. Filter the approved "Nouveautés" and "Corrections" using the internal scope from Step 5. Keep only items scoped to `ios` that meet the user-value threshold. Never copy web-only items or the complete mixed-platform release blindly.
3. Keep at most 4 items total. Prioritize new capabilities, then fixes to frequent/core flows, then visible UX improvements. Ask if the cutoff is ambiguous.
4. If ZERO items survive, append one unique `{ version, reason }` entry to `SILENT_IOS_RELEASES`. The reason must concretely identify why the approved notes did not meet the iOS dialog threshold; reject an empty reason. State: "Pas de What's New iOS pour cette version."
5. Otherwise prepend an iOS projection with the same `version`/`iosVersion`/`date`/`platforms` metadata as Step 5b, omit `githubUrl`, set `changes.features` and `changes.fixes` to the curated iOS items, and set `changes.technical` to `[]`.
6. Before writing either mode, require the current product version to be absent from both `RELEASES` and `SILENT_IOS_RELEASES`. A projection and a silence may never overlap.
7. Write back using the available file-editing tool, matching the existing TypeScript formatting.

Never invent a generic stability or security item to fill the dialog. A marketing release with no meaningful user-facing note must produce no dialog; `SILENT_IOS_RELEASES` records that decision without adding anything to the feed.

Record exactly one iOS release mode for Step 7:

- `skip` when `SKIP_WHATS_NEW=true`
- `build` when the approved decision changes only the build number
- `projection` when a curated backend entry was added
- `silent` when the marketing version changed with one motivated `SILENT_IOS_RELEASES` entry and no projection

For `projection`, `build`, and `skip`, the current product version must be absent from `SILENT_IOS_RELEASES`.

### Step 5c: Update webapp "What's New" toast

Every product version must choose exactly one webapp mode in `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts`:

- `toast`: update `LATEST_RELEASE` to the exact product version and keep that version out of `SKIPPED_RELEASES`;
- `silent`: leave `LATEST_RELEASE` unchanged and append the exact product version plus a concrete, non-empty reason to `SKIPPED_RELEASES`.

Use `silent` when `SKIP_WHATS_NEW=true` (set by `--skip-whats-new`, an equivalent phrase, or a technical-only signal). Record why the approved release is intentionally quiet; do not merely leave the file untouched.

Also use `silent` without asking when no affected package is webapp-relevant (only `ios/` and/or `landing/` changed). Use a reason that names that scope.

If webapp packages changed but filtering leaves zero displayable items, ask: "Aucune nouveauté pertinente pour la webapp. Souhaites-tu mettre à jour le toast quand même ?" → "Oui" / "Non, sauter". Choosing "Non" selects `silent` and records the reason.

For `toast` mode:

1. Read the file.
2. Filter the approved "Nouveautés" and "Corrections" entries to keep only webapp-relevant items.
3. Replace `LATEST_RELEASE` with the exact Step 4 version and filtered entries.
4. Verify that version is absent from `SKIPPED_RELEASES`.

For `silent` mode:

1. Keep `LATEST_RELEASE` unchanged.
2. Append one unique `{ version, reason }` entry for the exact Step 4 version.
3. Reject an empty reason, a duplicate, or a version equal to `LATEST_RELEASE.version`.

**Template:**

```typescript
export const LATEST_RELEASE: WhatsNewRelease = {
  version: "X.Y.Z",
  features: ["Titre court de la nouveauté 1", "Titre court de la nouveauté 2"],
};

export const SKIPPED_RELEASES: readonly SkippedWhatsNewRelease[] = [
  {
    version: "X.Y.Z",
    reason: "Raison concrète approuvée pour cette release silencieuse",
  },
];
```

**Scope rules — webapp users only:**

- **Include**: Changes visible to Angular webapp users — UI changes, new pages, UX improvements, behavior changes triggered by backend modifications that affect the webapp experience
- **Exclude**: iOS-only features, landing page changes, purely technical/infra changes, backend-only changes invisible to users
- If only "Corrections" are relevant (no "Nouveautés" for the webapp), use the most impactful fix titles instead

**Writing rules — pas d'anglicismes:**

- Écrire en français courant, sans anglicismes (ex: "libellés" au lieu de "wording", "modèle" au lieu de "template", "mise en cache" au lieu de "cache")
- `version`: Same as Step 4 (without `v` prefix) — must match the bumped `package.json` version so `buildInfo.version === LATEST_RELEASE.version`
- `features`: Short titles only, no descriptions — max ~50 chars per line
- Max 3-4 features to keep the toast concise
- Keep the existing release types and `SKIPPED_RELEASES` history unchanged except for the current version's explicit decision

### Step 6: Apply versions

Execute ONLY after user confirms.

1. **Bump root product version** in root `package.json` — use the available file-editing tool to replace the `"version"` field with the target version computed in Step 4.

2. **Bump all JS/TS sub-packages via Changesets fixed mode** — this is NOT optional and NOT conditional on which packages were touched. Fixed mode keeps all four npm packages in lockstep with root. See [references/jsts-release.md](references/jsts-release.md) for the exact procedure (create one changeset file at the right bump level, then `pnpm changeset version`).

3. **Sanity check the lockstep** — after Step 6.2, all five versions MUST match:

   ```bash
   grep -H '"version"' package.json frontend/package.json landing/package.json backend-nest/package.json shared/package.json
   ```

   **If they don't match, recover before continuing:**
   - **Diagnosis A — bump level mismatch.** Most common. The root was bumped to (say) `0.34.0` but the changeset said `patch`, so sub-packages went to `0.33.2`. Fix: re-edit root `package.json` to match what fixed mode produced (the four sub-package versions are the ground truth here, since they reflect the actual bump level in the changeset file). OR fix the changeset bump level and re-run `pnpm changeset version` — but only if the changeset hasn't been consumed yet.
   - **Diagnosis B — `.changeset/config.json` lost its `fixed` group.** Rare, but possible if someone reset the file. Symptom: only ONE sub-package bumped. Fix: restore the `fixed` array (see `references/jsts-release.md`), reset all sub-package versions to match root manually, re-run.
   - **Diagnosis C — packages were already drifted before the run.** Symptom: bump amounts look right but starting points were different. Fix: align all sub-packages to root's pre-bump version, then re-run from Step 6.1.

   In all three cases, end with a fresh sanity check and only continue when all five versions match.

4. **iOS** (only if `ios/**` files changed): Apply the decision approved in Step 5 using [references/ios-release.md](references/ios-release.md). After the command, verify the resulting `MARKETING_VERSION` equals `IOS_MARKETING_VERSION` when that value is set. iOS is intentionally NOT in the Changesets fixed group — Changesets only sees npm packages.

### Step 7: Quality check

Run the checked-in What's New contracts from the repository root for every release:

```bash
(cd backend-nest && bun test src/modules/whats-new/domain/releases-data.parity.spec.ts)
(cd frontend && pnpm exec vitest run \
  projects/webapp/src/app/layout/whats-new/whats-new-releases.spec.ts \
  projects/webapp/src/app/layout/whats-new/whats-new-toast.spec.ts)
```

Stop on any contract failure. These targeted tests are the local fail-fast gate; the complete CI after the `preview` and `main` pushes remains the second barrier.

When `ios/**` changed, validate the exact release outcome from the repository root before running quality. Pass the resulting `MARKETING_VERSION` for every mode:

```bash
# New marketing version with curated iOS notes
bun .claude/skills/release/scripts/validate-ios-release.ts X.Y.Z A.B.C projection

# New marketing version without a relevant dialog
bun .claude/skills/release/scripts/validate-ios-release.ts X.Y.Z A.B.C silent

# Build-only release, public changelog kept
bun .claude/skills/release/scripts/validate-ios-release.ts X.Y.Z A.B.C build

# Technical-only release, all public What's New surfaces skipped
bun .claude/skills/release/scripts/validate-ios-release.ts X.Y.Z A.B.C skip
```

Use exactly one mode from the decision table in [references/ios-release.md](references/ios-release.md). Stop on any validation error; do not convert it into a warning.

```bash
pnpm quality
```

Fix issues before proceeding.

### Step 8: Stage release files

Stage only release files. Under fixed mode, **all four sub-packages always change** even when only one was named in the changeset, so always stage all of them:

```bash
# Always: root + all four sub-package versions and changelogs (fixed mode bumped them all)
git add \
  package.json \
  frontend/package.json frontend/CHANGELOG.md \
  landing/package.json landing/CHANGELOG.md \
  backend-nest/package.json backend-nest/CHANGELOG.md \
  shared/package.json shared/CHANGELOG.md \
  .changeset/

# Only if Step 5b was NOT skipped (i.e. SKIP_WHATS_NEW=false):
git add landing/data/releases.json

# Only if Step 5b-bis produced an iOS projection or explicit silence:
git add backend-nest/src/modules/whats-new/domain/releases-data.ts

# Step 5c always records either the toast or the intentional silent release:
git add frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts

# Only if iOS files changed in this release:
git add ios/project.yml
```

Run `git status` and confirm only the expected files are staged. If anything unrelated landed in the staging area (an unrelated edit you forgot, an untracked file `git add .changeset/` accidentally picked up), unstage it before continuing — release commits should be 100% mechanical.

**Notes:**

- `ios/Pulpe.xcodeproj/` is gitignored (regenerated by xcodegen). Do NOT try to stage it.
- Per-package `CHANGELOG.md` files all get new entries even for packages whose code didn't change — that's expected under fixed mode (see `references/jsts-release.md`).

### Step 9: Validate, promote, and publish the exact SHA

Show the commit, target branches, tag, GitHub Release, provider checks, and pending Railway gate changes. Then ask: "Prêt à valider sur preview, promouvoir ce SHA vers main et publier la release ?"

Only after "oui":

Treat every shell block below as an independent session. Recompute and validate every identity in the same block that consumes it; never rely on a variable exported by a previous block or tool call.

1. Confirm that the available Railway and Vercel capabilities can inspect production deployments and their Git commit metadata. Also confirm that the Railway integration can apply the pending web gate after deployment. If any required capability is missing, stop before committing; never skip a proof or invent a command.
2. Create the release commit without a tag and freeze its identity:

   ```bash
   set -euo pipefail
   git commit -m "chore(release): vX.Y.Z"
   SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test -n "${SHA}"
   VERSION=$(node -p "require('./package.json').version")
   test -n "${VERSION}"
   TAG="v${VERSION}"
   ```

3. Push only that object to `preview`, regardless of whether the workflow started on `preview` or `main`:

   ```bash
   set -euo pipefail
   SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test -n "${SHA}"
   git push origin "${SHA}:refs/heads/preview"
   ```

4. Poll for up to 5 minutes until `gh run list` returns the `ci.yml` run whose `headSha` is the release SHA, `headBranch` is `preview`, and event is `push`. Do not filter cancelled runs. Resolve and consume the run id in the same session:

   ```bash
   set -euo pipefail
   SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test -n "${SHA}"
   PREVIEW_RUN_ID=
   for _ in $(seq 1 60); do
     PREVIEW_RUN_ID=$(gh run list \
       --workflow ci.yml \
       --branch preview \
       --event push \
       --commit "${SHA}" \
       --limit 20 \
       --json databaseId,headSha,headBranch,event \
       --jq '.[] | [.databaseId, .headSha, .headBranch, .event] | @tsv' |
       awk -v sha="${SHA}" '$2 == sha && $3 == "preview" && $4 == "push" { print $1; exit }')
     test -n "${PREVIEW_RUN_ID}" && break
     sleep 5
   done
   test -n "${PREVIEW_RUN_ID}"
   gh run watch "${PREVIEW_RUN_ID}" --exit-status
   ```

   Missing, cancelled, or failed CI means stop. Fix the release on `preview`; do not promote it.

5. After green CI, refetch and reject any drift or loss of ancestry:

   ```bash
   set -euo pipefail
   SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test -n "${SHA}"
   git fetch origin main preview
   test "$(git rev-parse origin/preview)" = "${SHA}"
   git merge-base --is-ancestor origin/main "${SHA}"
   git push --dry-run origin "${SHA}:refs/heads/main"
   ```

   The dry-run checks fast-forward feasibility, not ruleset authorization. The Step 0 bypass check remains mandatory.

6. Promote the same immutable object, never the mutable `origin/preview` ref:

   ```bash
   set -euo pipefail
   SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test -n "${SHA}"
   git push origin "${SHA}:refs/heads/main"
   git fetch origin main
   test "$(git rev-parse origin/main)" = "${SHA}"
   ```

7. Poll for up to 5 minutes for the `ci.yml` run whose `headSha` is the release SHA, `headBranch` is `main`, and event is `push`. Do not filter cancelled runs. Resolve and consume the run id in the same session:

   ```bash
   set -euo pipefail
   SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test -n "${SHA}"
   MAIN_RUN_ID=
   for _ in $(seq 1 60); do
     MAIN_RUN_ID=$(gh run list \
       --workflow ci.yml \
       --branch main \
       --event push \
       --commit "${SHA}" \
       --limit 20 \
       --json databaseId,headSha,headBranch,event \
       --jq '.[] | [.databaseId, .headSha, .headBranch, .event] | @tsv' |
       awk -v sha="${SHA}" '$2 == sha && $3 == "main" && $4 == "push" { print $1; exit }')
     test -n "${MAIN_RUN_ID}" && break
     sleep 5
   done
   test -n "${MAIN_RUN_ID}"
   gh run watch "${MAIN_RUN_ID}" --exit-status
   ```

   This includes the main-only `migrate`, `posthog-annotate`, and `verify-prod-csp` jobs after `ci-success`. Missing, cancelled, or failed CI stops publication.
8. Independently inspect the production deployments:
   - both Vercel production projects are ready and report the commit returned by a fresh `git rev-parse --verify 'HEAD^{commit}'`;
   - the Railway production deployment is successful and reports that same freshly resolved commit;
   - `https://pulpe.app`, `https://app.pulpe.app`, and `https://api.pulpe.app/health` respond successfully.

   Vercel and Railway react to GitHub pushes; do not assume GitHub `ci-success` delayed those webhooks. If a status, SHA, or health check differs, stop without a tag, GitHub Release, or client gate. Correct through `preview` while keeping the same product version.

9. Only after every production proof passes, refetch `main` and tags, require `origin/main` to equal the release SHA, and recheck that the local tag, remote tag, and GitHub Release are still absent. Then create and push the one immutable tag:

   ```bash
   set -euo pipefail
   SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test -n "${SHA}"
   VERSION=$(node -p "require('./package.json').version")
   test -n "${VERSION}"
   TAG="v${VERSION}"
   git fetch origin main --tags
   test "$(git rev-parse origin/main)" = "${SHA}"
   git tag -a "${TAG}" "${SHA}" -m "Release ${TAG}"
   git push origin "refs/tags/${TAG}"
   ```

10. Create the GitHub Release using the **GitHub Release template** from Step 5:

```bash
set -euo pipefail
VERSION=$(node -p "require('./package.json').version")
test -n "${VERSION}"
TAG="v${VERSION}"
gh release create "${TAG}" --repo neogenz/pulpe --title "${TAG}" --notes "$(cat <<'EOF'
## vX.Y.Z

### Nouveautés
- **Titre** — Description

### Corrections
- **Titre** — Description

---

*[Roadmap](https://github.com/neogenz/pulpe/milestones) — [Issues](https://github.com/neogenz/pulpe/issues)*
EOF
)"
```

11. Apply the pending `LATEST_WEB_VERSION` update from [references/jsts-release.md](references/jsts-release.md) in `preview` and `production`, then verify `GET /api/v1/app/version`.
12. If the iOS marketing version changed, follow [references/ios-release.md](references/ios-release.md):
    - App Store version publicly available: apply and verify `LATEST_IOS_VERSION`;
    - not yet available: leave both environments unchanged and report the deferred post-App-Store operation.

Release rules:

- Release title is always `vX.Y.Z` — nothing else
- Omit empty sections (no corrections? skip the section)
- Footer links always present

## Maintenance: Re-align an already published GitHub Release

This is separate from the normal release workflow.

If `landing/data/releases.json` changes for an already tagged version:

1. Rebuild the GitHub notes from the approved landing copy.
2. Show the exact public diff against the current GitHub Release.
3. Explain that no automated parity test covers this surface.
4. Ask for explicit approval of that edit.
5. Only after approval, run `gh release edit "vX.Y.Z" --notes "…"`.
