---
name: release
description: Unified release workflow that analyzes git changes, bumps the product version, updates the public changelog, and curates platform-specific web and iOS What's New content. Use when the user says "release", "prepare a release", "bump versions", "préparer une release", or asks to generate release notes.
---

# Release

Analyze code changes to produce a unified product release with clear, user-focused product copy in French, English, German, and Italian. French remains canonical and is the only copy published on GitHub.

**Release model:** One SemVer version, one git tag (`vX.Y.Z`), one GitHub Release. Every npm sub-package in the workspace mirrors the root version via Changesets `fixed` mode — there is no per-package version drift.

**Source of truth:** the root `package.json` (`pulpe-workspace`). All decisions start from `version` in that file.

**Critical rules:**

- NEVER apply versions without explicit user approval
- NEVER push directly to `preview` or `main`, create a tag, publish a GitHub Release, or mutate Railway from this skill
- NEVER push the prepared `release/vX.Y.Z` branch or dispatch its PR without a separate explicit user approval after local validation
- The GitHub App may open release PRs and fast-forward the proven release branch only; it has no ruleset bypass and cannot approve its own production PR
- NEVER tag or create the GitHub Release before the exact candidate tree is verified in production; update a `LATEST_*` gate only after its client is public (web deployment or App Store)
- NEVER use `--force`, `--force-with-lease`, or `git push --tags`
- If changes are ambiguous, ASK — do not guess
- When uncertain about bump severity, prefer the HIGHER bump
- After bumping, ALL of: root, frontend, landing, backend-nest, shared, Android package and Android app MUST show the same version. If they don't, stop.
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

1. Require a clean, synchronized `preview` worktree and fetch the release branches and tags:

   ```bash
   test -z "$(git status --porcelain)"
   git fetch origin main preview --tags

   test "$(git branch --show-current)" = preview
   test "$(git rev-parse HEAD)" = "$(git rev-parse origin/preview)"
   node .github/scripts/check-release-lineage.mjs "$(git rev-parse origin/main)" "$(git rev-parse HEAD)"
   ```

   A feature branch must reach `preview` through its normal PR first. A hotfix present only on `main` must be reconciled through the normal branch flow before releasing.

2. Require all three trusted production workflows and their three credential names. Secret values are never readable and must not be requested:

   ```bash
   gh workflow view release-promotion.yml --repo neogenz/pulpe >/dev/null
   gh workflow view production.yml --repo neogenz/pulpe >/dev/null
   gh workflow view production-finalize.yml --repo neogenz/pulpe >/dev/null
   SECRET_NAMES=$(gh secret list --repo neogenz/pulpe --json name --jq '.[].name')
   grep -qx PULPE_RELEASE_APP_ID <<< "$SECRET_NAMES"
   grep -qx PULPE_RELEASE_APP_PRIVATE_KEY <<< "$SECRET_NAMES"
   grep -qx RAILWAY_PRODUCTION_TOKEN <<< "$SECRET_NAMES"
   ```

   Missing workflow or secret names stops preparation before any release file changes.

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
| `android/**`      | Android  |

Extract relevant commits per package:

```bash
git log $BASE_REF..HEAD --oneline -- frontend/
git log $BASE_REF..HEAD --oneline -- backend-nest/
git log $BASE_REF..HEAD --oneline -- shared/
git log $BASE_REF..HEAD --oneline -- landing/
git log $BASE_REF..HEAD --oneline -- ios/
git log $BASE_REF..HEAD --oneline -- android/
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

### Notes de release — FR canonique

#### Nouveautés

- **Titre court** — Description en une phrase

#### Corrections

- **Titre court** — Description en une phrase

#### Technique

- Description si pertinent

_Les changements techniques internes ont été exclus._

### Product copy — EN

Repeat the same visible sections and items in English.

### Produkttexte — DE

Repeat the same visible sections and items in German, using Swiss spelling without `ß`.

### Testi del prodotto — IT

Repeat the same visible sections and items in Italian.
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

- Present and approve all four product copies together. An item, section, title, or description missing in EN, DE, or IT blocks the release.
- French is canonical and uses proper accents (é, è, ê, à, ù, ô, î, ç, etc.). Never omit accents.
- Translate only visible product copy. Keep event names, analytics properties, internal categories (`features`, `fixes`, `technical`), projection scopes, SEO mechanics, and other technical identifiers in English.
- Build the GitHub Release exclusively from the approved French copy. Never append the other languages to it.
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

Do not backfill historical releases. The French page remains the complete archive; translated pages intentionally render only entries carrying a complete `translations` object and link to that French archive.

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
  },
  "translations": {
    "en": { "changes": { "features": [], "fixes": [], "technical": [] } },
    "de": { "changes": { "features": [], "fixes": [], "technical": [] } },
    "it": { "changes": { "features": [], "fixes": [], "technical": [] } }
  }
}
```

