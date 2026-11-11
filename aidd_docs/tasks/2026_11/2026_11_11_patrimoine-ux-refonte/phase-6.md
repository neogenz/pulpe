---
status: pending
---

# Instruction: iOS : lien au patrimoine depuis le rapprochement

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/
├── Pulpe/
│   ├── Resources/Localizable.xcstrings ✏️
│   ├── Domain/Store/AssetStore.swift ✏️
│   ├── Features/Budgets/BudgetDetails/BudgetDetailsRealizedBalanceSheet.swift ✏️
│   └── Features/CurrentMonth/Reconciliation/
│       ├── ReconcileLinkedAccountsGate.swift ✏️
│       ├── CurrentMonthReconcileSheet.swift ✏️
│       ├── ReconcileAccountsFlow.swift ✏️
│       ├── ReconcileAccountsSheet.swift ✏️
│       ├── ReconcileAccountsSheet+LinkedAccounts.swift ✏️
│       └── ReconcileAccountsSheet+AccountLink.swift ✅
└── PulpeTests/Features/CurrentMonth/
    ├── ReconcileLinkedAccountsTests.swift ✏️
    └── ReconcileAccountsFlowTests.swift ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Same accounts as web phase 3, CHF user | Reconciliation sheet open, BCGE prefilled | system |
| Happy path | Pick « Revolut » on a new row, finish | `PATCH inPulpe:true` + snapshot | system |
| Happy path | « Autre compte… » « Neon », « Ajouter à Mon patrimoine » on, finish | `POST /v1/assets` in « Comptes », no extra snapshot | system |
| Edge case | Remove the prefilled BCGE row, finish | `PATCH inPulpe:false`, no snapshot | system |
| Edge case | « Ajouter à Mon patrimoine » on with an empty name | Cannot finish | system |
| Edge case | Dismiss | No write | system |
| Teardown | Delete « Neon », stop following Revolut | Seed state | system |

## Tasks to do

### `1)` Extract before adding

> `ReconcileAccountsSheet.swift` is at 492 lines.

1. Move the row view into `ReconcileAccountsSheet+AccountLink.swift` before any new code.

### `2)` Same row model as web

> A row is one of my accounts, or a free line.

1. `ReconcileLinkedAccountsGate` passes every active own account in the user's currency, plus the followed subset; update its two callers (`CurrentMonthReconcileSheet`, `BudgetDetailsRealizedBalanceSheet`) and `ReconcileAccountsSheet.init`.
2. `ReconcileAccountsFlow`: replace `linkedAssets` with a per-row account (`asset(id)`, or `other(addToNetWorth:)`); `linkedSnapshotItems` becomes the same split as web (`snapshots`, `links`, `unlinks`, `creates`), a removed followed account giving one unlink.
3. The row label becomes a menu of my accounts ending with « Autre compte… », the same pattern as the Type menu of the element sheet; « Autre compte… » keeps the name field and adds the « Ajouter à Mon patrimoine » toggle. `AssetStore` runs creates, `PATCH`es then the snapshot batch on completion, with a toast on failure.
4. Strings (fr, en, de, it) aligned on web phase 3, with no « Dans Pulpe » and no « rapproché ».

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `ReconcileAccountsSheet.swift` well under 500 lines after the change; SwiftLint strict green |
| 2 | `ReconcileLinkedAccountsTests` cover each Test Scope row; dismiss writes nothing; no duplicate `assetId` in a batch |
