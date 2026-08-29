# Versioning

## Modèle

Pulpe utilise une **version produit unique** en SemVer (`MAJOR.MINOR.PATCH`), trackée dans le `package.json` racine.

Chaque release produit un seul tag git et une seule GitHub Release :

```
vX.Y.Z   ← un seul tag, une seule release
```

## Règles de bump

La version produit prend le **bump le plus élevé** parmi tous les packages impactés :

| Commit                        | Bump  |
| ----------------------------- | ----- |
| `feat!:` / `BREAKING CHANGE:` | MAJOR |
| `feat:`                       | MINOR |
| `fix:` / `perf:`              | PATCH |

Les commits techniques (`chore:`, `refactor:`, `test:`, `ci:`, `docs:`, `style:`, `build:`) ne déclenchent pas de release.

## Sous-packages

Les cinq sous-packages JS/TS sont dans le groupe `fixed` de
[Changesets](https://github.com/changesets/changesets). À chaque release, frontend,
landing, backend, shared et Android prennent tous la version produit racine, même si
un seul package a changé. Le manifeste Expo `android/app.json` est ensuite synchronisé
sur cette cible. Ils ne génèrent aucun tag séparé ; seul `vX.Y.Z` existe.

## iOS

iOS conserve sa propre SemVer dans `ios/project.yml`, indépendante de la version
produit. Une modification iOS purement technique augmente seulement le build ; une
fonctionnalité ou correction visible approuvée augmente sa version marketing. Une
release web/backend ne la modifie pas. Voir [IOS_VERSIONING.md](./IOS_VERSIONING.md).

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

```text
git log → proposition approuvée → branche release/vX.Y.Z → bump fixed-mode
→ PR de préparation vers main approuvée → preuve staging → publish
→ pointeur production + preuve production → tag vX.Y.Z + GitHub Release
```

Automatisé via le skill `/release`.

## Force-update gate (rollout)

Ce choix d'architecture et son comportement fail-open sont consignés dans
[ADR-0017](adr/0017-server-driven-minimum-version-gate.md).

Le backend expose `GET /api/v1/app/version` qui renvoie, par plateforme, la version minimale supportée et la dernière version publiée. Les clients (webapp + iOS) comparent leur version courante :

- **< `minVersion`** → blocage dur, CTA vers le store
- **iOS, ≥ `minVersion` et < `latestVersion`** → suggestion App Store dismissible, une fois par version cible
- **≥ `latestVersion`** → aucune incitation

`latestVersion` est consommé par l'iOS pour la suggestion douce. La webapp
l'ignore encore et ne compare que `minVersion`. Seules les versions iOS qui
embarquent ce mécanisme peuvent afficher la suggestion : il n'existe aucun
moyen rétroactif de la déclencher dans la 1.0.0.

Sept variables d'env pilotent ce gate côté backend, validées par Zod (`backend-nest/src/config/environment.ts`) :

| Variable                 | Rôle                                                                                 | Format         |
| ------------------------ | ------------------------------------------------------------------------------------ | -------------- |
| `MIN_IOS_VERSION`        | Plancher iOS — en dessous = blocage dur                                              | SemVer `X.Y.Z` |
| `LATEST_IOS_VERSION`     | Repli hors-ligne / override manuel — la valeur servie vient de l'App Store           | SemVer `X.Y.Z` |
| `IOS_STORE_URL`          | Deep link App Store (CTA "Mettre à jour") — porte aussi l'ID interrogé par le lookup | URL absolue    |
| `MIN_WEB_VERSION`        | Plancher webapp                                                                      | SemVer `X.Y.Z` |
| `MIN_ANDROID_VERSION`    | Plancher Android — en dessous = blocage dur                                          | SemVer `X.Y.Z` |
| `LATEST_ANDROID_VERSION` | Dernière version Android publiée                                                     | SemVer `X.Y.Z` |
| `ANDROID_STORE_URL`      | Deep link Play Store (CTA "Mettre à jour")                                           | URL absolue    |

La dernière version web vient de `backend-nest/package.json`, embarqué dans l'artifact.
Les politiques minimales restent dans Railway (env Production).

Android n'a pas d'équivalent public au lookup App Store. `LATEST_ANDROID_VERSION` se bump donc à la main à chaque release, et `MIN_ANDROID_VERSION` doit rester ≤ `LATEST_ANDROID_VERSION` — un refine Zod refuse le boot sinon.

### iOS : la version publiée se résout toute seule

`IosVersionGateService` (`backend-nest/src/modules/app-version/`) interroge le lookup public Apple (`https://itunes.apple.com/lookup?id=<app id>&country=ch`, ID extrait de `IOS_STORE_URL`) et sert cette version comme `ios.latestVersion`.

Le `country=ch` n'est pas décoratif : sans storefront, Apple répond depuis un cache plus ancien. Le 23.08.2026 cette URL rendait encore 1.4.1, trois jours après la publication de 1.4.2 que tous les storefronts nommés — `us` compris — servaient déjà. Le pays choisi importe peu, son absence seule crée le retard.

Le lookup part une première fois au démarrage du conteneur, puis paresseusement : la première requête passé le TTL (6 h) déclenche un appel en tâche de fond. Aucune requête client n'attend Apple, et le redémarrage qui suit un changement de variable Railway sert la bonne version sans attendre le premier appel client.

Échec, timeout (3 s) ou version non SemVer → on garde la valeur précédente et on réessaie dans 15 min. Cas distinct : une `IOS_STORE_URL` sans identifiant App Store est une erreur de config, pas un incident réseau — un seul `warn` est émis, sans réessai, et la valeur d'env est servie tant que le conteneur vit.

Dans tous les cas de repli, `LATEST_IOS_VERSION` sert de plancher : la valeur servie est `max(env, App Store)`, jamais une régression.

Conséquence : **aucun bump Railway à faire après une approbation App Store**. `MIN_IOS_VERSION` peut aussi être armé avant la fin du rollout Apple — le plancher servi est borné par la version réellement téléchargeable (`minVersion = min(MIN_IOS_VERSION, latestVersion)`), donc le blocage s'active de lui-même quand Apple publie, sans jamais bloquer sur un binaire indisponible.

### Quand bumper `MIN_*`

Bumper `MIN_IOS_VERSION` / `MIN_WEB_VERSION` / `MIN_ANDROID_VERSION` **uniquement** quand on doit éjecter les clients d'une version antérieure :

- Faille de sécurité côté client qu'on ne peut pas mitiger server-side.
- Breaking change d'API que les anciens clients ne savent pas négocier.
- Bug data-corrupting fixé dans une release ultérieure.

Hors ces cas, `MIN_*` reste figé. Une release web classique ne modifie aucune variable
de version ; l'iOS continue d'utiliser son fallback `LATEST_IOS_VERSION`, tandis que
`LATEST_ANDROID_VERSION` suit manuellement la version réellement disponible sur Play.

### Procédure de rollout

1. **Publier la cible AVANT le bump de son `MIN_*`.** La webapp doit déjà être publique sur Vercel. La version Android doit déjà être disponible sur Play pour l'audience concernée avant de relever `MIN_ANDROID_VERSION`. Côté iOS, le plancher servi est borné par la version App Store réellement téléchargeable.
2. **Laisser le preflight publier son contexte immuable.** Après preuve que le frontend
   exact est public, Railway déploie `main` en tant qu'unique owner du backend. La
   version web est celle de l'artifact ; aucun opérateur ne synchronise de variable ni
   ne redéploie le service dans le chemin normal. `LATEST_IOS_VERSION` ne se bump pas :
   le backend suit l'App Store. Après disponibilité sur Play, mettre
   `LATEST_ANDROID_VERSION` sur la version Android effectivement publiée.
3. **Bump `MIN_*` (force-update)** uniquement quand l'éjection est nécessaire :
   ```bash
   railway variables --set "MIN_IOS_VERSION=1.2.0" --service backend
   railway variables --set "MIN_WEB_VERSION=1.2.0" --service backend
   railway variables --set "MIN_ANDROID_VERSION=1.2.0" --service backend
   ```
   Effet immédiat après redémarrage : tous les clients `< 1.2.0` reçoivent le payload de blocage à leur prochain `GET /api/v1/app/version`.
4. **Vérifier** :
   ```bash
   curl -s https://<backend>/api/v1/app/version | jq
   ```
   Le payload doit refléter les nouvelles valeurs sur les trois plateformes : web, iOS et Android, avec l'URL Play pour Android.
5. **Rollback** en cas de force-update prématuré : remettre l'ancienne `MIN_*` sur Railway. Les clients récupèrent leur accès au prochain ping.

### Checklist avant bump `MIN_*`

- [ ] La version cible est-elle disponible sur **toutes** les distributions concernées (App Store review OK, webapp déployée en prod, Android disponible sur Play pour l'audience visée) ?
- [ ] Les anciens clients ont-ils un CTA fonctionnel pour récupérer (store / reload) ?
- [ ] Le microcopy de blocage côté client est-il à jour ?
- [ ] Quel volume d'users sera bloqué (versions courantes en circulation) ?

### Anti-patterns

- Bumper `MIN_IOS_VERSION` avant l'approbation App Store → users bloqués sur une version inexistante.
- Bumper `MIN_ANDROID_VERSION` avant la disponibilité sur Play → users Android bloqués sans mise à jour récupérable.
- Bumper `LATEST_IOS_VERSION` sans avoir publié la build iOS → suggestion iOS qui pointe vers du vide.
- Modifier l'env Railway sans tracer la raison (PR description, run book) — l'audit disparaît.
