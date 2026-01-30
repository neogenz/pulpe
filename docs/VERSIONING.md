# Versioning

## Modèle

Le monorepo utilise une **version produit unique** en SemVer (`MAJOR.MINOR.PATCH`), trackée dans le `package.json` racine.

```
v0.17.0   ← un seul tag, une seule GitHub Release
```

Chaque release regroupe les changements de tous les packages (frontend, backend, shared, landing, iOS).

## Bump

La version produit prend le **bump le plus élevé** parmi tous les packages impactés :

| Commit | Bump |
|--------|------|
| `feat!:` / `BREAKING CHANGE:` | MAJOR |
| `feat:` | MINOR |
| `fix:` / `perf:` | PATCH |

## Versions internes

Les sub-packages conservent leur propre `package.json` version (gérée par [changesets](https://github.com/changesets/changesets)). iOS conserve sa version dans `ios/project.yml` (voir [IOS_VERSIONING.md](./IOS_VERSIONING.md)). Ces versions internes ne génèrent **pas** de tags git — seul le tag produit `vX.Y.Z` est créé.

## Workflow

```
git log → analyser commits → proposer version → changeset + bump root → tag vX.Y.Z → GitHub Release
```

Automatisé via le skill `/update-changelog`.
