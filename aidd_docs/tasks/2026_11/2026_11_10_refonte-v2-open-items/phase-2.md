---
status: done
---

# Instruction: « Dépassées » says when nothing overruns

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   └── Features/
    │       └── Budgets/
    │           └── BudgetDetails/
    │               ├── BudgetDetailsView.swift ✏️
    │               └── Projection/
    │                   ├── BudgetDetailsProjector.swift ✏️
    │                   └── BudgetDetailsScreenState.swift ✏️
    └── PulpeTests/
        └── Features/
            └── Budgets/
                └── BudgetDetails/
                    └── Projection/
                        └── BudgetDetailsCheckedProjectionTests.swift ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup | From `ios/`, run `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' -derivedDataPath .build/dd-unit CODE_SIGNING_ALLOWED=NO -only-testing:PulpeTests/BudgetDetailsCheckedProjectionTests` | The suite runs with an executed count above zero | cli |
| Happy path | Project with the `.over` filter and prévisions of which none overruns | `canShowEmptyOver` is true | cli |
| Edge case | `.over` filter on a month without prévision | `canShowEmptyOver` is false: the add row stays | cli |
| Edge case | `.over` filter with one dépense over its plan | `canShowEmptyOver` is false | cli |
| Edge case | `.over` filter, type filter on Revenu, while a dépense overruns | `canShowEmptyOver` is false: the type filter hides the overrun, the month still has one | cli |
| Edge case | `.over` filter, no overrun, search text typed | `canShowEmptyOver` is false, like `canShowEmptyChecked` under search | cli |
| Edge case | On the iPhone 17 simulator against the local backend: « Dépassées » on, « Rattraper » the last overrun | The page shows « Plus rien ne dépasse ce mois-ci. » under the rail, no « Ajouter une prévision » card; tapping « Tout » brings the list back | system |

## Tasks to do

### `1)` Derive the flag in the projector

> One Bool says « Dépassées » is on and the month has no overrun left, type filter aside.

1. In `BudgetDetailsScreenState.swift`, add `let canShowEmptyOver: Bool` after `canShowEmptyChecked`, and `canShowEmptyOver: false` in `.empty`.
2. In `BudgetDetailsProjector.swift`, add `private static func makeCanShowEmptyOver(_ ctx: AssemblyContext) -> Bool`: `ctx.searchText.isEmpty`, `ctx.filtersStore.checkedFilter == .over`, `!ctx.dataStore.budgetLines.isEmpty`, and `FiltersStore.checkedCounts(for: ctx.dataStore.budgetLines, typeFilter: .all, consumptionByLineId: ctx.consumptionByLineId).over == 0`.
3. Pass it in `assembleScreenState`, after `canShowEmptyChecked`.
4. One doc line on the helper: a type filter that hides overrun dépenses must not read as nothing overrunning.

### `2)` Show the message in the view

> The empty page explains itself; the rail stays, so « Tout » is one tap away.

1. In `BudgetDetailsView.swift`, after the `canShowEmptyChecked` block (`:213-221`), add `if screenState.canShowEmptyOver` with a `ContentUnavailableView` holding only `Label("Plus rien ne dépasse ce mois-ci.", systemImage: "checkmark.circle")`, with the same `.frame` and `.padding` as the sibling. The key already exists in the catalog with en, de and it.
2. Extend the `SectionAddRow` condition (`:244`) with `!screenState.canShowEmptyOver`.
3. No fallback to « Tout »: it would filter the list again as soon as an overrun comes back.

### `3)` Tests

> Each trigger of Test Scope has a projection test.

1. In `BudgetDetailsCheckedProjectionTests.swift`, add the five projection cases, built like the existing ones (`ProjectionTestStack.makeStores(checkedFilter: .over)`, `stack.data.appendBudgetLine`, `stack.data.appendTransaction`).
2. For the type-filter case, set the filter with `stack.filters.setTypeFilter(.income)` if `makeStores` has no parameter for it.
3. Run the suite with the Setup command and read the executed count; run `BudgetDetailsArchitectureTests` the same way for the line ceiling.

### `4)` Walk it on the simulator

> The defect was read in code only; see it gone on a device.

1. On the iPhone 17 simulator against the local backend, with the seed account, open a month with one overrun, pick « Dépassées », catch it up with « Rattraper ».
2. Check the message, the missing add card, and the list coming back on « Tout ».

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1    | `canShowEmptyOver` is true only with the `.over` filter, prévisions present, no search text and no overrun in the whole month; the projector stays at 350 lines or less |
| 2    | With the flag true the page shows « Plus rien ne dépasse ce mois-ci. » and no add row; with it false the page is as before |
| 3    | `BudgetDetailsCheckedProjectionTests` and `BudgetDetailsArchitectureTests` pass with every new case executed |
| 4    | After « Rattraper » clears the last overrun on « Dépassées », the message is on screen and « Tout » restores the list |
