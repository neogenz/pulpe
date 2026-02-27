---
name: update-changelog
description: Unified release command - analyzes git changes and bumps all packages with a single product version. Use when user says "update changelog", "release", "bump versions", or "preparer une release".
argument-hint: [depuis le dernier tag | depuis main] [--skip-whats-new]
allowed-tools: Read, Glob, Grep, Bash(git *), Bash(pnpm changeset*), Bash(pnpm quality*), Bash(cd ios && *), Bash(gh release*), Bash(node -e*), Write, AskUserQuestion
model: opus
---

# Update Changelog

Analyze code changes to produce a unified product release with clear, user-focused changelog entries in French.

**Release model:** One SemVer version, one git tag (`vX.Y.Z`), one GitHub Release.

**Critical rules:**
- NEVER apply versions without explicit user approval
- NEVER push without explicit user approval
- If changes are ambiguous, ASK — do not guess
- When uncertain about bump severity, prefer the HIGHER bump

## Input

User argument: `$ARGUMENTS`

| Format | Meaning |
|--------|---------|
| `depuis le dernier tag` | Analyze since last git tag |
| `depuis main` | Analyze since divergence from main |
| _(empty)_ | Default to "depuis le dernier tag" |
| `--skip-whats-new` | Skip the "What's New" toast update (Step 5c). Can be combined with other arguments. |

**Flag detection:** If `$ARGUMENTS` contains `--skip-whats-new` (or user says "sans what's new", "skip what's new", "pas de what's new"), set `SKIP_WHATS_NEW=true` and strip the flag from the base reference argument.

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

**Stop immediately** if changes contain ONLY non-functional commits (`refactor:`, `test:`, `chore:`, `ci:`, `docs:`, `style:`, `build:`). Output: "Aucun changeset necessaire — modifications techniques uniquement."

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

Read current version from root `package.json` (`version` field).

The product version bump is the **highest** across all affected packages:
- ANY `feat!:` or `BREAKING CHANGE:` → **MAJOR**
- ANY `feat:` → **MINOR**
- ANY `fix:` or `perf:` → **PATCH**

### Step 5: Propose changelog

**Display the changelog as regular text FIRST, then ask for confirmation.**

Use this exact template for the **proposal** (shown in terminal):

```markdown
## Proposition de release

### Version proposee
**vX.Y.Z** (MINOR)

### Packages impactes
- Frontend, Backend, iOS

### Notes de release

#### Nouveautes
- **Titre court** — Description en une phrase

#### Corrections
- **Titre court** — Description en une phrase

#### Technique
- Description si pertinent

*Les changements techniques internes ont ete exclus.*
```

Use this exact template for the **GitHub Release** (created in Step 9):

```markdown
## vX.Y.Z

### Nouveautes
- **Titre court** — Description en une phrase

### Corrections
- **Titre court** — Description en une phrase

### Technique
- Description si pertinent

---

*[Roadmap](https://github.com/neogenz/pulpe/milestones) — [Issues](https://github.com/neogenz/pulpe/issues)*
```

Rules for writing notes:
- French, no emojis, no package names
- Grouped by type (Nouveautes / Corrections / Technique), NOT by package
- User-focused: describe what changed for the user, not technical details
- Each entry: **bold short title** + em dash + one sentence description
- Omit empty sections (if no corrections, skip "Corrections")
- Footer with links to roadmap and issues
- Release title is always `vX.Y.Z` — nothing else added

Then ask with AskUserQuestion: "Approuves-tu cette proposition ?" → "Oui, appliquer" / "Non, ajuster"

### Step 5b: Update landing changelog data

After user approves, update `landing/data/releases.json` with the new release.

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
| `changes.features` | From approved "Nouveautes" entries |
| `changes.fixes` | From approved "Corrections" entries |
| `changes.technical` | From approved "Technique" entries |

Each entry: `{ "title": "Bold title from Step 5", "description": "Description from Step 5" }`

**Platform mapping** (from Step 3 affected packages):
- `frontend/**`, `backend-nest/**`, `shared/**`, `landing/**` → `"web"`
- `ios/**` → `"ios"`
- `android/**` → `"android"` (future)

Deduplicate: if both frontend and backend changed, `"web"` appears once.
Empty sections stay as `[]` (never omit the key).

### Step 5c: Update webapp "What's New" toast

**Skip condition:** If `SKIP_WHATS_NEW=true` (user passed `--skip-whats-new` or equivalent), skip this entire step. Do NOT update the file — the toast will not appear for this release because the version won't match.

**Auto-skip condition:** If, after filtering for webapp-relevant entries (see rules below), there are ZERO items to display, ask the user: "Aucune nouveaute pertinente pour la webapp. Souhaites-tu mettre a jour le toast What's New quand meme ?" → "Oui" / "Non, sauter". If "Non", skip this step.

Update `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts` so the in-app toast displays the new release features.

**Procedure:**

1. Read the file (use Read tool)
2. Filter the approved "Nouveautes" and "Corrections" entries to keep ONLY webapp-relevant items (see rules below)
3. Replace `LATEST_RELEASE` with the filtered entries
4. Write back using Edit tool

**Template:**

```typescript
export const LATEST_RELEASE: WhatsNewRelease = {
  version: 'X.Y.Z',
  features: [
    'Titre court de la nouveaute 1',
    'Titre court de la nouveaute 2',
  ],
};
```

**Scope rules — webapp users only:**
- **Include**: Changes visible to Angular webapp users — UI changes, new pages, UX improvements, behavior changes triggered by backend modifications that affect the webapp experience
- **Exclude**: iOS-only features, landing page changes, purely technical/infra changes, backend-only changes invisible to users
- If only "Corrections" are relevant (no "Nouveautes" for the webapp), use the most impactful fix titles instead

**Writing rules — pas d'anglicismes:**
- Ecrire en francais courant, sans anglicismes (ex: "libelles" au lieu de "wording", "modele" au lieu de "template", "mise en cache" au lieu de "cache")
- `version`: Same as Step 4 (without `v` prefix) — must match the bumped `package.json` version so `buildInfo.version === LATEST_RELEASE.version`
- `features`: Short titles only, no descriptions — max ~50 chars per line
- Max 3-4 features to keep the toast concise
- Keep the `WhatsNewRelease` interface import unchanged

### Step 6: Apply versions

Execute ONLY after user confirms.

1. **Bump root product version** in root `package.json`:

```bash
bun -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = 'X.Y.Z';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

2. **JS/TS sub-packages** (if affected): See [references/jsts-release.md](references/jsts-release.md)

3. **iOS** (if affected): See [references/ios-release.md](references/ios-release.md)

### Step 7: Quality check

```bash
pnpm quality
```

Fix issues before proceeding.

### Step 8: Commit and tag

Stage only release files:

```bash
git add package.json CHANGELOG.md */CHANGELOG.md */package.json .changeset/ ios/project.yml ios/Pulpe.xcodeproj/project.pbxproj landing/data/releases.json
# Only if Step 5c was NOT skipped:
git add frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts
git commit -m "chore(release): vX.Y.Z"
git tag "vX.Y.Z" -m "Release vX.Y.Z"
```

### Step 9: Push and GitHub release

Ask: "Pret a pousser sur main avec le tag et creer la release GitHub ?"

Only after "oui":

```bash
git push origin main --tags
```

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
