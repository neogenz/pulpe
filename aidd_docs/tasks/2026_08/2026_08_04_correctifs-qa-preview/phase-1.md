---
status: done
---

# Instruction: Origine d'épargne rendue au détail d'un budget

`GET /budgets/:id/details` renvoie `sourceSavingsGoalId` et `sourceSavingsGoalName` à `null` sur
toutes ses transactions, alors que les colonnes sont bien remplies en base et que
`POST /transactions` les renvoie correctement. Conséquence : la mention « Pris sur · <objectif> »
n'apparaît nulle part sur la page budget ni dans son dialogue d'édition. Toute la surface budget de
PUL-329 est invisible en production.

La cause est une entité de projection locale au module `budget` qui n'a jamais reçu les deux champs.
Rien ne casse à la compilation parce que `TransactionApiSource` les déclare optionnels avec un
`?? null` de repli — repli écrit pour les projections RPC qui ne sélectionnent pas ces colonnes, alors
que ce chemin-ci fait bien un `select('*')`.

## Architecture projection

```txt
backend-nest/src/modules/budget/
├── domain/
│   └── budget.entity.ts                                  ✏️ TransactionDecrypted gagne les 2 champs
└── infrastructure/
    ├── persistence/
    │   ├── supabase-budget.repository.ts                 ✏️ toTransactionDecrypted les recopie
    │   └── supabase-budget.repository.spec.ts            ✏️ régression (créer si absent ✅)
    └── mappers/
        └── budget.mapper.spec.ts                         ✏️ régression au niveau mapper
```

## Tasks to do

### `1)` Porter les deux champs dans l'entité de projection

> L'entité décrit ce que le dépôt sait vraiment lire.

1. Dans `budget.entity.ts`, ajouter à `TransactionDecrypted` : `sourceSavingsGoalId: string | null`
   et `sourceSavingsGoalName: string | null`, non optionnels — l'optionalité est exactement ce qui a
   masqué l'oubli.
2. Suivre le commentaire d'entité existant : ces champs sont en lecture seule, jamais éditables.

### `2)` Recopier les colonnes dans le mapper du dépôt

> Le `select('*')` les ramène déjà ; il ne manque que l'affectation.

1. Dans `supabase-budget.repository.ts`, méthode `toTransactionDecrypted`, ajouter
   `sourceSavingsGoalId: decrypted.source_savings_goal_id` et
   `sourceSavingsGoalName: decrypted.source_savings_goal_name`.
2. Vérifier qu'aucune autre projection du même module ne doit les porter : le chemin de recalcul ne
   sélectionne que `kind, amount, budget_line_id` et n'en a pas besoin.
3. Vérifier les trois autres consommateurs de `mapTransactionToApi` (`transaction`, `allocation`,
   `savings-goal`) — ne rien y changer si leur source porte déjà les champs.

### `3)` Verrouiller par un test

> Le test doit échouer si quelqu'un retire une des deux lignes.

1. Un test de dépôt : une ligne `transaction` portant `source_savings_goal_id` et
   `source_savings_goal_name` ressort en entité avec les deux valeurs, pas `null`.
2. Un test de mapper : l'entité décryptée traverse `toTransactionApi` sans perdre l'origine.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `TransactionDecrypted` déclare les deux champs en `string \| null` non optionnels ; le projet type-check.                                            |
| 2    | Une réponse de `GET /budgets/:id/details` portant un revenu issu d'un objectif contient l'identifiant ET le nom de l'objectif, pas `null`.           |
| 3    | Les tests backend passent, et retirer l'une des deux affectations du mapper fait échouer au moins un test.                                           |
