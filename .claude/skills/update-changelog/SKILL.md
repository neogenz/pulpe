---
name: update-changelog
description: Unified release command - analyzes git changes and bumps all packages with a single product version. Use when user says "update changelog", "release", "bump versions", or "preparer une release".
argument-hint: [depuis le dernier tag | depuis main]
allowed-tools: Read, Glob, Grep, Bash(git *), Bash(pnpm changeset*), Bash(pnpm quality*), Bash(cd ios && *), Bash(gh release*), Bash(node -e*), Write, AskUserQuestion
model: opus
---

# Update Changelog

Act as the **Product Owner** of this monorepo. Analyze code changes to produce clear, user-focused changelog entries in French.

**Release model:** Unified product release — one SemVer version, one git tag (`vX.Y.Z`), one GitHub Release with all notes grouped.

**Critical rules:**
- NEVER apply versions without explicit user approval
- NEVER push without explicit user approval
- If changes are ambiguous, ASK for clarification — do not guess
- When uncertain about bump severity, prefer the HIGHER bump (conservative)

## Input

User argument: `$ARGUMENTS`

| Format | Meaning |
|--------|---------|
| `depuis le dernier tag` | Analyze since last git tag |
| `depuis main` | Analyze since divergence from main |
| _(empty)_ | Default to "depuis le dernier tag" |

## Workflow

### Step 1: Determine base reference

```bash
# If "depuis le dernier tag" or empty:
BASE_REF=$(git tag -l "v*" | sort -V | tail -1)

# If "depuis main":
BASE_REF="main"
```

Use `$BASE_REF` as the reference for ALL subsequent git commands.

### Step 2: Analyze git changes

Run in parallel using `$BASE_REF`:

```bash
git diff $BASE_REF..HEAD --name-only     # Modified files
git log $BASE_REF..HEAD --oneline        # Commit messages
git diff $BASE_REF..HEAD --stat          # Change summary
```

**Stop immediately** if changes contain ONLY non-functional commits (`refactor:`, `test:`, `chore:`, `ci:`, `docs:`, `style:`, `build:`), dev dependency updates, CI/CD changes, or documentation. Output: "Aucun changeset necessaire — modifications techniques uniquement."

### Step 3: Detect affected packages and their commits

Map files to packages:

| File Pattern | Package |
|---|---|
| `frontend/**` | Frontend |
| `backend-nest/**` | Backend |
| `shared/**` | Shared |
| `landing/**` | Landing |
| `ios/**` | iOS |

Extract relevant commits **per package** by cross-referencing commit file changes:

```bash
git log $BASE_REF..HEAD --oneline -- frontend/
git log $BASE_REF..HEAD --oneline -- backend-nest/
git log $BASE_REF..HEAD --oneline -- shared/
git log $BASE_REF..HEAD --oneline -- landing/
git log $BASE_REF..HEAD --oneline -- ios/
```

Only consider `feat:`, `fix:`, `feat!:`, `BREAKING CHANGE:`, `perf:` commits for version bumps. For version bump rules, see [references/semver-conventions.md](references/semver-conventions.md).

### Step 4: Determine product version bump

Read the current product version from `package.json` at the root (`version` field).

The product version bump is the **highest bump** across all affected packages:
- If ANY package has a `feat!:` or `BREAKING CHANGE:` → **MAJOR**
- Else if ANY package has a `feat:` → **MINOR**
- Else if ANY package has a `fix:` or `perf:` → **PATCH**

### Step 5: Propose changelog

**IMPORTANT: Display the changelog as regular output text FIRST, then ask for confirmation separately.**

1. **Output the proposal as text** (this will be visible to the user in the terminal):

```markdown
## Proposition de Changelog

### Version proposee
**vX.Y.Z** (MINOR)

### Packages impactes
- Frontend, Backend

### Changements utilisateur

**Frontend**
1. **Transactions recurrentes** - Definir des depenses/revenus qui se repetent automatiquement

**Backend**
2. **Correction deconnexion** - Resolution du probleme de rafraichissement de token

*Les changements techniques internes ont ete exclus.*
```

2. **Then ask for approval** using AskUserQuestion with a short confirmation question:
   - Question: "Approuves-tu cette proposition de changelog ?"
   - Options: "Oui, appliquer" / "Non, ajuster"

Do NOT put the changelog content inside AskUserQuestion — it cannot render long text properly. The changelog must be output as regular text before the question.

Wait for explicit "oui" before proceeding.

### Step 6: Apply versions

Execute ONLY after user confirms.

1. **Bump root product version** in `package.json` at the root:

```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
// Apply bump: 'major' | 'minor' | 'patch'
pkg.version = 'X.Y.Z';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

2. **JS/TS sub-packages** (if affected): See [references/jsts-release.md](references/jsts-release.md)
3. **iOS** (if affected): See [references/ios-release.md](references/ios-release.md)

### Step 7: Verify quality BEFORE committing

```bash
pnpm quality
```

If quality checks fail, fix issues before proceeding. Do NOT commit or push broken code.

### Step 8: Commit & tag

Stage only the files modified by the release process — do NOT use `git add -A`:

```bash
git add package.json CHANGELOG.md */CHANGELOG.md */package.json .changeset/ ios/project.yml
git commit -m "chore(release): vX.Y.Z"
git tag "vX.Y.Z" -m "Release vX.Y.Z"
```

### Step 9: Push & GitHub release (with confirmation)

Ask the user for confirmation before pushing:

> Pret a pousser sur main avec le tag et creer la release GitHub ? (oui/non)

Only after explicit "oui":

```bash
git push origin main --tags
```

Then create a **single** GitHub release:

```bash
gh release create "vX.Y.Z" --title "vX.Y.Z" --notes "unified changelog content in French"
```

The release notes should group changes by package, using the same format as Step 5.

## Adding a new platform

To add support for a new platform:
1. Create `references/<platform>-release.md` with apply + tag instructions
2. Add file pattern mapping in Step 3 table
