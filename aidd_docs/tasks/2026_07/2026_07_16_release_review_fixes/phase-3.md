---
status: done
---

# Instruction: Backend — parity gate releases-data ↔ landing/data/releases.json

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
backend-nest/src/modules/whats-new/domain/
└── releases-data.parity.spec.ts    ✅ spec bun test: la projection iOS embarquée reste synchrone avec landing/data/releases.json
```

## Tasks to do

### `1)` Spec de parité exécutée par le job CI backend existant

> Aujourd'hui la parité n'est vérifiée que si un humain suit le skill /update-changelog (validate-ios-release.ts, hors CI).

1. Lire `validate-ios-release.ts` (script du skill update-changelog) et reprendre ses assertions de parité — même sémantique de dérivation: release iOS-visible = `platforms.includes('ios')` ET ≥1 `feature`/`fix`.
2. Créer `releases-data.parity.spec.ts` à côté de `releases-data.ts`: lire `landing/data/releases.json` via `fs` + chemin résolu depuis `import.meta.dir` (pas d'import TS cross-package), puis asserter dans les deux sens: (a) chaque release landing iOS-visible a son entrée `releases-data.ts` avec version + contenu projeté identiques; (b) aucune entrée orpheline dans `releases-data.ts`.
3. Message d'échec actionnable: nommer la version en dérive + pointer le skill `/update-changelog` Step 5b-bis.
4. Vérifier que `bun test src/modules/whats-new` (et donc le job CI backend) exécute la spec.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Éditer une release iOS dans `landing/data/releases.json` sans toucher `releases-data.ts` (ou l'inverse) fait échouer `bun test` avec un message nommant la version; l'état actuel du repo passe vert |