3. Insert it at position 0 (first element) of the array
4. Write back the full JSON with `JSON.stringify(releases, null, 2)` using the available file-editing tool.

**Field rules:**

| Field               | Value                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `version`           | Version from Step 4 (without `v` prefix)                                                                       |
| `iosVersion`        | `IOS_MARKETING_VERSION` confirmed in Step 4; include only when the release ships a new iOS marketing version   |
| `date`              | Today's date in `YYYY-MM-DD` format                                                                            |
| `githubUrl`         | `https://github.com/neogenz/pulpe/releases/tag/vX.Y.Z`                                                         |
| `platforms`         | Derived from affected packages (see mapping below)                                                             |
| `changes.features`  | From approved "Nouveautés" entries                                                                             |
| `changes.fixes`     | From approved "Corrections" entries                                                                            |
| `changes.technical` | From approved "Technique" entries                                                                              |
| `translations`      | Approved EN/DE/IT copies with exactly the same visible fields, categories, and item counts as canonical French |

Each entry: `{ "title": "Bold title from Step 5", "description": "Description from Step 5" }`. Keep French in the top-level fields and EN/DE/IT under `translations`; do not add a duplicate `fr` translation.

**Platform mapping** — derived from packages that contributed at least one **bump-triggering commit** in Step 3 (i.e. `feat:`, `fix:`, `feat!:`, `BREAKING CHANGE:`, `perf:`). Files touched only by `chore:`/`refactor:`/`test:`/`docs:`/`ci:`/`build:`/`style:` commits do NOT count, even though they live under one of the package paths.

- `frontend/**`, `backend-nest/**`, `shared/**`, `landing/**` (with bumping commits) → `"web"`
- `ios/**` (with bumping commits) → `"ios"`
- `android/**` (with bumping commits) → `"android"`

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
5. Otherwise prepend an iOS projection with the same `version`/`iosVersion`/`date`/`platforms` metadata as Step 5b, omit `githubUrl`, set canonical French `changes.features` and `changes.fixes` to the curated iOS items, set `changes.technical` to `[]`, and add the exact EN/DE/IT equivalents under `translations`.
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
  features: {
    fr: ["Titre court 1", "Titre court 2"],
    en: ["Short title 1", "Short title 2"],
    de: ["Kurzer Titel 1", "Kurzer Titel 2"],
    it: ["Titolo breve 1", "Titolo breve 2"],
  },
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

- Write each visible item in FR/EN/DE/IT. Use current, natural product language; in French, avoid anglicisms (for example "libellés" instead of "wording", "modèle" instead of "template").
- `version`: Same as Step 4 (without `v` prefix) — must match the bumped `package.json` version so `buildInfo.version === LATEST_RELEASE.version`
- `features`: Short titles only, no descriptions — max ~50 chars per line
- Max 3-4 features to keep the toast concise
- Keep the existing release types and `SKIPPED_RELEASES` history unchanged except for the current version's explicit decision

### Step 6: Apply versions

Execute ONLY after user confirms.

0. **Create the unique release branch** after rechecking that `preview` has not moved:

   ```bash
   git fetch origin preview
   test "$(git branch --show-current)" = preview
   test "$(git rev-parse HEAD)" = "$(git rev-parse origin/preview)"
   test -z "$(git branch --list "release/vX.Y.Z")"
   test -z "$(git ls-remote --heads origin "refs/heads/release/vX.Y.Z")"
   git switch -c "release/vX.Y.Z"
   ```

1. **Bump root product version** in root `package.json` — use the available file-editing tool to replace the `"version"` field with the target version computed in Step 4.

2. **Bump all JS/TS sub-packages via Changesets fixed mode** — this is NOT optional and NOT conditional on which packages were touched. Fixed mode keeps all five npm packages in lockstep with root, including the private Android workspace. See [references/jsts-release.md](references/jsts-release.md) for the exact procedure (create one changeset file at the right bump level, then `pnpm changeset version`).

