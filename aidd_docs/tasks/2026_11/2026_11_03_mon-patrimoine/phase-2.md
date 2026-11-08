---
status: done
---

# Instruction: Asset API and net-worth totals

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── shared/
│   ├── schemas.ts ✏️
│   ├── index.ts ✏️
│   └── src/
│       └── error-codes.ts ✏️
└── backend-nest/
    └── src/
        ├── app.module.ts ✏️
        ├── common/
        │   └── constants/
        │       └── error-definitions.ts ✏️
        └── modules/
            └── asset/
                ├── asset.module.ts ✅
                ├── asset.tokens.ts ✅
                ├── domain/
                │   ├── asset.entity.ts ✅
                │   ├── asset.formulas.ts ✅
                │   ├── asset.formulas.spec.ts ✅
                │   └── ports/
                │       ├── asset-repository.port.ts ✅
                │       └── exchange-rate.port.ts ✅
                ├── application/
                │   ├── get-net-worth.use-case.ts ✅
                │   ├── get-net-worth.use-case.spec.ts ✅
                │   ├── create-asset.use-case.ts ✅
                │   ├── update-asset.use-case.ts ✅
                │   ├── remove-asset.use-case.ts ✅
                │   ├── record-asset-snapshots.use-case.ts ✅
                │   ├── record-asset-snapshots.use-case.spec.ts ✅
                │   ├── create-asset-category.use-case.ts ✅
                │   ├── update-asset-category.use-case.ts ✅
                │   └── remove-asset-category.use-case.ts ✅
                └── infrastructure/
                    ├── adapters/
                    │   └── currency-exchange-rate.adapter.ts ✅
                    ├── http/
                    │   ├── asset.controller.ts ✅
                    │   ├── asset-category.controller.ts ✅
                    │   └── dto/
                    │       └── asset-swagger.dto.ts ✅
                    ├── mappers/
                    │   └── asset.mapper.ts ✅
                    └── persistence/
                        ├── supabase-asset.repository.ts ✅
                        └── supabase-asset.repository.spec.ts ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Phase 1 migrated locally, backend started with `pnpm dev:backend` | `GET /v1/assets` answers 200 | api |
| Happy path | First `GET /v1/assets` for a new user | No category, no asset, totals at 0 | api |
| Happy path | `POST /v1/asset-categories` « Comptes », `POST /v1/assets` an EUR account of 1000 in it for a CHF user, then `GET` | Asset with `latestValue` 1000 EUR and `convertedValue` in CHF at today's rate; « Comptes » `total` and `gross` include it | api |
| Happy path | `POST /v1/assets/snapshots` with two items | Both assets show the new value and the same `recordedAt`; the DB row holds ciphertext | api |
| Edge case  | Snapshot of -50 on an `owe` asset | 400 | api |
| Edge case  | Snapshot of -200 on an `own` account | Accepted; counts in `debts`, not in `gross` nor in its category `total` | api |
| Edge case  | No FX rate available and no stale cache | Foreign asset has `convertedValue: null`; `incomplete: true`; totals exclude it | api |
| Edge case  | `DELETE /v1/asset-categories/:id` on a non-empty category | 409 `ERR_ASSET_CATEGORY_NOT_EMPTY` | api |
| Edge case  | Archive an asset | Still listed with `archivedAt`, excluded from totals | api |
| Edge case  | Another user's asset id on PATCH, DELETE or snapshot | 404 `ERR_ASSET_NOT_FOUND` | api |
| Teardown   | `bun run supabase:reset` | Seed restored | system |

## Tasks to do

### `1)` Shared contract

> One named Zod schema per endpoint, re-exported for both sides.

