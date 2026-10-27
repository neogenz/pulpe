---
status: done
---
# Instruction: Reuse reconciliation from budget details
## Architecture projection
- Web: move `feature/current-month/components/reconcile-accounts/*` to `pattern/reconcile-accounts/*`; update home imports and budget-details page/store; extend unit tests and `frontend/e2e/tests/features/account-reconciliation.spec.ts`.
- Android: connect existing sheets in `android/src/features/budget-details/components/budget-detail-overlays.tsx`, with regression tests.
- iOS: add `BudgetDetailsRealizedBalanceSheet` via `BudgetDetailSheetContent`, dispatch confirmed adjustments through the coordinator, and extend flow/coordinator tests.
## User Journey
Open any budget month → reconciliation → compare balances → record adjustment on that budget → updated budget and aggregates.
## Test Scope
Use isolated past/future budget fixtures; record a checked free adjustment on the viewed month, verify home access, prevent writes after navigation, and preserve retry after refusal. Reset fixtures afterward.
## Wireframe
```txt
┌─────────────────────────────────┐
│ (1) Month navigation            │
│ (2) Budget figures              │
│ (3) Reconciliation action       │
│ (4) Existing budget contents    │
└─────────────────────────────────┘
```
1. Selected month. 2. Existing overview; native platforms retain their balance sheet. 3. Entry beside figures on Web, inside balance sheet on native. 4. Existing contents.
## Tasks to do
### `1)` Connect existing flows
Reuse Web dialog in `pattern/` because it injects application services; ESLint forbids cross-feature imports. Preserve home behavior. Reuse `createAllocatedTransaction` with an unallocated checked payload. Android reuses `ReconcileAccountsSheet` and existing mutation invalidation. iOS uses `.addReconciliationAdjustment` through coordinator dispatch, reusing `addTransaction` and `syncCache()` with a late-response identity guard, with no formulas in views. The inline iOS pointing step must receive the viewed month’s items, live checked state and coordinator-backed toggle callback; preserve the home list and add a regression with distinct home/viewed IDs and failure/retry. Capture the viewed budget ID; use live matching metrics and preserve failure, retry and navigation guards. Update obsolete home-only comments. No backend, formula, dependency or translation expansion is required. Keep the complete change within the user-approved 500 net LOC cap.
### `2)` Validate the complete change
Add focused selected-month and failure regressions; run affected Angular and Android tests, iOS flow/coordinator and architecture checks, lint/type checks and Angular build. Run the Web E2E journey last. Report unavailable simulator/device validation explicitly.
## Test acceptance criteria
Past, current and future details expose reconciliation; home still works; one checked adjustment targets only the opened budget and refreshes its aggregates; navigation cannot redirect the write; failed writes preserve retry.