3. **Sync the Expo manifest and sanity-check the lockstep** — after Step 6.2, copy the approved target version into `android/app.json`. All seven product-version fields MUST then match:

   ```bash
   grep -H '"version"' package.json frontend/package.json landing/package.json backend-nest/package.json shared/package.json android/package.json android/app.json
   ```

   **If they don't match, recover before continuing:**
   - **Diagnosis A — bump level mismatch.** Most common. The root was bumped to (say) `0.34.0` but the changeset said `patch`, so sub-packages went to `0.33.2`. Fix: re-edit root `package.json` to match what fixed mode produced (the five sub-package versions are the ground truth here, since they reflect the actual bump level in the changeset file). OR fix the changeset bump level and re-run `pnpm changeset version` — but only if the changeset hasn't been consumed yet.
   - **Diagnosis B — `.changeset/config.json` lost its `fixed` group.** Rare, but possible if someone reset the file. Symptom: only ONE sub-package bumped. Fix: restore the `fixed` array (see `references/jsts-release.md`), reset all sub-package versions to match root manually, re-run.
   - **Diagnosis C — packages were already drifted before the run.** Symptom: bump amounts look right but starting points were different. Fix: align all sub-packages to root's pre-bump version, then re-run from Step 6.1.

   In all three cases, end with a fresh sanity check and only continue when all seven version fields match.

4. **iOS** (only if `ios/**` files changed): Apply the decision approved in Step 5 using [references/ios-release.md](references/ios-release.md). After the command, verify the resulting `MARKETING_VERSION` equals `IOS_MARKETING_VERSION` when that value is set. iOS is intentionally NOT in the Changesets fixed group — Changesets only sees npm packages.

### Step 7: Quality check

Run the checked-in What's New contracts from the repository root for every release:

```bash
pnpm build:shared
(cd backend-nest && bun test src/modules/whats-new/domain/releases-data.parity.spec.ts)
(cd landing && pnpm exec tsx --test data/releases.test.ts)
(cd frontend && pnpm test \
  --include 'projects/webapp/src/app/layout/whats-new/whats-new-releases.spec.ts' \
  --include 'projects/webapp/src/app/layout/whats-new/whats-new-toast.spec.ts')
```

Stop on any contract failure. These targeted tests are the local fail-fast gate; the complete CI on the preparation PR to `preview` remains the second barrier.

Validate the exact cross-platform outcome from the repository root for every release:

```bash
# No iOS change
bun .claude/skills/release/scripts/validate-whats-new-release.ts X.Y.Z none

# New marketing version with curated iOS notes
bun .claude/skills/release/scripts/validate-whats-new-release.ts X.Y.Z projection A.B.C

# New marketing version without a relevant dialog
bun .claude/skills/release/scripts/validate-whats-new-release.ts X.Y.Z silent A.B.C

# Build-only release, public changelog kept
bun .claude/skills/release/scripts/validate-whats-new-release.ts X.Y.Z build A.B.C

# Technical-only release, all public What's New surfaces skipped
bun .claude/skills/release/scripts/validate-whats-new-release.ts X.Y.Z skip
```

Use `none` when iOS did not change; otherwise use exactly one mode from the decision table in [references/ios-release.md](references/ios-release.md). The validator checks locale completeness, projection parity, scopes, item limits, and explicit silent modes across landing, webapp, and iOS. Stop on any validation error; do not convert it into a warning.

```bash
pnpm quality
```

Fix issues before proceeding.

### Step 8: Stage release files

Stage only release files. Under fixed mode, **all five sub-packages always change** even when only one was named in the changeset, so always stage all of them:

