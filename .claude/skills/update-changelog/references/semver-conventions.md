# SemVer Conventions

Pulpe uses a **single unified product version** following **Semantic Versioning**: `MAJOR.MINOR.PATCH`

Pulpe is a **product**, not a library. There are no external consumers of `pulpe-frontend`, `pulpe-shared`, etc. — every npm package in the workspace exists only to be assembled into the same shipped app. The version users see (About dialog, GitHub release, landing) must be one number, full stop.

## Tag Format

One tag per release:

```
vX.Y.Z    (e.g. v1.7.0)
```

The **root `package.json`** (`pulpe-workspace`) is the single source of truth for the product version. All sub-packages mirror it — see "Single-Version Lockstep" below.

No other tags are created — no per-package tags, no date-based tags.

## Single-Version Lockstep

All four npm sub-packages always carry the **same version as the root**:

| Package | Version source |
|---|---|
| `pulpe-workspace` (root) | Source of truth — bumped manually by the skill |
| `pulpe-frontend` | Mirrors root via Changesets `fixed` mode |
| `pulpe-landing` | Mirrors root via Changesets `fixed` mode |
| `backend-nest` | Mirrors root via Changesets `fixed` mode |
| `pulpe-shared` | Mirrors root via Changesets `fixed` mode |

The lockstep is enforced by `.changeset/config.json`:

```json
"fixed": [
  ["pulpe-frontend", "pulpe-landing", "backend-nest", "pulpe-shared"]
]
```

This is **Lerna fixed-mode equivalent**: when any package in the group is bumped, all of them bump to the same version, regardless of whether their own files actually changed. That is the intended behavior — the version is a product label, not a per-package contract.

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

## Per-package CHANGELOG.md

Changesets still writes one `CHANGELOG.md` per sub-package — that is a tooling artifact, not the user-facing changelog. The canonical user-facing release notes live in:

1. **GitHub Release** — `vX.Y.Z` notes (Step 9 of the skill)
2. **`landing/data/releases.json`** — public changelog page on pulpe.app
3. **`whats-new-releases.ts`** — in-app toast for webapp users

Per-package `CHANGELOG.md` files may show entries for packages whose code didn't change. That is expected under fixed mode and is harmless — nobody reads them.

## iOS Alignment

iOS `MARKETING_VERSION` aligns with the product version **only when iOS code changes**. iOS is not part of the Changesets fixed group (Changesets only sees npm packages). See `references/ios-release.md` for details.
