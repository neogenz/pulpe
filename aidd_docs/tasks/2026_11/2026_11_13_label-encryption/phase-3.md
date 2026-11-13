---
status: pending
---

# Instruction: Postgres stops reading labels

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── backend-nest/
    ├── scripts/
    │   └── bench-slow-endpoints.ts ✏️
    ├── supabase/
    │   └── migrations/
    │       └── YYYYMMDDHHMMSS_label_text_from_caller.sql ✅
    └── src/
        ├── types/
        │   └── database.types.ts ✏️
        ├── common/
        │   └── utils/
        │       └── label-order.ts ✅
        └── modules/
            ├── transaction/
            │   ├── application/
            │   │   └── search-transactions.use-case.ts ✏️
            │   ├── domain/
            │   │   └── ports/
            │   │       └── transaction-repository.port.ts ✏️
            │   └── infrastructure/
            │       └── persistence/
            │           └── supabase-transaction.repository.ts ✏️
            ├── tag/
            │   ├── application/
            │   │   ├── create-tag.use-case.ts ✏️
            │   │   └── update-tag.use-case.ts ✏️
            │   └── infrastructure/
            │       └── persistence/
            │           └── supabase-tag.repository.ts ✏️
            ├── asset/
            │   ├── application/
            │   │   ├── create-asset-category.use-case.ts ✏️
            │   │   └── update-asset-category.use-case.ts ✏️
            │   └── infrastructure/
            │       └── persistence/
            │           └── supabase-asset.repository.ts ✏️
            ├── budget-template/
            │   └── infrastructure/
            │       └── persistence/
            │           └── supabase-budget-template.repository.ts ✏️
            ├── savings-goal/
            │   ├── application/
            │   │   └── apply-savings-goal-plan.use-case.ts ✏️
            │   └── infrastructure/
            │       └── persistence/
            │           ├── schemas/
            │           │   ├── rpc-payload.schemas.ts ✏️
            │           │   └── rpc-payload.schemas.spec.ts ✏️
            │           └── supabase-savings-goal.repository.ts ✏️
            └── budget/
                ├── application/
                │   └── generate-budgets.use-case.ts ✏️
                └── infrastructure/
                    └── persistence/
                        └── supabase-budget.repository.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Phase 2 spec green on the code before this phase | Baseline recorded | system |
| Happy path | Run the phase 2 spec after the change | Same search results, same orders, same duplicate and length errors, same generated texts, same goal-name copies | api |
| Happy path | Run the search step of `scripts/bench-slow-endpoints.ts`, which simulates the Supabase latency of each round trip | The time and the number of round trips of one search, in the pull request with the number of pages a search reads on the largest account of phase 2; target p95 under 500 ms | cli |
| Happy path | A week after the release, read the response times of `GET /transactions/search` in the production request logs | The p95, written in the epic with the decision on the cache of Q5 | system |
| Edge case  | Search with more than 25 hits spread over several pages of rows | The 25 newest per type, as before | api |
| Edge case  | Query with regex characters, accents and mixed case | Same hits as the literal case-insensitive match of today | api |
| Edge case  | Two simultaneous creations of the same tag name | One fails with `TAG_ALREADY_EXISTS` while the unique index still exists; the server check alone would let both through, accepted in Q10 | api |
| Edge case  | The plan apply and the budget generation are called through `supabase.rpc` without the text, as an old backend does during a deploy | They still work and still build the text in SQL | system |
| Edge case  | Goal deletion impact whose rows sort differently by id and by name | Lists come back sorted by name | api |

## Tasks to do

### `1)` Search in memory

> Matching runs on values the server holds, not in SQL.

1. `supabase-transaction.repository.ts`: replace the five `imatch` filters by paged reads in today's order (movements by date, budget lines by creation, newest first), matched in memory as a case-insensitive literal substring, stopping at 25 hits per type. Tag-name matching reads the user's tags and matches them the same way.
2. `search-transactions.use-case.ts` and `transaction-repository.port.ts`: pass the raw query instead of the `***=` pattern.
3. Both callers keep the same port and the same response: `GET /transactions/search` and the assistant tool `search_movements`. No cache: Q5 adds one only if production p95 passes 500 ms.
4. `scripts/bench-slow-endpoints.ts`: add a search step. The script already simulates the Supabase latency of each round trip, which is what paged reads multiply; its demo account is small, so also state how many pages a search reads on the largest account of phase 2.