```bash
# Always: root + all five sub-package versions and changelogs (fixed mode bumped them all)
git add \
  package.json \
  frontend/package.json frontend/CHANGELOG.md \
  landing/package.json landing/CHANGELOG.md \
  backend-nest/package.json backend-nest/CHANGELOG.md \
  shared/package.json shared/CHANGELOG.md \
  android/package.json android/app.json android/CHANGELOG.md \
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

### Step 9: Commit and hand off to GitHub

Show the exact release commit, the branch `release/vX.Y.Z`, the approved French GitHub Release notes, and the two protected PR targets. Then ask: "Prêt à publier la branche de release et ouvrir la PR vers preview ?"

Only after "oui":

1. Recheck that the release branch still has the synchronized `preview` commit as its unchanged `HEAD`, then create exactly one release commit:

   ```bash
   set -euo pipefail
   VERSION=$(node -p 'require("./package.json").version')
   BRANCH="release/v${VERSION}"
   test "$(git branch --show-current)" = "$BRANCH"
   git fetch origin main preview --tags
   test "$(git rev-parse HEAD)" = "$(git rev-parse origin/preview)"
   node .github/scripts/check-release-lineage.mjs "$(git rev-parse origin/main)" "$(git rev-parse HEAD)"
   test -z "$(git tag -l "v${VERSION}")"
   test -z "$(git ls-remote --tags origin "refs/tags/v${VERSION}")"
   git commit -m "chore(release): v${VERSION}"
   RELEASE_SHA=$(git rev-parse --verify 'HEAD^{commit}')
   test "$(git rev-list --count origin/preview..HEAD)" -eq 1
   test "$(git rev-parse HEAD^)" = "$(git rev-parse origin/preview)"
   test "$(git show -s --format=%s "$RELEASE_SHA")" = "chore(release): v${VERSION}"
   ```

2. Push only the new release branch. Never push its commit directly to either protected branch:

   ```bash
   git push --set-upstream origin "$BRANCH"
   test "$(git ls-remote --heads origin "refs/heads/$BRANCH" | awk '{print $1}')" = "$RELEASE_SHA"
   ```

3. Resolve the remote state of this exact release intention before any dispatch. The identity is the run-name `🚦 prepare release/vX.Y.Z`; GitHub run lists — never agent memory — are the source of truth:

   ```bash
   STATE=$(node .github/scripts/resolve-release-state.mjs --workflow release-promotion.yml --version "$VERSION")
   echo "$STATE"
   test "$(jq -r .state <<< "$STATE")" = absent
   ```

   - `absent`: continue to the dispatch step. This is the only state that allows a new dispatch.
   - `active` or `succeeded`: report the returned run URL and any open release PR; do not dispatch again — the identical invocation is a no-op.
   - `failed`: after understanding the failure, rerun the exact run instead of dispatching a duplicate: validate with `--retry <run-id>` (the resolver accepts only the latest terminal run), then `gh run rerun <run-id> --repo neogenz/pulpe`.
   - `published`: the tag `vX.Y.Z` already exists; nothing to prepare.
   - Any resolver error (duplicate active runs, ambiguous refs or PRs, incomplete pagination, drift) stops the workflow without mutating anything.

4. Put the exact approved **GitHub Release** template from Step 5 in a temporary UTF-8 file using the available file-editing capability. Its first line must be `## vX.Y.Z`. Dispatch the trusted workflow with that file as JSON input:

   ```bash
   test "$(sed -n '1p' "$NOTES_FILE")" = "## v${VERSION}"
   jq -n \
     --arg release_branch "$BRANCH" \
     --rawfile release_notes "$NOTES_FILE" \
     '{release_branch: $release_branch, release_notes: $release_notes}' |
     gh workflow run release-promotion.yml \
       --repo neogenz/pulpe \
       --ref preview \
       --json
   ```

5. Watch the dispatched `🚦 Release Promotion` run and report the preparation PR URL. A failure leaves `preview`, `main`, tags, GitHub Releases, and providers untouched.

After the preparation PR is reviewed and merged with a merge commit:

- the preview providers deploy that merge commit without rebuilding the complete CI matrix;
- Railway's successful preview `deployment_status` triggers `✅ Staging Ready (shadow)`;
- `✅ Staging Ready (shadow)` proves the canonical PR tree, exact merged commit, unchanged release base, provider deployments and health checks; if `preview` advanced after the release branch was created, promotion stops and the release must be reprepared;
- the trusted promotion workflow fast-forwards the same release branch to that proven commit;
- the App opens the production PR to `main`;
- new feature PRs may then continue merging into `preview` without changing the frozen candidate;
- `✅ Release Gate` validates the production PR without secrets or executing candidate code, resolves the exact immutable workflow attempt and proves that current `main` is already fully published;
- a human other than the App approves production; this is the only human release approval;
- `🏭 Production Preflight` revalidates provenance, applies migrations when present and uploads the exact context; Railway waits for this workflow, then remains the sole backend deployer;
- Railway's successful production `deployment_status` triggers `✅ Production Finalized`, which verifies the exact active Railway/Vercel deployments and public services before idempotently creating the annotated tag and GitHub Release. The finalizer is never a Railway-required check.

This skill does not push `preview` or `main`, store a local release SHA, mutate Railway, create a tag, or publish a GitHub Release. Those production operations belong to the protected GitHub workflow after the approved production PR is merged.

## Maintenance: Re-align an already published GitHub Release

This is separate from the normal release workflow.

If `landing/data/releases.json` changes for an already tagged version:

1. Rebuild the GitHub notes from the approved landing copy.
2. Show the exact public diff against the current GitHub Release.
3. Explain that no automated parity test covers this surface.
4. Ask for explicit approval of that edit.
5. Only after approval, run `gh release edit "vX.Y.Z" --notes "…"`.
