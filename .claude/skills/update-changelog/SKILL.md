---
name: update-changelog
description: Unified release command - analyzes git changes and bumps all packages with a single product version. Use when user says "update changelog", "release", "bump versions", or "preparer une release".
argument-hint: [depuis le dernier tag | depuis main] [--skip-whats-new]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(git *), Bash(pnpm changeset*), Bash(pnpm quality*), Bash(cd ios && *), Bash(xcodegen *), Bash(gh release*), AskUserQuestion
model: opus
---

# Update Changelog

Analyze code changes to produce a unified product release with clear, user-focused changelog entries in French.

**Release model:** One SemVer version, one git tag (`vX.Y.Z`), one GitHub Release. Every npm sub-package in the workspace mirrors the root version via Changesets `fixed` mode — there is no per-package version drift.

**Source of truth:** the root `package.json` (`pulpe-workspace`). All decisions start from `version` in that file.

**Critical rules:**
- NEVER apply versions without explicit user approval
- NEVER push without explicit user approval
- If changes are ambiguous, ASK — do not guess
- When uncertain about bump severity, prefer the HIGHER bump
- After bumping, ALL of: root, frontend, landing, backend-nest, shared MUST show the same version. If they don't, stop.

## Input

User argument: `$ARGUMENTS`

| Format | Meaning |
|--------|---------|
| `depuis le dernier tag` | Analyze since last git tag |
| `depuis main` | Analyze since divergence from main |
| _(empty)_ | Default to "depuis le dernier tag" |
| `--skip-whats-new` | Skip the "What's New" toast update (Step 5c). Can be combined with other arguments. |

**Flag detection:** Set `SKIP_WHATS_NEW=true` (and strip the flag/keyword from the base reference argument) when ANY of these conditions are met:

1. `$ARGUMENTS` contains `--skip-whats-new`
2. The user said "sans what's new", "skip what's new", "pas de what's new"
3. **The user described the release as technical-only** — phrases like "release technique", "patch interne", "technical-only", "release technique uniquement", "rien de visible utilisateur". Trust the user's framing here even if a single commit looks vaguely user-impacting (cache recovery, telemetry, error handling). The cost of a false-positive toast — user sees "Nouveautés" with nothing meaningful — is much higher than missing a small mention. When the user signals technical-only, just skip.

## Workflow

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

| File Pattern | Package |
|---|---|
| `frontend/**` | Frontend |
| `backend-nest/**` | Backend |
| `shared/**` | Shared |
| `landing/**` | Landing |
| `ios/**` | iOS |

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

### Step 5: Propose changelog

**Display the changelog as regular text FIRST, then ask for confirmation.**

Use this exact template for the **proposal** (shown in terminal):