1. In `shared/schemas.ts`: `assetDirectionSchema` (`own|owe`), `assetCategorySchema` (with its `total` in base currency), `assetSchema` (with `latestValue`, `latestRecordedAt`, `convertedValue` nullable), `netWorthTotalsSchema` (`baseCurrency`, `gross`, `debts`, `net`, `incomplete`), `netWorthResponseSchema`.
2. Strict write schemas: `assetCreateSchema` (with a required first `value`), `assetUpdateSchema` (`name`, `categoryId`, `inPulpe`, `archived`; currency and direction are fixed after creation), `assetSnapshotsCreateSchema` (`items: [{ assetId, value }]`, min 1), `assetCategoryCreateSchema`, `assetCategoryUpdateSchema`; response schemas.
3. Re-export from `shared/index.ts`; `pnpm build:shared`.
4. Error codes `ASSET_NOT_FOUND`, `ASSET_CATEGORY_NOT_FOUND`, `ASSET_CATEGORY_NOT_EMPTY`, `ASSET_CATEGORY_DUPLICATE`, `ASSET_VALUE_INVALID` in `shared/src/error-codes.ts` and `error-definitions.ts`.

### `2)` Net-worth formula

> Pure domain function, the single place the totals are computed.

1. `asset.formulas.ts`: from active assets with their latest value and a rate per currency, return each converted value, each category `total`, and `gross`, `debts`, `net`, `incomplete`.
2. `own` positive goes to its category `total` and to `gross`; `own` negative and `owe` go to `debts`; archived assets and unconverted ones stay out; money rounded to 2 decimals.
3. `asset.formulas.spec.ts` covers mixed currencies, overdraft, archived, missing rate, net below zero, category totals.

### `3)` Repository with encryption

> Persist and read assets, encrypting every snapshot value.

1. `asset-repository.port.ts`, `exchange-rate.port.ts` (`getRate(base, target)`) and their symbols in `asset.tokens.ts`, on the `modules/tag` and `BUDGET_RECALCULATION_PORT` patterns.
2. `currency-exchange-rate.adapter.ts` implements the port over `CurrencyService.getRate`; only this adapter imports the currency module.
3. `supabase-asset.repository.ts` encrypts `value` through `ENCRYPTION_PORT` on write, decrypts on read without a silent fallback, reads the latest snapshot per asset through `fetchAllPages`.
4. Map `23503` on category delete to `ASSET_CATEGORY_NOT_EMPTY` and `23505` to `ASSET_CATEGORY_DUPLICATE`.
5. Spec: ciphertext on write, plaintext on read, latest snapshot per asset beyond 1000 rows.

### `4)` Use cases

> One `execute()` per operation.

1. `get-net-worth`: read assets, base currency through `USER_REPOSITORY.findSettings()`, a rate per foreign currency through `EXCHANGE_RATE_PORT`, then the formula.
2. `create-asset` writes the asset and its first snapshot; `update-asset` maps `archived` to `archived_at`; `remove-asset` deletes.
3. `record-asset-snapshots` validates ownership and sign per direction, writes all items with one `recorded_at`.
4. Category create, update (rename), remove.
5. Specs for `get-net-worth` (rate failure, base currency) and `record-asset-snapshots` (sign rule, foreign id).

### `5)` HTTP surface

> Versioned, authenticated endpoints wired into the app.

1. `asset.controller.ts`: `GET /v1/assets`, `POST /v1/assets`, `PATCH /v1/assets/:id`, `DELETE /v1/assets/:id`, `POST /v1/assets/snapshots`, all `@UseGuards(AuthGuard)`, DTOs through `createZodDto`.
2. `asset-category.controller.ts`: `POST`, `PATCH /:id`, `DELETE /:id` on `/v1/asset-categories`.
3. `asset.mapper.ts` turns rows into API shapes, called by the controllers.
4. `asset.module.ts` with `createInfoLoggerProvider` per use case, binds `EXCHANGE_RATE_PORT` to the adapter; imports `CurrencyModule` and the user module; register in `app.module.ts`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | Frontend and backend import the new schemas from `pulpe-shared`; a create payload with an unknown key is rejected |
| 2    | The formula spec passes for mixed currencies, overdraft, archived, missing rate, negative net and category totals |
| 3    | A written snapshot is ciphertext in the DB and reads back as the typed value; no application file outside the adapter imports `CurrencyService` |
| 4    | A negative value on an `owe` asset is refused; a rate failure sets `incomplete` instead of failing the read |
| 5    | The endpoints answer per the Test Scope with the error codes listed; `cd backend-nest && bun run quality` passes |
