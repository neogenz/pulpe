# Versioning

## Modèle

Pulpe utilise une **version produit unique** en SemVer (`MAJOR.MINOR.PATCH`), trackée dans le `package.json` racine.

Chaque release produit un seul tag git et une seule GitHub Release :

```
vX.Y.Z   ← un seul tag, une seule release
```

## Règles de bump

La version produit prend le **bump le plus élevé** parmi tous les packages impactés :

| Commit | Bump |
|--------|------|
| `feat!:` / `BREAKING CHANGE:` | MAJOR |
| `feat:` | MINOR |
| `fix:` / `perf:` | PATCH |

Les commits techniques (`chore:`, `refactor:`, `test:`, `ci:`, `docs:`, `style:`, `build:`) ne déclenchent pas de release.

## Sous-packages

Chaque sous-package JS/TS conserve sa propre version dans son `package.json` (gérée par [changesets](https://github.com/changesets/changesets)). Ces versions internes :

- **Sont bumpées uniquement quand le package est impacté**
- **Ne génèrent PAS de tags git** — seul le tag produit `vX.Y.Z` existe
- Servent à tracer les changements par package dans les `CHANGELOG.md` locaux

## iOS

iOS conserve sa version dans `ios/project.yml` (`MARKETING_VERSION`). Voir [IOS_VERSIONING.md](./IOS_VERSIONING.md) pour les détails Apple.

**Règle d'alignement :** iOS n'est bumpé que quand du code iOS est modifié. À ce moment, `MARKETING_VERSION` s'aligne sur la version produit courante. iOS peut donc sauter des versions.

**Exemple :**

| Release | Changements | Tag | Frontend | Backend | iOS |
|---------|-------------|-----|----------|---------|-----|
| v1.7.0 | web + iOS + backend | `v1.7.0` | 0.19.0 | 0.12.0 | **1.7.0** |
| v1.8.0 | web only | `v1.8.0` | 0.20.0 | *inchangé* | *inchangé (1.7.0)* |
| v1.9.0 | web + backend | `v1.9.0` | 0.21.0 | 0.13.0 | *inchangé (1.7.0)* |
| v1.10.0 | iOS + web | `v1.10.0` | 0.22.0 | *inchangé* | **1.10.0** |

iOS saute de 1.7.0 à 1.10.0 — c'est voulu. Apple impose des versions strictement croissantes, et la version produit garantit cette contrainte.

## Format des notes de release

Chaque GitHub Release suit ce template constant :

```markdown
## vX.Y.Z

### Nouveautés
- **Titre court** — Description en une phrase

### Corrections
- **Titre court** — Description en une phrase

### Technique
- Description technique si pertinent
```

Règles :
- En français
- Pas d'emojis
- Groupé par type (Nouveautés / Corrections / Technique), pas par package
- Les changements purement techniques internes sont omis ou regroupés sous "Technique"

## Workflow

```
git log → analyser commits → proposer version → changeset + bump root (+iOS si impacté) → tag vX.Y.Z → GitHub Release
```

Automatisé via le skill `/update-changelog`.
