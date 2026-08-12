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

Automatisé via le skill `/release`.

## Force-update gate (rollout)

Ce choix d'architecture et son comportement fail-open sont consignés dans
[ADR-0017](adr/0017-server-driven-minimum-version-gate.md).

Le backend expose `GET /api/v1/app/version` qui renvoie, par plateforme, la version minimale supportée et la dernière version publiée. Les clients (webapp + iOS) comparent leur version courante :

- **< `minVersion`** → blocage dur, CTA vers le store
- **≥ `minVersion`** → aucune incitation

`latestVersion` est publié mais **aucun client ne le lit** aujourd'hui : `AppVersionStore` (iOS) et `AppVersionStore` (webapp) ne comparent que `minVersion`. Le champ reste réservé à un futur toast "mise à jour disponible".

Cinq variables d'env pilotent ce gate côté backend, validées par Zod (`backend-nest/src/config/environment.ts`) :

| Variable | Rôle | Format |
|----------|------|--------|
| `MIN_IOS_VERSION` | Plancher iOS — en dessous = blocage dur | SemVer `X.Y.Z` |
| `LATEST_IOS_VERSION` | Repli hors-ligne / override manuel — la valeur servie vient de l'App Store | SemVer `X.Y.Z` |
| `IOS_STORE_URL` | Deep link App Store (CTA "Mettre à jour") — porte aussi l'ID interrogé par le lookup | URL absolue |
| `MIN_WEB_VERSION` | Plancher webapp | SemVer `X.Y.Z` |
| `LATEST_WEB_VERSION` | Dernière version webapp publiée | SemVer `X.Y.Z` |

Source de vérité : Railway (env Production). Les valeurs locales restent celles de `backend-nest/.env.example`.

### iOS : la version publiée se résout toute seule

`IosVersionGateService` (`backend-nest/src/modules/app-version/`) interroge le lookup public Apple (`https://itunes.apple.com/lookup?id=<app id>`, ID extrait de `IOS_STORE_URL`) et sert cette version comme `ios.latestVersion`.

Le lookup part une première fois au démarrage du conteneur, puis paresseusement : la première requête passé le TTL (6 h) déclenche un appel en tâche de fond. Aucune requête client n'attend Apple, et le redémarrage qui suit un changement de variable Railway sert la bonne version sans attendre le premier appel client.

Échec, timeout (3 s) ou version non SemVer → on garde la valeur précédente et on réessaie dans 15 min. Cas distinct : une `IOS_STORE_URL` sans identifiant App Store est une erreur de config, pas un incident réseau — un seul `warn` est émis, sans réessai, et la valeur d'env est servie tant que le conteneur vit.

Dans tous les cas de repli, `LATEST_IOS_VERSION` sert de plancher : la valeur servie est `max(env, App Store)`, jamais une régression.

Conséquence : **aucun bump Railway à faire après une approbation App Store**. `MIN_IOS_VERSION` peut aussi être armé avant la fin du rollout Apple — le plancher servi est borné par la version réellement téléchargeable (`minVersion = min(MIN_IOS_VERSION, latestVersion)`), donc le blocage s'active de lui-même quand Apple publie, sans jamais bloquer sur un binaire indisponible.

### Quand bumper `MIN_*`

Bumper `MIN_IOS_VERSION` / `MIN_WEB_VERSION` **uniquement** quand on doit éjecter les clients d'une version antérieure :

- Faille de sécurité côté client qu'on ne peut pas mitiger server-side.
- Breaking change d'API que les anciens clients ne savent pas négocier.
- Bug data-corrupting fixé dans une release ultérieure.

Hors ces cas, `MIN_*` reste figé. Une release "classique" ne bouge que `LATEST_*`.

### Procédure de rollout

1. **Publier la release webapp AVANT le bump `MIN_WEB_VERSION`.** La version cible doit déjà être **publique et disponible** sur Vercel. Côté iOS, aucune précaution : le plancher servi est borné par la version App Store.
2. **Bump `LATEST_WEB_VERSION` sur Railway** dès la release publiée :
   ```bash
   railway variables --set "LATEST_WEB_VERSION=0.36.0" --service backend
   ```
   Railway redémarre le service à chaque mise à jour de variable — `ConfigService` relit l'env au boot. `LATEST_IOS_VERSION` ne se bump pas : le backend suit l'App Store.
3. **Bump `MIN_*` (force-update)** uniquement quand l'éjection est nécessaire :
   ```bash
   railway variables --set "MIN_IOS_VERSION=1.2.0" --service backend
   ```
   Effet immédiat après redémarrage : tous les clients `< 1.2.0` reçoivent le payload de blocage à leur prochain `GET /api/v1/app/version`.
4. **Vérifier** :
   ```bash
   curl -s https://<backend>/api/v1/app/version | jq
   ```
   Le payload doit refléter les nouvelles valeurs sur les deux plateformes.
5. **Rollback** en cas de force-update prématuré : remettre l'ancienne `MIN_*` sur Railway. Les clients récupèrent leur accès au prochain ping.

### Checklist avant bump `MIN_*`

- [ ] La version cible est-elle disponible sur **toutes** les distributions (App Store review OK, webapp déployée en prod) ?
- [ ] Les anciens clients ont-ils un CTA fonctionnel pour récupérer (store / reload) ?
- [ ] Le microcopy de blocage côté client est-il à jour ?
- [ ] Quel volume d'users sera bloqué (versions courantes en circulation) ?

### Anti-patterns

- Bumper `MIN_IOS_VERSION` avant l'approbation App Store → users bloqués sur une version inexistante.
- Bumper `LATEST_*` sans avoir publié la build → toast qui pointe vers du vide.
- Modifier l'env Railway sans tracer la raison (PR description, run book) — l'audit disparaît.