### `2)` Order in the server

> One comparator, the same everywhere.

1. `label-order.ts`: `Intl.Collator('en-US')`, the collation recorded in phase 2; change the locale if production differs.
2. Tags (`findAll`), asset categories (`findAllCategories`) and template lines (`findLinesByTemplateId`): drop `.order('name')`, sort after mapping, keep the id as second key where SQL had one.
3. New migration: `get_savings_goal_deletion_impact` orders by id; `supabase-savings-goal.repository.ts` sorts the returned lists by name.
4. List in the pull request every order that differs from the phase 2 snapshot, and accept or fix each.

### `3)` Check duplicates in the server

> The rule lives where the plain name is known.

1. `create-tag.use-case.ts` and `update-tag.use-case.ts` (reused by `write-tags-in-process.use-case.ts`), `create-asset-category.use-case.ts` and `update-asset-category.use-case.ts`: compare `normalize('NFC').toLowerCase()` with the user's other names read through the repository; throw the existing `TAG_ALREADY_EXISTS` or `ASSET_CATEGORY_DUPLICATE`.
2. Keep the `23505` mapping and the two unique indexes: they still hold for plaintext and go in phase 6.
3. `tag-links.util.ts` also maps a `23505`, to the caller's `duplicateErrorDef`: only the budget-line repository passes one, for a duplicate budget line. No SQL function inserts a tag at runtime (the only `INSERT INTO tag` is the data migration `20260702130000`), so the check has no other call to guard.
4. Lengths need no code: the request schemas already cap tag and category names at 30 and the other names at 100, and phase 2 proves no request reaches the three `CHECK` constraints.

### `4)` Build generated texts in the server

> SQL receives the text, it no longer writes one.

1. Goal-plan apply: each item of `p_plan_withdrawals` may carry the withdrawal line name. `apply-savings-goal-plan.use-case.ts` builds `Retrait — <goal name>`, the strict item schema of the savings-goal `rpc-payload.schemas.ts` gains the optional field with its spec case, and the function reads it. Wrapper and core keep their signatures, so the grants stay and `security_definer_function_privileges.sql` still counts 5 authenticated definers.
2. Budget generation: `generate_budgets_from_template` gains one defaulted parameter, a description per period, with a strict Zod schema and its spec. `generate-budgets.use-case.ts` builds `Budget <month>/<year>`, as `ensure-budgets-for-periods.use-case.ts` already does for `create_budgets_from_template`. A new parameter is a new signature: the migration drops the old one and creates the new one with its grant. The function runs with invoker rights, so the definer count does not move.
3. A call without the text, as an old backend sends during a deploy, still builds it in SQL; phase 6 makes the text mandatory.
4. The copies of a goal name stay in SQL: `enforce_budget_line_savings_goal_source`, `create_savings_goal_withdrawal`, `update_savings_goal_withdrawal`, the plan apply and `sync_savings_goal_withdrawal_name` copy `savings_goal.name` as it is stored, without reading it. No change.
5. One contract migration, `-- pulpe:safe-after` the release in production when it merges: a drop and a grant are refused in an expand migration, and nothing in it breaks the previous backend. Then `bun run generate-types:local` and `bun run format`.

### `5)` Measure the search in production

> Q5: a cache only if the real p95 passes 500 ms.

1. A week after the release, read the response times of `GET /transactions/search` in the production request logs: each request line carries its duration.
2. Write the p95 in the epic. Above 500 ms, the cache gets its own change before phase 6.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | The search cases of the phase 2 spec pass with no `imatch` left in the backend; the measured response time is in the pull request |
| 2    | The order cases pass with no `.order('name')` left on the three lists; every difference is listed and decided |
| 3    | The duplicate cases pass with the unique indexes dropped in a local scratch run, then again with them restored |
| 4    | The generated-text cases pass with the text sent by the server; calls without the text still pass `generate_budgets_atomically.sql` and `apply_savings_goal_plan_destinations.sql`; `security_definer_function_privileges.sql` stays green untouched |
| 5    | The production p95 of the search and the decision on the cache are written in the epic |
