# SemVer Conventions

The product uses a **single unified version** following **Semantic Versioning**: `MAJOR.MINOR.PATCH`

## Tag Format

A single tag per release:

```
vX.Y.Z    (e.g. v0.18.0)
```

The version is tracked in the root `package.json` (`version` field).

## Version Bump Mapping

| Commit Type | Bump | When |
|---|---|---|
| `feat!:` or `BREAKING CHANGE:` | **MAJOR** | API incompatibility, removed features |
| `feat:` | **MINOR** | New user-facing feature (backward compatible) |
| `fix:` | **PATCH** | Bug fix (backward compatible) |
| `perf:` | **PATCH** | Only if user-visible performance improvement |

The product version bump is the **highest bump** across all affected packages.

## Bump Guidelines

| Scenario | Bump | Example |
|---|---|---|
| Remove/rename public API | MAJOR | Suppression d'un endpoint REST |
| Add new feature | MINOR | Ajout du mode sombre |
| Add optional parameter | MINOR | Nouveau filtre optionnel |
| Fix incorrect behavior | PATCH | Correction de l'affichage des montants |
| Visible perf improvement | PATCH | Temps de chargement reduit de 50% |

## iOS Specifics

- iOS also tracks its own version in `ios/project.yml` (for App Store)
- Build is an integer, resets to 1 for each new version
- Defined in `ios/project.yml` (managed by XcodeGen)
