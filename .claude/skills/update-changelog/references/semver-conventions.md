# SemVer Conventions

Pulpe uses a **single unified product version** following **Semantic Versioning**: `MAJOR.MINOR.PATCH`

## Tag Format

One tag per release:

```
vX.Y.Z    (e.g. v1.7.0)
```

The version is tracked in the root `package.json` (`version` field).

No other tags are created — no per-package tags, no date-based tags.

## Version Bump Mapping

| Commit Type | Bump | When |
|---|---|---|
| `feat!:` or `BREAKING CHANGE:` | **MAJOR** | API incompatibility, removed features |
| `feat:` | **MINOR** | New user-facing feature (backward compatible) |
| `fix:` | **PATCH** | Bug fix (backward compatible) |
| `perf:` | **PATCH** | Only if user-visible performance improvement |

The product version bump is the **highest bump** across all affected packages.

Commits that do NOT trigger a release: `chore:`, `refactor:`, `test:`, `ci:`, `docs:`, `style:`, `build:`.

## Bump Guidelines

| Scenario | Bump | Example |
|---|---|---|
| Remove/rename public API | MAJOR | Suppression d'un endpoint REST |
| Add new feature | MINOR | Ajout du mode sombre |
| Add optional parameter | MINOR | Nouveau filtre optionnel |
| Fix incorrect behavior | PATCH | Correction de l'affichage des montants |
| Visible perf improvement | PATCH | Temps de chargement reduit de 50% |

## Sub-package Versions

Each JS/TS sub-package has its own version in `package.json`, managed by changesets. These versions:
- Are bumped only when the package is affected
- Do NOT generate git tags
- Track changes in per-package `CHANGELOG.md` files

## iOS Alignment

iOS `MARKETING_VERSION` aligns with the product version **only when iOS code changes**. See `references/ios-release.md` for details.
