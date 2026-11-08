---
status: done
---

# Instruction: Prévisions linked to an asset

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/
│   └── BUSINESS_RULES.md ✏️
├── shared/
│   └── schemas.ts ✏️
├── backend-nest/
│   ├── supabase/
│   │   ├── migrations/
│   │   │   └── 20261103130000_link_prevision_to_asset.sql ✅
│   │   └── tests/
│   │       ├── README.md ✏️
│   │       └── asset_prevision_link_guard.sql ✅
│   └── src/
│       ├── types/
│       │   └── database.types.ts ✏️
│       ├── common/
│       │   └── utils/
│       │       ├── asset-link.ts ✅
│       │       ├── asset-link.spec.ts ✅
│       │       └── budget-line-api.mapper.ts ✏️
│       └── modules/
│           ├── budget-line/
│           │   ├── application/
│           │   │   ├── create-budget-line.use-case.ts ✏️
│           │   │   ├── update-budget-line.use-case.ts ✏️
│           │   │   ├── create-budget-line-spread.use-case.ts ✏️
│           │   │   ├── reset-budget-line-from-template.use-case.ts ✏️
│           │   │   └── spread-budget-line-from-line.use-case.ts ✏️
│           │   ├── domain/
│           │   │   └── budget-line.entity.ts ✏️
│           │   └── infrastructure/
│           │       └── persistence/
│           │           ├── schemas/
│           │           │   └── rpc-payload.schemas.ts ✏️
│           │           └── supabase-budget-line.repository.ts ✏️
│           └── budget-template/
│               ├── application/
│               │   ├── create-template.use-case.ts ✏️
│               │   ├── create-template-line.use-case.ts ✏️
│               │   ├── update-template-line.use-case.ts ✏️
│               │   ├── bulk-template-line-operations.use-case.ts ✏️
│               │   └── duplicate-template.use-case.ts ✏️
│               ├── domain/
│               │   ├── budget-template.entity.ts ✏️
│               │   └── ports/
│               │       └── template-line-propagation.port.ts ✏️
│               └── infrastructure/
│                   ├── adapters/
│                   │   └── template-line-propagation.adapter.ts ✏️
│                   ├── mappers/
│                   │   └── budget-template.mapper.ts ✏️
│                   └── persistence/
│                       ├── schemas/
│                       │   └── rpc-payload.schemas.ts ✏️
│                       └── supabase-budget-template.repository.ts ✏️
├── android/
│   └── src/
│       └── features/
│           ├── current-month/
│           │   ├── current-month-view-model.ts ✏️
│           │   └── current-month-view-model.spec.ts ✏️
│           ├── budget-details/
│           │   ├── budget-details-selectors.spec.ts ✏️
│           │   ├── budget-detail-screen.spec.tsx ✏️
│           │   ├── budget-line-draft.spec.ts ✏️
│           │   ├── postpone-gate.spec.ts ✏️
│           │   └── components/
│           │       └── budget-line-sheet.spec.tsx ✏️
│           └── templates/
│               ├── template-vm.spec.ts ✏️
│               └── components/
│                   └── template-line-sheet.spec.tsx ✏️
└── frontend/
    ├── e2e/
    │   ├── mocks/
    │   │   └── api-responses.ts ✏️
    │   └── helpers/
    │       └── api-mocks.ts ✏️
    └── projects/
        └── webapp/
            ├── public/
            │   └── i18n/
            │       ├── fr.json ✏️
            │       ├── en.json ✏️
            │       ├── de.json ✏️
            │       └── it.json ✏️
            └── src/
                └── app/
                    ├── testing/
                    │   └── mock-factories.ts ✏️
                    ├── pattern/
                    │   └── asset-picker/
                    │       ├── asset-picker-field.ts ✅
                    │       └── asset-picker-field.spec.ts ✅
                    └── feature/
                        ├── budget/
                        │   └── budget-details/
                        │       └── budget-line/
                        │           ├── create/
                        │           │   ├── dialog.ts ✏️
                        │           │   ├── dialog.schema.ts ✏️
                        │           │   └── spread.schema.ts ✏️
                        │           └── edit/
                        │               ├── dialog.ts ✏️
                        │               └── dialog.schema.ts ✏️
                        └── budget-templates/
                            └── details/
                                ├── components/
                                │   ├── edit-template-line-dialog.ts ✏️
                                │   └── edit-template-line-dialog.schema.ts ✏️
                                └── services/
                                    └── template-line-store.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag forced through the `pulpe-dev-feature-flags` override; « Livret » (own) and « Leasing » (owe) exist; a template and a current budget | Budget page open | browser |
