# Review: budget list aggregates survive PostgREST's row cap

- **Verdict**: approve
- **Diff**: `preview...fix/budget-list-aggregate-truncation`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_23
- **Findings**: 0 critical, 0 warning, 4 minor (all fixed in the reviewed branch)

## Phases

### Phase 1 — paginate the batched aggregate reads

- [x] The crypto service's paging behaviour is unchanged: its existing suite passes with no edit to its call sites — `aes-gcm.crypto-service.ts:595`, full suite 1593 pass / 0 fail
- [x] With rows spanning two pages, every budget's `totalIncome` / `totalExpenses` matches a per-budget read — `supabase-budget.repository.spec.ts:938` plus the live run: list `remaining` equals detail `remaining` for 24/24 budgets with 1272 rows in place
- [x] Reverting either paging call turns a test red — mutation run: `aggregates the rows sitting past the first page` fails (23 pass / 1 fail), restored green
- [x] Local list-versus-detail comparison reports zero divergent budgets — 0/24 after the fix, 17/24 before

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 1 | `aes-gcm.crypto-service.ts:595` | `#fetchAllPages` / `#fetchRowsByParentIds` became one-line wrappers around the shared util — indirection with no behaviour left. | Deleted both; the 8 call sites import the util directly. Applied. |
| 🟢 | code-health | 1 | `supabase-budget.repository.ts:731` | The two `.catch()` blocks in `fetchBudgetAggregates` differed only by error definition and entity label — 20 duplicated lines, and `fetchHistoryData` collapsed both tables onto one error definition. | Extracted `readPagedRows(parentIds, fetchPage, context)`; each read now names its own `ERROR_DEFINITIONS` entry. Applied. |
| 🟢 | rot | 1 | `supabase-budget.repository.spec.ts:895` | The spec redefined `PAGE_SIZE = 1_000` instead of reading the source of truth, so a page-size change would leave the regression test asserting the old boundary. | Imports `POSTGREST_PAGE_SIZE`. Applied. |
| 🟢 | standards | 1 | `postgrest-pagination.spec.ts:69` | Test name read `keeps every chunk s rows` — a dropped apostrophe. | Reworded to `keeps the rows of every chunk`. Applied. |

Checked and **not** raised, with the reasoning that dismissed each:

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| — | code | 1 | `supabase-budget.repository.ts:730` | Considered: a rejection from the second `fetchRowsByParentIds` after the first already rejected would go unhandled. | Not a defect — `Promise.all` subscribes to every input promise on the same tick, so both rejections are handled. No change. |
| — | performance | 1 | `postgrest-pagination.ts:23` | Considered: `.order('id') + .range()` is offset pagination, so each page re-sorts — O(pages × n log n). | Measured, not theorised: 0.65 ms unsorted vs 1.29 ms per sorted page over 3072 rows, same buffer count (55 → 58). Endpoint A/B with 3072 lines + 1996 transactions: 39–60 ms before, 32–36 ms after. Keyset pagination would be over-engineering at this scale and would diverge from the pattern the codebase already uses. No change. |
| — | error-handling | 1 | `supabase-budget.repository.ts:811` | `fetchHistoryData` lost `supabaseError` from its logging context. | Deliberate: `error-handling-backend.md` forbids the original error in `loggingContext` and requires `{ cause }`. The diff moves toward the rule. No change. |
| — | fit | 1 | `supabase-budget.repository.ts:112` | `fetchBudgetsWithFilters`, `fetchAllBudgets` and `fetchAllBudgetsForExport` are still unpaginated. | Their cap is 1000 **budgets** — 83 years of months. Paginating them would be scope creep on a fix that has a reproduced symptom. No change. |

## Verification

| Metric        | Value                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verified      | 100% (4/4)                                                                                                                                                     |
| Files checked | `postgrest-pagination.ts`, `postgrest-pagination.spec.ts`, `supabase-budget.repository.ts`, `supabase-budget.repository.spec.ts`, `aes-gcm.crypto-service.ts` |
| Unchecked     | none                                                                                                                                                           |
| Unplanned     | none                                                                                                                                                           |
