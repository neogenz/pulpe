---
status: pending
---

# Instruction: Serveur — écrire le compte sur un mouvement

## Architecture projection

```txt
.
├── shared/
│   ├── schemas.ts ✏️
│   └── src/calculators/budget-formulas.spec.ts ✏️
└── backend-nest/
    ├── supabase/
    │   ├── migrations/20261125130000_write_account_on_movements.sql ✅
    │   └── tests/
    │       ├── movement_account_writes.sql ✅
    │       └── README.md ✏️
    └── src/
        ├── types/database.types.ts ✏️
        ├── common/utils/asset-link.ts ✏️
        ├── common/utils/budget-line-api.mapper.ts ✏️
        └── modules/
            ├── budget-line/
            │   ├── domain/budget-line.entity.ts ✏️
            │   ├── application/create-budget-line.use-case.ts ✏️
            │   ├── application/create-budget-line.use-case.spec.ts ✏️
            │   ├── application/update-budget-line.use-case.ts ✏️
            │   ├── application/update-budget-line.use-case.spec.ts ✏️
            │   └── infrastructure/persistence/supabase-budget-line.repository.ts ✏️
            ├── transaction/
            │   ├── domain/transaction.entity.ts ✏️
            │   ├── application/create-transaction.use-case.ts ✏️
            │   ├── application/create-transaction.use-case.spec.ts ✏️
            │   ├── application/update-transaction.use-case.ts ✏️
            │   ├── application/update-transaction.use-case.spec.ts ✏️
            │   ├── infrastructure/mappers/transaction.mapper.ts ✏️
            │   ├── infrastructure/persistence/supabase-transaction.repository.ts ✏️
            │   └── infrastructure/persistence/schemas/rpc-payload.schemas.ts ✏️
            ├── budget/
            │   ├── domain/budget.entity.ts ✏️
            │   └── infrastructure/persistence/supabase-budget.repository.ts ✏️
            └── savings-goal/infrastructure/persistence/supabase-savings-goal.repository.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Jeu d'essai du ticket, budget du mois, aucun compte par défaut | aucun mouvement | api |
| Happy path | `POST /v1/transactions` imprévu 80, `accountId` Compte courant, pointé, puis `GET /v1/assets` (CA5) | Compte courant 4 920 | api |
| Happy path | `PATCH` de l'imprévu vers Revolut (CA11) | Compte courant 5 000, Revolut 320 | api |
| Edge case  | Créer un réel rattaché avec `accountId` (CA4) | réponse `accountId: null`, suit la prévision | api |
| Edge case  | `PATCH` sans `accountId`, avec et sans `tagIds` (CA26) | compte conservé | api |
| Edge case  | Prévision avec `accountId` = `assetId` Livret (CA25) | 400, message de règle | api |
| Edge case  | Compte inexistant ou d'un autre utilisateur | 404 | api |
| Edge case  | Revenu tiré d'un objectif avec compte | compte écrit par la RPC de retrait | api |
| Edge case  | Calculs du budget avec et sans comptes (CA27, CA42) | disponible, solde pointé et report identiques | system |
| Teardown   | Scripts SQL en `ROLLBACK`, données de test supprimées | base intacte | system |

## Tasks to do

### `1)` Contrats partagés

> `accountId` circule sur les prévisions et les mouvements.

1. `budgetLineSchema`, `transactionSchema` : `accountId: z.uuid().nullable().default(null)` (JSDoc : absent d'une réponse = aucun, backend ancien).
2. `budgetLineCreateBaseSchema`, `transactionCreateSchema`, `transactionUpdateSchema` : `accountId: z.uuid().nullable().optional()` (absent à la création = compte par défaut dès la phase 4 ; absent en mise à jour = gardé ; ignoré sur un réel rattaché).

### `2)` Migration des RPC d'écriture

> Les RPC qui réécrivent toutes les colonnes gardent ou écrivent le compte.

1. Contract, `safe-after v0.66.2`. Corps lus en local par `pg_get_functiondef`, mode et `search_path` reconduits.
2. `update_budget_line_with_tags`, `update_transaction_with_tags` : `account_id = patched_row.account_id`.
3. `create_savings_goal_withdrawal`, `update_savings_goal_withdrawal` : `account_id` dans l'INSERT et le SET ; restent SECURITY DEFINER avec `lock_savings_goal_for_withdrawal`.
4. Schémas Zod stricts des payloads de retrait : `account_id: z.uuid().nullable()`.

### `3)` Écritures

1. Entités, mappers (`budget-line-api.mapper.ts`, `transaction.mapper.ts`), lecture des détails du budget et des lignes d'objectif : `accountId`.
2. Création : réel rattaché → `null` ; sinon `dto.accountId ?? null` (remplacé en phase 4).
3. Mise à jour : clé absente = gardé ; réel rattaché = ignoré ; le compte survit à un changement de type.
4. `asset-link.ts` : `throwIfAccountLinkRefused` — « Account access denied » → `ASSET_NOT_FOUND` (404) ; `23514` sur `*_account_not_asset` → `BUSINESS_RULE_VIOLATION` (400) ; appelée par chaque écriture qui porte `account_id`.

### `4)` Tests

1. Specs des use cases : CA4, CA11, CA25, CA26.
2. `movement_account_writes.sql` : RPC `*_with_tags` (clé absente garde, `null` efface), RPC de retrait.
3. `budget-formulas.spec.ts` : CA27 (mêmes chiffres avec `accountId` sur lignes et réels).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `pnpm --filter pulpe-shared test` vert ; un payload sans `accountId` se lit avec `null`. |
| 2 | Suites SQL existantes (retrait, privilèges) et nouvelle suite vertes. |
| 3 | CA4, CA11, CA25 (400), CA26 prouvés par les specs ; aucune écriture ne perd le compte. |
| 4 | `bun test` et `bun run quality` verts. |
