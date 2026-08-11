---
status: done
---

# Instruction: couvrir les trois lectures de retrait

## Architecture projection

```txt
backend-nest/src/modules/savings-goal/infrastructure/persistence/
└── ✏️ supabase-savings-goal.repository.spec.ts   # +1 describe, ~6 it
```

Aucun autre fichier. Le code de production ne bouge pas.

## Contexte à lire avant d'écrire

| Quoi                                                     | Où                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| Les trois méthodes publiques                              | `supabase-savings-goal.repository.ts:435-471`                          |
| Les deux lecteurs de lignes privés                        | `fetchWithdrawalRows:1066`, `fetchPlannedWithdrawalRows:1125`          |
| Les deux mappeurs                                         | `toLinkedWithdrawal:1106`, `toPlannedWithdrawal:1154`                  |
| Le harnais de mocks déjà en place                         | même spec, `createMockProvider:37`, `createMockEncryption`             |
| Le style d'assertion à imiter (capture d'argument + shape) | même spec, `describe('findLinkedContributions'):650`                   |

Rappel de forme : `bun:test`, descriptions en anglais, `should`-free comme le reste
de ce fichier (les `it` existants commencent par le nom de la méthode ou un verbe).
Suivre le fichier, pas la règle générique.

## Tasks to do

### `1)` Un harnais de provider pour les lectures de retrait

> Une fabrique qui capture la table visitée, les filtres appliqués, et rend la donnée fournie.

1. S'inspirer de `createContributionsProvider` : un `jest.fn()` par maillon de la
   chaîne (`from` → `select` → `in` → `eq`), chacun rendant le maillon suivant.
2. Exposer de quoi asserter : la table reçue par `from`, les ids reçus par `.in(...)`,
   et le couple reçu par `.eq(...)` quand il y en a un.
3. Réutiliser `createMockEncryption()` tel quel — `tryDecryptAmount` y rend déjà une
   valeur déchiffrée, c'est ce que les mappeurs appellent.

### `2)` Couvrir `findPlannedWithdrawals`

> La prévision qui annonce une sortie : autre table que son jumeau, et une garde de kind.

1. Cas nominal : la lecture frappe `budget_line`, filtre `source_savings_goal_id` sur
   l'objectif demandé, et **ajoute `kind = income`** ; la ligne rendue porte `id`,
   `amount` déchiffré, et `month`/`year` remontés depuis `monthly_budget`.
2. Aucune ligne : rend `[]` **sans demander la DEK** (le court-circuit `if (!rows.length)`
   est avant `getDekFor`).
3. Erreur base : `SAVINGS_GOAL_FETCH_FAILED`, l'erreur d'origine seulement dans la
   chaîne `cause`.

### `3)` Couvrir `findLinkedWithdrawals`

> Le retrait réel, côté `transaction`.

1. Cas nominal : la lecture frappe `transaction` (et **pas** `budget_line`), filtre
   `source_savings_goal_id`, et rend `amount` déchiffré, `month`/`year` à plat, et
   `budget_line_id` renommé `budgetLineId`.
2. Erreur base : `TRANSACTION_FETCH_FAILED` — l'autre définition d'erreur que sa jumelle,
   c'est précisément ce qui se dérive en silence.

### `4)` Couvrir `findWithdrawals`

> Même lecteur que le précédent, mais une autre forme et un tri qui lui est propre.

1. Rend `transactionId`, `budgetId`, `name`, `transactionDate` et `amount` déchiffré.
2. Trie par date **décroissante**, quel que soit l'ordre rendu par la base : fournir
   des lignes délibérément en désordre.
3. Un montant indéchiffrable retombe sur `0` sans faire échouer la lecture
   (`tryDecryptAmount` avec sa valeur de repli).

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Le harnais permet d'asserter table, ids filtrés et filtre de kind sans lire le code de production.                                                                            |
| 2    | Faire viser `transaction` à `fetchPlannedWithdrawalRows`, ou lui retirer `.eq('kind', 'income')`, fait échouer un test nommément.                                              |
| 2    | Rendre zéro ligne n'appelle pas `getDekFor`.                                                                                                                                  |
| 2    | Une erreur Supabase ressort en `SAVINGS_GOAL_FETCH_FAILED` avec l'original dans `cause`.                                                                                       |
| 3    | Faire viser `budget_line` à `fetchWithdrawalRows` fait échouer un test ; intervertir les deux définitions d'erreur en fait échouer un autre.                                    |
| 3    | Renommer `budgetLineId` en autre chose dans `toLinkedWithdrawal` fait échouer un test.                                                                                         |
| 4    | Retirer le `.sort(...)` de `findWithdrawals` fait échouer un test.                                                                                                            |
| 4    | Un montant indéchiffrable rend `0` et la lecture aboutit quand même.                                                                                                          |
| tous | `cd backend-nest && bun test src/modules/savings-goal` sort en 0, et `bun run quality` sort en 0.                                                                              |
