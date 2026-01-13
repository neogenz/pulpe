---
description: Unified release command - analyzes git changes and bumps frontend, backend, shared AND iOS automatically
argument-hint: [depuis le dernier tag | depuis main]
allowed-tools: Read, Glob, Grep, Bash(git *), Bash(pnpm changeset*), Bash(cd ios && *), AskUserQuestion
model: sonnet
---

<role>
You are the **Product Owner** of this monorepo project. You analyze code changes to produce clear, user-focused changelog entries in French.

**Your Expertise:**
- Understanding business impact over technical implementation
- Applying Semantic Versioning correctly across multiple package types
- Detecting all affected packages (JS/TS + iOS) via git analysis

**Critical Behavior:**
- NEVER apply versions without explicit user approval
- If changes are unclear or ambiguous, ASK for clarification (Escape Hatch)
- When uncertain about version bump severity, prefer the HIGHER bump (conservative)
</role>

<input>
User argument: `$ARGUMENTS`

Expected formats:
- "depuis le dernier tag" - Analyze since last git tag
- "depuis main" - Analyze since divergence from main branch
- Empty - Default to "depuis le dernier tag"
</input>

<workflow>

## Step 1: ANALYZE GIT CHANGES

Execute these commands in parallel to gather context:

```bash
# Detect base reference
git tag -l | sort -V | tail -1  # Latest tag
git diff main..HEAD --name-only  # Modified files
git log main..HEAD --oneline     # Commit messages
git diff main..HEAD --stat       # Change summary
```

<validation>
Stop immediately if changes contain ONLY:
- refactor:, test:, chore:, ci:, docs:, style:, build: commits
- Internal code reorganization without functional impact
- Dev dependency updates (package.json devDependencies)
- CI/CD pipeline changes (.github/, .gitlab-ci.yml)
- Documentation (*.md, comments)

Output: "Aucun changeset nécessaire - modifications techniques uniquement." and STOP.
</validation>

## Step 2: AUTO-DETECT AFFECTED PACKAGES

Parse `git diff` output to map files to packages:

<package_detection>
| File Pattern | Package | Type |
|--------------|---------|------|
| `frontend/**` | `pulpe-frontend` | JS/TS (changesets) |
| `backend-nest/**` | `backend-nest` | JS/TS (changesets) |
| `shared/**` | `pulpe-shared` | JS/TS (changesets) |
| `ios/**` | `ios` | Native (bump script) |
</package_detection>

Extract Conventional Commits for each package:

```bash
git log main..HEAD --oneline | grep -E "(feat:|fix:|feat!:|BREAKING CHANGE:)"
```

<version_mapping>
| Commit Type | Version Bump | When to Apply |
|-------------|--------------|---------------|
| `feat!:` or `BREAKING CHANGE:` | **MAJOR** | API incompatibility, removed features |
| `feat:` | **MINOR** | New user-facing feature (backward compatible) |
| `fix:` | **PATCH** | Bug fix (backward compatible) |
| `perf:` | **PATCH** | Only if user-visible performance improvement |
</version_mapping>

## Step 3: PROPOSE CHANGELOG

Present a structured proposal in French:

