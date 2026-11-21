---
status: pending
---

# Instruction: Backend: comparison state endpoints

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── shared/
│   ├── schemas.ts ✏️
│   ├── index.ts ✏️
│   └── src/
│       ├── error-codes.ts ✏️
│       └── reconciliation-schema.spec.ts ✅
└── backend-nest/src/
    ├── app.module.ts ✏️
    ├── common/constants/
    │   └── error-definitions.ts ✏️
    └── modules/reconciliation/
        ├── reconciliation.module.ts ✅
        ├── reconciliation.tokens.ts ✅
        ├── domain/
        │   ├── reconciliation-state.entity.ts ✅
        │   └── ports/
        │       └── reconciliation-state-repository.port.ts ✅
        ├── application/
        │   ├── get-reconciliation-context.use-case.ts ✅
        │   ├── get-reconciliation-context.use-case.spec.ts ✅
        │   ├── update-reconciliation-state.use-case.ts ✅
        │   └── update-reconciliation-state.use-case.spec.ts ✅
        └── infrastructure/
            ├── http/
            │   ├── reconciliation.controller.ts ✅
            │   ├── reconciliation.controller.spec.ts ✅
            │   └── dto/
            │       └── reconciliation-swagger.dto.ts ✅
            └── persistence/
                ├── supabase-reconciliation-state.repository.ts ✅
                └── supabase-reconciliation-state.repository.spec.ts ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Local Supabase with phase 2 applied, demo user signed in with its client key | `GET /v1/reconciliation/:budgetId` reachable | api |
| Happy path | GET for the current budget of a user with no row | `startingAmount: 0`, `hasCompletedComparison: false`, `priorCorrection: 0`, `priorItems: []` | api |
| Happy path | `PUT /v1/reconciliation/state` `{ "startingAmount": 3100, "completed": true }` then GET | `startingAmount: 3100`, `hasCompletedComparison: true`; the column holds a ciphertext, not `3100` | api |
| Edge case | PUT `{}`, PUT an unknown key, PUT `startingAmount: "abc"` | 400 with the shared validation error | api |
| Edge case | GET with another user's budget id | 404, nothing leaked | api |
| Edge case | PUT without `X-Client-Key` | 401 like every other write | api |

## Tasks to do

### `1)` Shared contract

> One schema per endpoint, shared by the three clients.

1. In `shared/schemas.ts`: `reconciliationPriorItemSchema` (`id`, `source` `transaction | budgetLine`, `budgetId`, `name`, `amount`, `kind`, `monthsAgo` 1 or 2, `effect`), `reconciliationContextSchema` (`startingAmount`, `hasCompletedComparison`, `priorCorrection`, `priorItems`) and its response, `updateReconciliationStateSchema` (strict object, `startingAmount` finite number optional, `completed: true` optional, at least one key).
2. Export them from `shared/index.ts`; focused spec in `reconciliation-schema.spec.ts`.
3. Error codes for a missing budget and a refused write in `shared/src/error-codes.ts` and `error-definitions.ts`.

### `2)` State repository

> Read and upsert the person's row through `ENCRYPTION_PORT`, plain numbers above the repository.

1. Port plus Supabase repository: read returns `{ startingAmount, lastCompletedAt }` (0 and null with no row); write upserts, encrypting `starting_amount` like `supabase-savings-goal.repository.ts:1535-1547`.

### `3)` Use cases and controller

> `GET /v1/reconciliation/:budgetId` and `PUT /v1/reconciliation/state`, guarded like every user route.

1. Get context: checks the budget belongs to the user, returns the stored state with `priorCorrection: 0` and `priorItems: []` (filled in phase 4).
2. Update state: sets the starting amount when given, sets `last_completed_at = now()` when `completed` is true.
3. Controller with Swagger DTOs, Zod validation from the shared schemas; register the module in `app.module.ts`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `cd shared && pnpm test` passes the schema spec (valid, empty, unknown key, non-finite) |
| 2 | Repository spec proves the ciphertext round trip and the no-row default |
| 3 | `cd backend-nest && bun test` and `bun run quality` pass; the API scenarios above give the stated responses |
