---
status: done
---

# Instruction: Isoler les tests du réseau et dédupliquer le SemVer

## Architecture projection

```txt
.
├── backend-nest/src/common/utils/
│   └── semver-compare.ts                                  ✏️ exporte SEMVER_PATTERN, seul point commun SemVer
├── backend-nest/src/config/
│   └── environment.ts                                     ✏️ consomme SEMVER_PATTERN sur ses 4 champs de version
└── backend-nest/src/modules/
    ├── app-version/
    │   ├── ios-version-gate.service.ts                    ✏️ constante nommée pour l'arrêt du retry, regex importée
    │   └── ios-version-gate.service.spec.ts               ✏️ couvre onApplicationBootstrap
    └── encryption/
        └── encryption.e2e.spec.ts                         ✏️ IOS_STORE_URL sans identifiant, coupe l'appel sortant
```

## Tasks to do

### `1)` Couper l'appel sortant vers Apple dans la suite de tests

> `app.init()` sur `AppModule` déclenche la pré-chauffe, donc un vrai fetch vers `itunes.apple.com`.

1. Dans le bloc de force-override d'env de `encryption.e2e.spec.ts` (à côté de `process.env.NODE_ENV = 'test'`), poser `process.env.IOS_STORE_URL = 'https://apps.apple.com/app/pulpe'`.
2. Commenter en une ligne pourquoi : URL sans identifiant App Store => court-circuit sans réseau.

### `2)` Couvrir la pré-chauffe au bootstrap

> Le comportement le plus récent du service n'a aucun test.

1. Dans `ios-version-gate.service.spec.ts`, ajouter un test qui appelle `service.onApplicationBootstrap()` puis `flushPendingRefresh()`.
2. Asserter que `mockFetch` a été appelé une fois et que `resolve().latestVersion` vaut la version App Store, sans `resolve()` préalable.

### `3)` Nommer l'arrêt définitif du retry

> `Number.POSITIVE_INFINITY` se lit, son intention non ; les autres TTL du fichier sont nommés.

1. Déclarer `const NEVER_REFRESH_AGAIN = Number.POSITIVE_INFINITY;` à côté de `RETRY_TTL_MS`.
2. L'utiliser dans la branche « pas d'identifiant App Store ».

### `4)` Dédupliquer la regex SemVer

> Le diff crée `semver-compare.ts` comme point commun SemVer, mais la regex reste copiée 5 fois.

1. Exporter `SEMVER_PATTERN` depuis `semver-compare.ts`, en gardant le commentaire qui lie la regex à `isVersionAtMost`.
2. Remplacer la constante locale du service par cet import.
3. Remplacer les 4 littéraux `/^\d+\.\d+\.\d+$/` de `environment.ts` par la constante importée.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1    | La suite complète passe avec le réseau coupé vers `itunes.apple.com` ; aucun test ne dépend de la joignabilité d'Apple           |
| 2    | Un service tout juste construit, sans appel à `resolve()`, sert la version App Store après `onApplicationBootstrap()` + flush     |
| 3    | Aucun littéral `Number.POSITIVE_INFINITY` ne subsiste dans le corps des méthodes du service                                       |
| 4    | `/^\d+\.\d+\.\d+$/` n'apparaît plus ni dans `environment.ts` ni dans `ios-version-gate.service.ts` ; les deux consomment `SEMVER_PATTERN` |
| 1-4  | `bun test` vert sur la suite backend et `bun run quality` sans erreur                                                             |
| 1-4  | `GET /api/v1/app/version` sert exactement le même payload qu'avant, vérifié par les specs de `app-version`                        |
