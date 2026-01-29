# SemVer Conventions

All packages use **Semantic Versioning**: `MAJOR.MINOR.PATCH`

## Version Bump Mapping

| Commit Type | Bump | When |
|---|---|---|
| `feat!:` or `BREAKING CHANGE:` | **MAJOR** | API incompatibility, removed features |
| `feat:` | **MINOR** | New user-facing feature (backward compatible) |
| `fix:` | **PATCH** | Bug fix (backward compatible) |
| `perf:` | **PATCH** | Only if user-visible performance improvement |

## Bump Guidelines

| Scenario | Bump | Example |
|---|---|---|
| Remove/rename public API | MAJOR | Suppression d'un endpoint REST |
| Add new feature | MINOR | Ajout du mode sombre |
| Add optional parameter | MINOR | Nouveau filtre optionnel |
| Fix incorrect behavior | PATCH | Correction de l'affichage des montants |
| Visible perf improvement | PATCH | Temps de chargement reduit de 50% |

## Package Registry

| Package | Type | Tag Format |
|---|---|---|
| `pulpe-frontend` | JS/TS | `pulpe-frontend@X.Y.Z` |
| `backend-nest` | JS/TS | `backend-nest@X.Y.Z` |
| `pulpe-shared` | JS/TS | `pulpe-shared@X.Y.Z` |
| `pulpe-landing` | JS/TS | `pulpe-landing@X.Y.Z` |
| `ios` | Native | `ios@X.Y.Z` |

## iOS Specifics

- Version follows SemVer (1.0.0)
- Build is an integer, resets to 1 for each new version
- Defined in `ios/project.yml` (managed by XcodeGen)
