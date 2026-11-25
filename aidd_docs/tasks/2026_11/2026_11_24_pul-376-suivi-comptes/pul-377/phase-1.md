---
status: pending
---

# Instruction: Serveur — valeur à jour, contrat, mise en service

## Architecture projection

```txt
.
├── shared/
│   ├── schemas.ts ✏️
│   └── src/asset-contract.spec.ts ✅
├── backend-nest/
│   ├── supabase/migrations/20261124120000_asset_value_follows_checked_lines.sql ✅
│   └── src/modules/asset/
│       ├── domain/asset.entity.ts ✏️
│       ├── domain/asset.formulas.ts ✏️
│       ├── domain/asset.formulas.spec.ts ✏️
│       ├── application/dismiss-asset-suggestion.use-case.ts ✏️
│       ├── application/dismiss-asset-suggestion.use-case.spec.ts ✏️
│       ├── application/get-net-worth.use-case.spec.ts ✏️
│       ├── infrastructure/mappers/asset.mapper.ts ✏️
│       └── infrastructure/persistence/supabase-asset.repository.ts ✏️ (+ spec)
└── docs/BUSINESS_RULES.md ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Livret own CHF 10 000, Leasing owe CHF 8 000 | brute 10 000, dettes 8 000, nette 2 000 | system |
| Happy path | Épargne 500 liée au Livret pointée (CA1) | Livret `latestValue` 10 500, `recordedValue` 10 000, nette 2 500, `suggestion` null | system |
| Happy path | Dépense 300 liée au Leasing pointée (CA2) | Leasing 7 700, dettes 7 700, nette 2 300 | system |
| Happy path | Revenu 1 000 tiré du Livret pointé (CA3) | Livret 9 000 | system |
| Edge case  | Ligne pointée avant la saisie 12 000, Épargne 200 après (CA5) | 12 200 | system |
| Edge case  | Leasing 200, remboursement 300 puis achat… (CA6 + règle de l'epic) | 0 puis jamais négatif ; ordre de `checked_at` respecté | system |
| Edge case  | Élément EUR, ligne CHF (CA14) | montant converti au taux ; sans taux, dernière saisie et `incomplete` | system |
| Edge case  | Élément archivé (CA15) | dernière saisie, hors totaux | system |
| Edge case  | `POST /dismiss-suggestion` (CA18) | renvoie l'élément, n'écrit rien | api |
| Edge case  | Migration sur un élément écarté après sa dernière photo (CA17) | une photo copiée datée de l'écartement ; relancée, rien de plus | system |

## Tasks to do

### `1)` Contrat partagé

> `assetSchema` porte la valeur à jour et la dernière saisie.

1. `latestValue` : valeur à jour (dernière saisie + pointé depuis), devise de l'élément ; JSDoc dit pourquoi le nom reste (apps installées).
2. Ajouter `recordedValue: z.number()` (dernière saisie) ; `latestRecordedAt` = date de cette saisie.
3. `suggestion` : `@deprecated`, toujours `null`, gardé pour iOS 1.14.x et Android.
4. Test : un payload CA1 se lit avec `netWorthResponseSchema` et avec la forme lue par les apps installées (champs connus, `suggestion: null`).

### `2)` Formule

> `computeNetWorth` calcule la valeur à jour et les totaux à partir d'elle.

1. `AssetWithValue.latestValue` → `recordedValue` ; retirer `suggestionDismissedAt`.
2. `CheckedLinkedLine` gagne `checkedAt`.
3. `checkedLinesCutoffs` : seuil = date de la dernière saisie, éléments actifs seulement.
4. Valeur : actif et taux connu → dernière saisie + chaque ligne convertie (centimes / taux, arrondi par ligne), dans l'ordre de `checkedAt` ; une dette est bornée à 0 à chaque pas ; sinon la dernière saisie.
5. `convertedValue`, brute, dettes, sous-totaux à partir de la valeur à jour ; `NetWorthAsset` porte `value` et `recordedValue`.

### `3)` Lecture, mapper, route d'écartement

1. Le repository lit `checked_at` et ne lit/écrit plus `suggestion_dismissed_at`.
2. Mapper : `latestValue = value`, `recordedValue`, `suggestion: null`.
3. `DismissAssetSuggestionUseCase` : n'écrit rien, renvoie l'élément (404 s'il n'existe pas).

### `4)` Migration de mise en service

1. Contract, `safe-after v0.66.2`. Copie, pour chaque élément dont `suggestion_dismissed_at` est après sa dernière photo, de cette photo (chiffré tel quel) datée de l'écartement.
2. Trigger `AFTER UPDATE OF suggestion_dismissed_at` qui fait la même copie pour un écartement écrit par l'ancien backend pendant la bascule.
3. Appliquer sur la base locale, vérifier l'idempotence, `generate-types:local` + `format`.

### `5)` Règles métier

1. `docs/BUSINESS_RULES.md` § Patrimoine : remplacer les points « proposition » et « Appliquer / Écarter » par la règle de la valeur à jour.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `pnpm --filter pulpe-shared test` vert ; le payload CA1 se lit. |
| 2 | CA1–CA7, CA14, CA15 et la règle de la dette prouvés par `asset.formulas.spec.ts` avec les montants du ticket. |
| 3 | CA18 : la route renvoie l'élément sans `update` ; CA11 : aucun chemin de pointage n'écrit de photo. |
| 4 | CA16, CA17 prouvés sur la base locale (requêtes SQL du rapport) ; deuxième passage sans nouvelle ligne. |
| 5 | La section décrit la règle de la valeur à jour, sans « Appliquer ». |
