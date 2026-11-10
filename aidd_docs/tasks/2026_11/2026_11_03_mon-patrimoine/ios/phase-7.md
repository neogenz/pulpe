---
status: pending
---

# Instruction: Reconciliation refreshes in-Pulpe assets

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Features/
    │   │   ├── CurrentMonth/
    │   │   │   └── Reconciliation/
    │   │   │       ├── ReconcileAccountsFlow.swift ✏️
    │   │   │       ├── ReconcileAccountsSheet.swift ✏️
    │   │   │       ├── ReconcileAccountsSheet+LinkedAccounts.swift ✅
    │   │   │       ├── ReconcileLinkedAccountsGate.swift ✅
    │   │   │       └── CurrentMonthReconcileSheet.swift ✏️
    │   │   └── Budgets/
    │   │       └── BudgetDetails/
    │   │           └── BudgetDetailsRealizedBalanceSheet.swift ✏️
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── CurrentMonth/
                └── ReconcileLinkedAccountsTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag forced, demo account, « UBS » CHF and « PostFinance » CHF both « Dans Pulpe », « Livret » EUR « Dans Pulpe », user currency CHF | Three in-Pulpe assets, two in CHF | simulator |
| Happy path | Accueil « Le calcul » → « Comparer avec mes comptes » | Two rows « UBS » and « PostFinance », amounts empty, last value as hint, the linked hint under them; Livret absent | simulator |
| Happy path | Type 12 300 and 4 100, record the adjustment (or confirm « à jour ») | One `POST /v1/assets/snapshots` with two items; « Mon patrimoine » shows 12 300 and 4 100, aged today | simulator |
| Happy path | Same from a budget's realized balance sheet | Same rows and same write | simulator |
| Edge case  | Dismiss the sheet after typing | No snapshot request in the backend log | simulator |
| Edge case  | A linked row left empty, or a free row added by hand | Only filled linked rows are sent | cli |
| Edge case  | Snapshot write fails | Error toast; the reconciliation result is unchanged | cli |
| Edge case  | Flag off, or the asset read fails | The sheet opens on one empty row exactly as today; no asset request | simulator |
| Edge case  | Existing `ReconcileAccountsFlowTests`, `AccountReconciliationTests` | Pass unchanged | cli |
| Teardown   | Delete the test assets, remove the plist key | Baseline restored | simulator |

## Tasks to do

### `1)` Seed rows from linked assets

> The flow is built once with its rows already known.

1. `ReconcileAccountsFlow.init` gains `linkedAccounts: [Asset] = []`: one row per linked asset (label = name, amount empty) or the single empty row when none; a private `[Account.ID: String]` keeps each linked row's asset id, so `AccountReconciliation.swift` (formula mirror of `shared/src/calculators/account-reconciliation.ts`) stays untouched.
2. `var linkedSnapshotItems: [AssetSnapshotItem]`: filled linked rows only, value from `AccountReconciliation.parseAmount` cents and `isNegative`; `func lastValueHint(id:) -> Asset?` for the row hint.
3. `ReconcileLinkedAccountsTests`: seeded rows, free rows ignored, empty rows ignored, negative value, no linked account keeps one empty row.

### `2)` Resolve before opening

> Both entry points read the in-Pulpe assets the same way.

1. `ReconcileLinkedAccountsGate<Content: View>`: when `FeatureFlagsStore.isNetWorthEnabled`, awaits `AssetStore.loadIfNeeded()` behind a `ProgressView`, then renders `content(assetStore.inPulpeAccounts(currency: userSettingsStore.currency))`; flag off or load error renders `content([])` at once.
2. `CurrentMonthReconcileSheet` and `BudgetDetailsRealizedBalanceSheet` wrap `ReconcileAccountsSheet` in the gate and pass `linkedAccounts`.

### `3)` Write snapshots on completion only

> A completed reconciliation becomes a dated value of each linked account.

1. `ReconcileAccountsSheet+LinkedAccounts.swift` (keeps the sheet under the 500-line wall): the linked-row hint view and `recordLinkedSnapshots()`, which runs `Task { try await assetStore.recordSnapshots(...) }` when `flow.isCompleted` flips to `true` and items exist, and shows `ToastManager` error copy on failure; dismiss before completion never writes.
2. `ReconcileAccountsSheet.init` takes `linkedAccounts: [Asset] = []` and forwards it to the flow.
3. Copy: `currentMonth.reconcile.accounts.linkedHint` and the last-value hint with `de`, `en`, `it`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `ReconcileLinkedAccountsTests` pass with a non-zero executed count; `ReconcileAccountsFlowTests` and `AccountReconciliationTests` pass unchanged |
| 2    | With the flag off both entry points open as today with no asset request; on, the CHF in-Pulpe rows are seeded |
| 3    | Completion writes one snapshot request with the filled linked rows; dismiss writes nothing; `ReconcileAccountsSheet.swift` stays under 500 lines and `swiftlint lint --strict` passes |
