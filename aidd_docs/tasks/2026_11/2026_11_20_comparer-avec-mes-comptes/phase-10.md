---
status: pending
---

# Instruction: iOS: step 1 and entry points

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── App/
    │   │   └── SessionDataResetting.swift ✏️
    │   ├── Resources/
    │   │   └── Localizable.xcstrings ✏️
    │   ├── Features/Budgets/BudgetDetails/
    │   │   └── BudgetDetailsRealizedBalanceSheet.swift ✏️
    │   └── Features/CurrentMonth/Reconciliation/
    │       ├── ReconcileAccountsStepView.swift ✅
    │       ├── ReconcileAddAccountSheet.swift ✅
    │       ├── ReconcileFreeAccountsStore.swift ✅
    │       ├── ReconcileAccountsFlow.swift ✏️
    │       ├── ReconcileAccountsSheet.swift ✏️
    │       ├── ReconcileAccountsSheet+AccountLink.swift ✏️
    │       ├── ReconcileAccountsSheet+LinkedAccounts.swift ✏️
    │       ├── ReconcileDraftStore.swift ✏️
    │       └── CurrentMonthReconcileSheet.swift ✏️
    └── PulpeTests/Features/CurrentMonth/
        ├── ReconcileAccountsFlowTests.swift ✏️
        ├── ReconcileLinkedAccountsTests.swift ✏️
        └── ReconcileFreeAccountsStoreTests.swift ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Demo user, `net_worth` forced on by setting `pulpe.feature_flags.net_worth` in the app's sandboxed preferences (app stopped), guide seen, one own account and one card debt in Mon patrimoine | Step 1 shows the followed accounts | system |
| Happy path | 3 000 on « Compte courant », new « Revolut » « J'ai » 1 000, card from Mon patrimoine 800 | « En tout 3 200.00 », « 4 000 − 800 que tu dois » | system |
| Happy path | Lock the app (PIN), unlock | Step 1 with the same rows and amounts, from home and from the budget detail | system |
| Happy path | Finish, open again | « Revolut » « J'ai » back, empty amount; not in Mon patrimoine | system |
| Edge case | No « Je dois » row | Card help and its button | system |
| Edge case | Account fed by a saving budget line this month | Absent from the add sheet | system |
| Edge case | Budget detail of a past and a future month | No comparison button | system |
| Edge case | `net_worth` off | No Mon patrimoine block | system |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) ×  Comparer avec mes comptes ? │
│ (2) Étape 1 sur 2                │
│     Combien as-tu aujourd'hui ?  │
│ ┌──────────────────────────────┐ │
│ │ (3) Compte courant  J'ai   × │ │
│ │     CHF [ 3 000.00 ]         │ │
│ ├──────────────────────────────┤ │
│ │ (4) Revolut                × │ │
│ │     [ J'ai  |  Je dois ]     │ │
│ │     CHF [ 1 000.00 ]         │ │
│ └──────────────────────────────┘ │
│ (5) + Ajouter un compte          │
│ (6) card help + button           │
│ (7) En tout            4 000.00  │
│ (8) [          Comparer        ] │
└──────────────────────────────────┘
```

1. Close, title, « ? ».
2. Step label, title, sentence.
3. Mon patrimoine row: fixed side, amount, caption, remove.
4. Free row: segmented `Picker` for the side (44pt), amount, remove.
5. Opens `ReconcileAddAccountSheet` (`standardSheetPresentation()`).
6. Card help while no « Je dois » row exists.
7. Total with the « que tu dois » line.
8. Goes to step 2.

## Tasks to do

### `1)` Accounts step

> Step 1 of spec.md §3 in its own view, the sheet keeps only navigation.

1. `ReconcileAccountsStepView.swift` from the rows of `+AccountLink` and `+LinkedAccounts`; the « Compter en négatif » toggle becomes « J'ai / Je dois »; the « Ajouter à Mon patrimoine » switch and the create plan go.
2. `ReconcileAccountsFlow` gains the step state and the side per row.
3. Amounts with `.monospacedDigit()` and `.lineLimit(1)`, spec.md §5.

### `2)` Add an account

> One sheet for new, owed and Mon patrimoine accounts.

1. `ReconcileAddAccountSheet.swift` with the sections and filters of spec.md §3.

### `3)` Device memory and draft

> Names come back next time; amounts survive a lock from both entry points.

1. `ReconcileFreeAccountsStore.swift` over `UserDefaults` (names and sides only), cleared on logout from `LiveSessionDataResetter.resetStores()` in `SessionDataResetting.swift`.
2. `ReconcileDraftStore` keeps the draft for the budget detail entry too.

### `4)` Current month only

> No button on past or future months.

1. `BudgetDetailsRealizedBalanceSheet.swift` passes `onReconcile` only when `budget.isCurrentPeriod(payDayOfMonth:)`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `ReconcileAccountsFlowTests`: totals with « Je dois », remove leaves Mon patrimoine untouched; no amount wraps on the simulator at the largest standard text size |
| 2 | `ReconcileLinkedAccountsTests`: add sheet filters, flag off |
| 3 | `ReconcileFreeAccountsStoreTests`: names and sides restored, no amount stored; draft restored after PIN from the budget detail |
| 4 | Past and future months show no button on the simulator; `PulpeTests` and SwiftLint strict pass |
