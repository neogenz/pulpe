---
status: pending
---

# Instruction: Serveur — modèle, propagation et lissage portent le compte

## Architecture projection

```txt
.
├── shared/schemas.ts ✏️
└── backend-nest/
    ├── supabase/
    │   ├── migrations/20261125140000_copy_account_with_previsions.sql ✅
    │   └── tests/
    │       ├── prevision_account_copies.sql ✅
    │       └── README.md ✏️
    └── src/
        ├── types/database.types.ts ✏️
        └── modules/
            ├── budget-template/
            │   ├── domain/budget-template.entity.ts ✏️
            │   ├── application/create-template-line.use-case.ts ✏️
            │   ├── application/update-template-line.use-case.ts ✏️
            │   ├── application/update-template-line.use-case.spec.ts ✏️
            │   ├── application/bulk-template-line-operations.use-case.ts ✏️
            │   ├── application/bulk-template-line-operations.use-case.spec.ts ✏️
            │   ├── application/create-template.use-case.ts ✏️
            │   ├── application/duplicate-template.use-case.ts ✏️
            │   ├── infrastructure/mappers/budget-template.mapper.ts ✏️
            │   ├── infrastructure/persistence/supabase-budget-template.repository.ts ✏️
            │   └── infrastructure/persistence/schemas/rpc-payload.schemas.ts ✏️
            ├── budget-line/
            │   ├── application/create-budget-line-spread.use-case.ts ✏️
            │   ├── application/spread-budget-line-from-line.use-case.ts ✏️
            │   ├── application/spread-budget-line-from-line.use-case.spec.ts ✏️
            │   ├── application/reset-budget-line-from-template.use-case.ts ✏️
            │   ├── domain/ports/budget-line-spread.port.ts ✏️
            │   └── infrastructure/persistence/schemas/rpc-payload.schemas.ts ✏️
            └── transaction/
                ├── application/spread-transaction-from-txn.use-case.ts ✏️
                └── domain/ports/transaction-spread-from-txn.port.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Modèle avec une ligne « Loyer » compte Compte courant et une ligne sans compte | modèle prêt | system |
| Happy path | Créer un budget depuis le modèle (CA31) | « Loyer » porte Compte courant, l'autre aucun | system |
| Happy path | Changer le compte de la ligne de modèle, propagation mois en cours et suivants (CA22) | prévisions non ajustées à la main mises à jour, ajustées intactes | system |
| Happy path | Lisser une Dépense 300 sur Revolut en 3 mois (CA23) | 3 occurrences sur Revolut | api |
| Edge case  | Lisser une prévision ou un imprévu existant qui a un compte | chaque occurrence reprend le compte de la source | api |
| Edge case  | Mise à jour d'une ligne de modèle sans `accountId` (CA26) | compte gardé | api |
| Edge case  | Ligne de modèle avec `accountId` = `assetId` (CA25) | 400 | api |
| Teardown   | Scripts SQL en `ROLLBACK` | base intacte | system |

## Tasks to do

### `1)` Contrats

1. `templateLineSchema` (`nullable().default(null)`), `templateLineCreateSchema`, `templateLineCreateWithoutTemplateIdSchema`, `templateLineUpdateSchema`, `budgetLineSpreadCreateSchema` (`nullable().optional()`).

### `2)` Migration des RPC de copie

> Chaque RPC qui copie les colonnes d'une prévision copie `account_id`, comme `asset_id` dans `20261103130000`.

1. Contract, `safe-after v0.66.2`, corps lus par `pg_get_functiondef`.
2. `create_budget_from_template` : `tl.account_id` copié.
3. `apply_template_line_operations` : `account_id` dans l'UPDATE et l'INSERT de `template_line` et dans la propagation (même sémantique que `asset_id`, `is_manually_adjusted = false` seulement).
4. `create_budget_lines_spread` : `account_id` dans `jsonb_to_recordset` et l'INSERT.
5. `create_template_with_lines` : `account_id` à l'INSERT et dans le JSON rendu.
6. `update_template_line_with_tags` : `account_id = patched_row.account_id`.

### `3)` Modèle et lissage

1. Lignes de modèle : entité, mapper, création, mise à jour (absent = gardé), opérations groupées (clé `account_id` seulement si présente), création et duplication de modèle, schémas Zod stricts.
2. `reset-budget-line-from-template` reprend le compte de la ligne de modèle.
3. Lissage additif : `dto.accountId ?? null` (défaut en phase 4) ; depuis une prévision ou un mouvement : le compte de la source.

### `4)` Tests

1. `prevision_account_copies.sql` : CA22, CA31, CA23, `create_template_with_lines`.
2. Specs : CA26 et CA25 sur une ligne de modèle, lissage depuis une source avec compte.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `pnpm --filter pulpe-shared test` vert. |
| 2 | Suites SQL `apply_template_line_operations_*`, `create_budget_*`, `generate_budgets_atomically` et la nouvelle suite vertes. |
| 3 | CA22, CA23, CA31 vérifiés de bout en bout en local. |
| 4 | `bun test` et `bun run quality` verts. |