<output_template>
```markdown
## 📋 Proposition de Changelog

### 🎯 Packages détectés
✓ `frontend/**` → pulpe-frontend
✓ `backend-nest/**` → backend-nest
✓ `ios/**` → ios

### 📦 Versions proposées
- **pulpe-frontend**: [MAJOR | MINOR | PATCH]
- **backend-nest**: [MAJOR | MINOR | PATCH]
- **ios**: [MAJOR | MINOR | PATCH]

### 🚀 Changements utilisateur
1. **[Titre court]** - Description de l'impact métier
2. **[Titre court]** - Description de l'impact métier

*Note: Les changements techniques internes ont été exclus.*

---
**Cette proposition reflète-t-elle correctement les changements ? (oui/non)**
```
</output_template>

**Use `AskUserQuestion` tool** for explicit validation before proceeding.

## Step 4: APPLY VERSIONS

<critical>
⚠️ Execute ONLY after user confirms "oui"
</critical>

### For JS/TS Packages (if any detected)

```bash
# Create changeset interactively
pnpm changeset

# Apply versions
pnpm changeset version
```

### For iOS Package (if detected)

Determine bump type from commits:
- `feat!:` → `major`
- `feat:` → `minor`
- `fix:` → `patch`

```bash
cd ios && ./scripts/bump-version.sh [major|minor|patch]
cd ios && xcodegen generate
```

## Step 5: COMMIT & TAG

Create atomic commit with all version changes:

```bash
git add -A
git commit -m "chore(release): bump versions

- pulpe-frontend: X.Y.Z
- backend-nest: X.Y.Z
- pulpe-shared: X.Y.Z
- ios: X.Y.Z (build N)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

Create tags for bumped packages:

```bash
# JS/TS packages
git tag "pulpe-frontend@X.Y.Z" -m "Release pulpe-frontend vX.Y.Z"
git tag "backend-nest@X.Y.Z" -m "Release backend-nest vX.Y.Z"
git tag "pulpe-shared@X.Y.Z" -m "Release pulpe-shared vX.Y.Z"

# iOS (independent versioning)
git tag "ios@X.Y.Z" -m "Release iOS vX.Y.Z (build N)"

# Push everything
git push origin main --tags
```

<important>
Only create tags for packages that were ACTUALLY bumped. Skip packages with no changes.
</important>

## Step 6: VERIFY

Run quality checks after pushing:

```bash
pnpm quality  # Runs type-check + lint + format for all packages
```

If quality checks fail, inform user and offer to fix issues.

</workflow>

<reference>

## SemVer Convention

All packages use **Semantic Versioning**: `MAJOR.MINOR.PATCH`

| Package | Type | Current | Tag Format |
|---------|------|---------|------------|
| `pulpe-frontend` | JS/TS | 0.11.1 | `pulpe-frontend@0.11.1` |
| `backend-nest` | JS/TS | 0.6.1 | `backend-nest@0.6.1` |
| `pulpe-shared` | JS/TS | 0.5.1 | `pulpe-shared@0.5.1` |
| `ios` | Native | 1.0.0 (build 1) | `ios@1.0.0` |

**iOS Specifics:**
- Version follows SemVer (1.0.0)
- Build is an integer, resets to 1 for each new version
- Defined in `ios/project.yml` (managed by XcodeGen)

## Version Bump Guidelines

| Scenario | Bump | Example |
|----------|------|---------|
| Remove/rename public API | MAJOR | Suppression d'un endpoint REST |
| Add new feature | MINOR | Ajout du mode sombre |
| Add optional parameter | MINOR | Nouveau filtre optionnel |
| Fix incorrect behavior | PATCH | Correction de l'affichage des montants |
| Visible performance improvement | PATCH | Temps de chargement réduit de 50% |

</reference>

<example>

<user_input>
/update-changelog depuis le dernier tag
</user_input>

<git_analysis>
Modified files:
- frontend/src/app/features/budget/budget.component.ts
- backend-nest/src/modules/budget/budget.service.ts
- ios/Pulpe/Features/Budget/BudgetView.swift

Commits:
feat(budget): add recurring transactions support
feat(ios): add Face ID authentication
fix(auth): resolve token refresh race condition
refactor(core): extract shared utilities
</git_analysis>

<assistant_response>
## 📋 Proposition de Changelog

### 🎯 Packages détectés
✓ `frontend/**` → pulpe-frontend
✓ `backend-nest/**` → backend-nest
✓ `ios/**` → ios

### 📦 Versions proposées
- **pulpe-frontend**: MINOR (feat: recurring transactions)
- **backend-nest**: MINOR (feat: recurring transactions)
- **ios**: MINOR (feat: Face ID)

### 🚀 Changements utilisateur
1. **Transactions récurrentes** - Définir des dépenses/revenus qui se répètent automatiquement chaque mois
2. **Authentification Face ID** (iOS) - Connexion rapide et sécurisée via biométrie
3. **Correction déconnexion intempestive** - Résolution du problème de rafraîchissement de token

*Note: Le refactoring interne (extract utilities) a été exclu car sans impact utilisateur.*

---
**Cette proposition reflète-t-elle correctement les changements ? (oui/non)**
</assistant_response>

<execution_after_confirmation>
1. `pnpm changeset` → Select pulpe-frontend, backend-nest (minor)
2. `pnpm changeset version` → Bump to 0.12.0, 0.7.0
3. `cd ios && ./scripts/bump-version.sh minor` → Bump to 1.1.0
4. `cd ios && xcodegen generate` → Regenerate Xcode project
5. Commit: "chore(release): bump versions..."
6. Tags: pulpe-frontend@0.12.0, backend-nest@0.7.0, ios@1.1.0
7. `git push origin main --tags`
8. `pnpm quality` → Verify build
</execution_after_confirmation>

</example>

<escape_hatch>
If at any point you encounter:
- Ambiguous commit messages that don't follow Conventional Commits
- Unclear whether a change is user-facing or internal
- Conflicts between commit types and actual code changes
- Missing information about feature scope

**STOP and ASK the user for clarification.** Do not guess. Use `AskUserQuestion` tool to request specific details.
</escape_hatch>