| Happy path | Create an Épargne prévision « Épargne mensuelle » linked to « Livret » | Saved with `assetId`; edit dialog shows « Livret » | browser |
| Happy path | Create a Dépense prévision « Mensualité leasing » linked to « Leasing » | Saved with `assetId`; the picker offered debts only | browser |
| Happy path | Edit « Épargne mensuelle » (the dialog sends `tagIds`) and change its asset | The new `assetId` is stored through `update_budget_line_with_tags` | api |
| Happy path | Link a template line to « Livret », create next month's budget, then generate several months | Every generated prévision carries the same `assetId` | api |
| Happy path | Duplicate that template, create a template from scratch with a linked line | Duplicated and new lines keep `assetId` | api |
| Happy path | Spread an Épargne linked to « Livret » over three months | Each spread line carries the `assetId` | api |
| Edge case  | PATCH a linked prévision without the `assetId` key, as iOS and Android do | Link kept | api |
| Edge case  | Change an Épargne linked to « Livret » into a Dépense without choosing an asset | `asset_id` cleared, no error | api |
| Edge case  | Link an Épargne to an `owe` asset through the API | 400, trigger refusal mapped | api |
| Edge case  | Link to another user's asset id | 404 `ERR_ASSET_NOT_FOUND`, nothing written | api |
| Edge case  | Delete the linked asset | Prévisions stay, `asset_id` becomes null | api |
| Edge case  | Prévision linked to both a savings goal and an asset | Both links kept independently | api |
| Edge case  | The redefined spread, template-lines and template-creation RPCs | Still SECURITY INVOKER | system |
| Edge case  | Flag off | No asset field in any dialog; payloads unchanged | browser |
| Teardown   | `bun run supabase:reset`, remove the flag override | Baseline restored | system |

## Tasks to do

### `1)` Lock the RPCs before redefining them

> The seven RPCs that copy or rewrite prévision columns keep their behaviour and security mode once they carry `asset_id`.

1. Take each body from `\sf` on the local DB, not from a migration file: `create_budget_from_template`, `generate_budgets_from_template`, `apply_template_line_operations`, `create_budget_lines_spread`, `create_template_with_lines`, `update_budget_line_with_tags`, `update_template_line_with_tags`. Record the security mode of each; three are INVOKER since `20260814122000`.
2. Grep the migrations for any other function listing `savings_goal_id` among prévision columns; add it to the list if found.
3. Run the existing budget-line and budget-template repository specs and the SQL tests; record the green baseline.

### `2)` Schema, guard and RPCs

> `asset_id` exists on both tables and only links a compatible asset of the same user.

1. Contract migration, `-- pulpe:safe-after v0.59.0`: nullable `asset_id` on `budget_line` and `template_line`, FK `asset` `ON DELETE SET NULL`, index.
2. Trigger refuses an asset of another user and a kind↔direction mismatch (saving→own, income→own, expense→owe), on the model of `enforce_savings_goal_line_link` (`20260727121000`).
3. Redefine the seven RPCs from the bodies of task 1, adding `asset_id` beside `savings_goal_id` only; keep each security mode and grant.
4. `asset_prevision_link_guard.sql` covers tenant, direction, template copy, generation, duplication, tagged update and security modes; list it in the tests README.
5. `bun run generate-types:local`, then `bun run format`.

### `3)` Shared contract and every typed client

> The wire carries `assetId` wherever `savingsGoalId` travels, and every client compiles.

1. Required nullable `assetId` on `budgetLineSchema` and `templateLineSchema`, as `savingsGoalId` is; optional nullable on their create and update schemas and the spread item; `pnpm build:shared`.
2. Add `assetId: null` to the typed literals: Android `current-month-view-model.ts` and the Android specs listed above; web `testing/mock-factories.ts`, `e2e/mocks/api-responses.ts`, `e2e/helpers/api-mocks.ts`, and every web spec the type check flags.
3. `cd android && pnpm run quality` and `pnpm quality` from the root pass.

### `4)` Backend writes and reads

> Every path that writes a prévision passes `asset_id` through.

1. `asset-link.ts`: keep `asset_id` when the key is absent, clear it on a kind change without a new asset, map the trigger refusal to `ERR_ASSET_NOT_FOUND` or a 400, like `savings-goal-link.ts`.
2. Budget-line use cases, entity, repository, RPC payload schema and `budget-line-api.mapper.ts`.
3. Template use cases (`create-template` included), entity, propagation port and adapter, repository, mapper, RPC payload schema.
4. Specs for each use case touched and for `asset-link.ts`.

### `5)` Web asset picker

> Choose the asset on each prévision when the flag is on.

1. `pattern/asset-picker/asset-picker-field.ts`, value based like `savings-goal-picker-field.ts`, input `direction`, active assets from `AssetApi`, « Aucun » first.
2. Create and edit dialogs: Épargne shows own assets, Dépense shows debts, under the flag; schemas and spread schema carry `assetId`.
3. Template line dialog and `template-line-store.ts` the same.
4. Copy in the four i18n files; `pnpm test:lexicon`; `cd frontend && pnpm exec ng build`.
5. `docs/BUSINESS_RULES.md` Patrimoine section: which prévision kinds link to which direction, and that an expense only ever links to a debt.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | Each RPC body and security mode used as a base comes from the local DB; repository specs and SQL tests green before the change |
| 2    | `asset_prevision_link_guard.sql` passes; existing SQL tests stay green; the three INVOKER RPCs are still INVOKER |
| 3    | Root `pnpm quality` and Android `quality` pass with the new required key |
| 4    | Created, updated (with and without tags), spread, reset, generated, duplicated and template-created prévisions keep or clear `assetId` per the Test Scope; `cd backend-nest && bun run quality` passes |
| 5    | The picker shows only compatible assets per kind and disappears with the flag off; `ng build` passes |
