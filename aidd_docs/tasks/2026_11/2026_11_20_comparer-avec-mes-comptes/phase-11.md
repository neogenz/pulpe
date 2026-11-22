---
status: pending
---

# Instruction: iOS: step 2, suggestions, gaps below and matched

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Core/Network/
    │   │   └── Endpoints.swift ✏️
    │   ├── Domain/
    │   │   ├── Models/
    │   │   │   └── ReconciliationContext.swift ✅
    │   │   └── Services/
    │   │       └── ReconciliationService.swift ✅
    │   ├── Resources/
    │   │   └── Localizable.xcstrings ✏️
    │   ├── Features/Budgets/BudgetDetails/
    │   │   ├── BudgetDetailsRealizedBalanceSheet.swift ✏️
    │   │   └── Coordinator/
    │   │       └── BudgetDetailsCoordinator+Mutations.swift ✏️
    │   └── Features/CurrentMonth/Reconciliation/
    │       ├── ReconcileCompareStepView.swift ✅
    │       ├── ReconcileAccountsFlow.swift ✏️
    │       ├── ReconcileAccountsSheet.swift ✏️
    │       └── CurrentMonthReconcileSheet.swift ✏️
    └── PulpeTests/
        ├── Domain/
        │   └── ReconciliationContextDecodingTests.swift ✅
        └── Features/CurrentMonth/
            └── ReconcileAccountsFlowTests.swift ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Same data as phase 7 (realized 1 050.00, Assurance 100 line, Essence 60, previous month Pharmacie 40), backend phases 3-4 running | Step 1 ready | system |
| Happy path | Type 950, « Comparer » | Title « Tes comptes ont 100.00 de moins que Pulpe »; Assurance, Essence, Pharmacie « Mois dernier » | system |
| Happy path | Check Essence then Pharmacie | Partial bar after the first, matched screen after the second; completion sent once | system |
| Edge case | 2.40 left, « Aucune dépense ne correspond » | Small gap, « Disponible : 900.00 → 897.60 » | system |
| Edge case | 120.00 left | Large gap question; one « Écart avec mes comptes » entry on a double tap | system |
| Edge case | Offline when step 2 opens | Error with [Réessayer], nothing written; back keeps the typed amounts | system |
| Teardown | Delete the entry, uncheck the items | Demo month back to setup | system |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) ←  Comparer avec mes comptes ? │
│ (2) Étape 2 sur 2                │
│     Tes comptes ont 100.00 de    │
│     moins que Pulpe              │
│ ┌──────────────────────────────┐ │
│ │ (3) Sur tes comptes   950.00 │ │
│ │ Dans Pulpe, déjà coché 1 050.00│
│ │ (4) ▓▓▓▓░░ 60.00 trouvés     │ │
│ └──────────────────────────────┘ │
│ (5) Coche les dépenses que tu…   │
│ ┌──────────────────────────────┐ │
│ │ (6) ☐ Assurance       100.00 │ │
│ │       Prévue ce mois         │ │
│ └──────────────────────────────┘ │
│ (7) Voir les 42 autres à cocher  │
│ (8) [ Aucune dépense ne corr. ]  │
│     Laisser comme ça             │
└──────────────────────────────────┘
```

1. Back to step 1, title, « ? ».
2. Step label and verdict title.
3. The two figures, old Pulpe figure struck through after a check.
4. Progress bar after a check.
5. Lead sentence, card wording with a « Je dois » row.
6. Up to 3 suggestions, 64pt rows.
7. Opens `ToPointPage`.
8. Dismiss, then leave as is.

## Tasks to do

### `1)` Context service

> iOS reads the server context and records completion.

1. `ReconciliationContext.swift` (decodes the phase 3 schema), `ReconciliationService.swift` with get and update, endpoints in `Endpoints.swift`.

### `2)` Compare step

> Step 2 of spec.md §4.1-4.3 with suggestions from every source.

1. `ReconcileCompareStepView.swift` driven by `comparisonScreen`, `comparedFigure` and `rankedPointingCandidates` with prior items; amounts with `.monospacedDigit()` and `.lineLimit(1)` (spec.md §5).
2. `ReconciliationChecking` checks movements and budget lines of any of the three months; the flow refetches the context after a check; both entry points wire it.
3. `BudgetDetailsCoordinator+Mutations.swift`: `reconciliationChecking` refuses items outside the loaded budget today (`:58-65`); prior-month items go through the budget services, then `syncCache()` so the month stores refresh.
4. Step 2 waits for the context; a failure shows the error of spec.md §4.1 with [Réessayer] and offers no write.

### `3)` Gaps below, matched, completion

> Small and large gaps write one entry; the matched screen explains the remaining difference.

1. Small and large gap screens, « Disponible : a → b »; entry name « Écart avec mes comptes » replaces « Ajustement ».
2. Matched screen with `matchedBreakdown`; every exit of spec.md §4.5 sends completion once.
3. Remove the inline verdict footer and label field from `ReconcileAccountsSheet.swift`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `ReconciliationContextDecodingTests` decodes a full and an empty context |
| 2 | `ReconcileAccountsFlowTests`: candidate order and partial numbers of the happy path; checking a previous-month item from the budget detail succeeds and refreshes the context; a failed context offers no write |
| 3 | Flow tests: one write on double tap, completion once, entry name; `PulpeTests` and SwiftLint strict pass |
