---
name: update-changelog
description: Unified release command - analyzes git changes and bumps frontend, backend, shared AND iOS automatically. Use when user says "update changelog", "release", "bump versions", or "preparer une release".
argument-hint: [depuis le dernier tag | depuis main]
allowed-tools: Read, Glob, Grep, Bash(git *), Bash(pnpm changeset*), Bash(pnpm quality*), Bash(cd ios && *), Bash(gh release*), Write, AskUserQuestion
model: opus
---

# Update Changelog

Act as the **Product Owner** of this monorepo. Analyze code changes to produce clear, user-focused changelog entries in French.

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
BASE_REF=$(git tag -l | sort -V | tail -1)

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

| File Pattern | Package | Release Method |
|---|---|---|
| `frontend/**` | `pulpe-frontend` | JS/TS (changesets) |
| `backend-nest/**` | `backend-nest` | JS/TS (changesets) |
| `shared/**` | `pulpe-shared` | JS/TS (changesets) |
| `landing/**` | `pulpe-landing` | JS/TS (changesets) |
| `ios/**` | `ios` | Native (bump script) |

Extract relevant commits **per package** by cross-referencing commit file changes:

```bash
# For each package, get commits that touch its files
git log $BASE_REF..HEAD --oneline -- frontend/
git log $BASE_REF..HEAD --oneline -- backend-nest/
git log $BASE_REF..HEAD --oneline -- shared/
git log $BASE_REF..HEAD --oneline -- landing/
git log $BASE_REF..HEAD --oneline -- ios/
```

Only consider `feat:`, `fix:`, `feat!:`, `BREAKING CHANGE:`, `perf:` commits for version bumps. For version bump rules, see [references/semver-conventions.md](references/semver-conventions.md).

### Step 4: Propose changelog

**IMPORTANT: Display the changelog as regular output text FIRST, then ask for confirmation separately.**

1. **Output the proposal as text** (this will be visible to the user in the terminal):

```markdown
## Proposition de Changelog

### Packages detectes
- `frontend/**` -> pulpe-frontend
- `backend-nest/**` -> backend-nest

### Versions proposees
- **pulpe-frontend**: MINOR (feat: recurring transactions)
- **backend-nest**: PATCH (fix: token refresh)

### Changements utilisateur
1. **Transactions recurrentes** - Definir des depenses/revenus qui se repetent automatiquement
2. **Correction deconnexion** - Resolution du probleme de rafraichissement de token

*Les changements techniques internes ont ete exclus.*
```

2. **Then ask for approval** using AskUserQuestion with a short confirmation question:
   - Question: "Approuves-tu cette proposition de changelog ?"
   - Options: "Oui, appliquer" / "Non, ajuster"

Do NOT put the changelog content inside AskUserQuestion — it cannot render long text properly. The changelog must be output as regular text before the question.

Wait for explicit "oui" before proceeding.

### Step 5: Apply versions

Execute ONLY after user confirms.

- **JS/TS packages**: See [references/jsts-release.md](references/jsts-release.md)
- **iOS package**: See [references/ios-release.md](references/ios-release.md)

### Step 6: Verify quality BEFORE committing

```bash
pnpm quality
```

If quality checks fail, fix issues before proceeding. Do NOT commit or push broken code.

### Step 7: Commit & tag

Stage only the files modified by the release process (changelogs, package.json, project.yml, etc.) — do NOT use `git add -A`:

```bash
# Stage specific release files
git add CHANGELOG.md */CHANGELOG.md */package.json .changeset/ ios/project.yml
git commit -m "chore(release): bump versions

- pulpe-frontend: X.Y.Z
- backend-nest: X.Y.Z
- pulpe-shared: X.Y.Z
- ios: X.Y.Z (build N)"
```

Create tags **only for packages actually bumped** — see platform-specific references for tag format.

### Step 8: Push & GitHub releases (with confirmation)

Ask the user for confirmation before pushing:

> Pret a pousser sur main avec les tags et creer les releases GitHub ? (oui/non)

Only after explicit "oui":

```bash
git push origin main --tags
```

### Step 9: Create GitHub releases

For each bumped package, create a GitHub release using `gh`:

```bash
gh release create "pulpe-frontend@X.Y.Z" --title "pulpe-frontend vX.Y.Z" --notes "changelog content in French"
```

- Use the same user-facing changelog content from Step 4 as the release notes
- Create one release per bumped package using the tag created in Step 7
- The tag format must match the convention in [references/semver-conventions.md](references/semver-conventions.md)

## Adding a new platform

To add support for a new platform:
1. Create `references/<platform>-release.md` with apply + tag instructions
2. Add file pattern mapping in Step 3 table
3. Add tag format in [references/semver-conventions.md](references/semver-conventions.md)