```markdown
## Proposition de release

### Version proposée
**vX.Y.Z** (MINOR)

### Packages impactés
- Frontend, Backend, iOS

### Notes de release

#### Nouveautés
- **Titre court** — Description en une phrase

#### Corrections
- **Titre court** — Description en une phrase

#### Technique
- Description si pertinent

*Les changements techniques internes ont été exclus.*
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

*[Roadmap](https://github.com/neogenz/pulpe/milestones) — [Issues](https://github.com/neogenz/pulpe/issues)*
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

Then ask with AskUserQuestion: "Approuves-tu cette proposition ?" → "Oui, appliquer" / "Non, ajuster"

### Step 5b: Update landing changelog data

**Skip if `SKIP_WHATS_NEW=true`.** When the user signaled a technical-only release (or passed `--skip-whats-new`), the public landing changelog page on pulpe.app/changelog must ALSO stay quiet — the same logic that hides the in-app toast must hide the public-facing entry. Otherwise you'd publish "fix télémétrie" or similar internal infrastructure work to all visitors of the marketing site, which is exactly the v0.33.1-class mistake one layer further out. The git tag and GitHub Release (Step 9) still record the version for internal traceability.

Otherwise, update `landing/data/releases.json` with the new release.

**Procedure:**

1. Read `landing/data/releases.json` (use Read tool)
2. Build a new release object from the approved Step 5 data:

```json
{
  "version": "X.Y.Z",
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
4. Write back the full JSON with `JSON.stringify(releases, null, 2)` (use Write tool)

**Field rules:**

| Field | Value |
|-------|-------|
| `version` | Version from Step 4 (without `v` prefix) |
| `date` | Today's date in `YYYY-MM-DD` format |
| `githubUrl` | `https://github.com/neogenz/pulpe/releases/tag/vX.Y.Z` |
| `platforms` | Derived from affected packages (see mapping below) |
| `changes.features` | From approved "Nouveautés" entries |
| `changes.fixes` | From approved "Corrections" entries |
| `changes.technical` | From approved "Technique" entries |

Each entry: `{ "title": "Bold title from Step 5", "description": "Description from Step 5" }`

**Platform mapping** — derived from packages that contributed at least one **bump-triggering commit** in Step 3 (i.e. `feat:`, `fix:`, `feat!:`, `BREAKING CHANGE:`, `perf:`). Files touched only by `chore:`/`refactor:`/`test:`/`docs:`/`ci:`/`build:`/`style:` commits do NOT count, even though they live under one of the package paths.

- `frontend/**`, `backend-nest/**`, `shared/**`, `landing/**` (with bumping commits) → `"web"`
- `ios/**` (with bumping commits) → `"ios"`
- `android/**` (with bumping commits) → `"android"` (future)

Deduplicate: if both frontend and backend contributed bumping commits, `"web"` appears once.
Empty sections stay as `[]` (never omit the key).

### Step 5c: Update webapp "What's New" toast

**Skip if `SKIP_WHATS_NEW=true`** (set in the Input section above by `--skip-whats-new`, an equivalent phrase, OR a technical-only signal): do NOT touch the file. The toast won't appear because `LATEST_RELEASE.version` stays at its previous value and won't match `buildInfo.version`.

**Auto-skip silently** if NO affected package is webapp-relevant (only `ios/` and/or `landing/` touched — no `frontend/`, `backend-nest/`, or `shared/`). Nothing to display, no need to ask.

**Otherwise, if webapp packages changed but after filtering there are ZERO displayable items**, ask: "Aucune nouveauté pertinente pour la webapp. Souhaites-tu mettre à jour le toast quand même ?" → "Oui" / "Non, sauter".

Update `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts` so the in-app toast displays the new release features.

**Procedure:**

1. Read the file (use Read tool)
2. Filter the approved "Nouveautés" and "Corrections" entries to keep ONLY webapp-relevant items (see rules below)
3. Replace `LATEST_RELEASE` with the filtered entries
4. Write back using Edit tool

**Template:**

```typescript
export const LATEST_RELEASE: WhatsNewRelease = {
  version: 'X.Y.Z',
  features: [
    'Titre court de la nouveauté 1',
    'Titre court de la nouveauté 2',
  ],
};
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
- Keep the `WhatsNewRelease` interface import unchanged

### Step 6: Apply versions

Execute ONLY after user confirms.

1. **Bump root product version** in root `package.json` — use the Edit tool to replace the `"version"` field with the target version computed in Step 4.

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

4. **iOS** (only if `ios/**` files changed): See [references/ios-release.md](references/ios-release.md). iOS is intentionally NOT in the Changesets fixed group — Changesets only sees npm packages.

### Step 7: Quality check

```bash
pnpm quality
```

Fix issues before proceeding.

### Step 8: Commit and tag

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

# Only if Step 5c was NOT skipped (same condition as 5b right now, but kept separate
# in case the two ever need different gates):
git add frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts

# Only if iOS files changed in this release:
git add ios/project.yml

git commit -m "chore(release): vX.Y.Z"
git tag "vX.Y.Z" -m "Release vX.Y.Z"
```

Before committing, run `git status` and confirm only the expected files are staged. If anything unrelated landed in the staging area (an unrelated edit you forgot, an untracked file `git add .changeset/` accidentally picked up), unstage it before continuing — release commits should be 100% mechanical.

**Notes:**
- `ios/Pulpe.xcodeproj/` is gitignored (regenerated by xcodegen). Do NOT try to stage it.
- Per-package `CHANGELOG.md` files all get new entries even for packages whose code didn't change — that's expected under fixed mode (see `references/jsts-release.md`).

### Step 9: Push and GitHub release

Ask: "Prêt à pousser sur main avec le tag et créer la release GitHub ?"

Only after "oui":

```bash
git push origin main
git push origin "vX.Y.Z"
```

> Push the branch and the new tag explicitly. Do NOT use `git push --tags` — that pushes every local tag, including any throwaway/test tag that might be sitting around, which is a silent footgun.

Then create the GitHub release using the **GitHub Release template** from Step 5:

```bash
gh release create "vX.Y.Z" --repo neogenz/pulpe --title "vX.Y.Z" --notes "$(cat <<'EOF'
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

Rules:
- Release title is always `vX.Y.Z` — nothing else
- Omit empty sections (no corrections? skip the section)
- Footer links always present
