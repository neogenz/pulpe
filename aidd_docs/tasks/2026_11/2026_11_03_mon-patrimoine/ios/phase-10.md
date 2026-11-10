---
status: pending
---

# Instruction: Income drawn from an asset

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Shared/
    │   │   └── Components/
    │   │       ├── SavingsOriginToggle.swift ✏️
    │   │       └── EditBudgetLineSheet.swift ✏️
    │   ├── Features/
    │   │   └── Budgets/
    │   │       └── BudgetDetails/
    │   │           ├── AddBudgetLineSheet.swift ✏️
    │   │           ├── AddBudgetLineSheet+IncomeOrigin.swift ✏️
    │   │           ├── AddBudgetLineSheet+Parts.swift ✏️
    │   │           └── AddBudgetLineSheet+Submit.swift ✏️
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        ├── Shared/
        │   └── Components/
        │       └── EditBudgetLineSheetTests.swift ✏️
        └── Features/
            ├── Budgets/
            │   └── BudgetDetails/
            │       └── AddBudgetLineIncomeOriginTests.swift ✏️
            └── CurrentMonth/
                └── MovementSheetTests.swift ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag forced, demo account, « Livret » own active | Asset in the store | simulator |
| Happy path | Add a Revenu « Retrait livret » 300, « Cet argent vient de mon épargne », segment « Tiré de mon patrimoine », Livret | `POST /v1/budget-lines` carries `assetId` and no `savingsGoalId`; the line is created like a regular income | simulator |
| Happy path | Point it, open « Mon patrimoine » | Livret « Je propose », detail « 300 € de revenu tiré … » | simulator |
| Happy path | Open the line in edit | « Pris sur Livret » read-only; no picker | simulator |
| Edge case  | Origin « Tiré de mon patrimoine » without an asset chosen | Ajouter disabled | cli |
| Edge case  | Switch origin from « Tiré de mon patrimoine » to « D'un objectif » or off | `assetId` cleared; a request never carries both links | cli |
| Edge case  | No active own asset, or flag off | No « Tiré de mon patrimoine » segment, no « Pris sur » card; the origin toggle behaves as today | cli |
| Edge case  | `MovementSheet` income | Unchanged: its toggle does not offer the asset segment | cli |
| Edge case  | Every month | Template line create carries `assetId` | cli |
| Teardown   | Delete the test prévision and asset, remove the plist key | Baseline restored | simulator |

## Tasks to do

### `1)` A third origin

> A Revenu can be drawn from an own asset; the three origins stay exclusive.

1. `SavingsOrigin` gains `.asset`, labelled with the web copy `budget.incomeOrigin.asset` « Tiré de mon patrimoine » (the wording `docs/BUSINESS_RULES.md` Patrimoine fixes); check on the smallest simulator that three segments do not wrap, and shorten only through a translated key if they do; `SavingsOriginToggle` gains `offersAsset: Bool = false` and lists only the offered segments, so `MovementSheet+Details.swift:12` is unchanged.
2. `IncomeOrigin` gains `.asset`, mapped both ways with `SavingsOrigin.asset`; `forbidsChecked` unchanged for it (a drawn income is pointed like a regular one).
3. `AddBudgetLineSheet`: `offersAsset` when the flag is on and `assetStore.activeAssets(direction: .own)` is not empty; under the toggle, `AssetPickerField(direction: .own)` titled « Tiré de » with `netWorth.link.drawnHint`; `resetIncompatibleOriginState()` clears `assetId` outside `.asset`; submit validity requires an asset in `.asset`.
4. `+Submit`: once and every month send `assetId` for an income only in `.asset` (phase 8 already sends it for saving and expense); the spread path is not offered for this origin.

### `2)` Read-only origin on edit

> The edit form shows the origin the way it shows a savings-goal source.

1. `EditBudgetLineSheet`: for an income with `assetId`, when the flag is on, a `FormCard` « Pris sur <name> » beside `SavingsGoalSourceLabel` (line 141), name from `AssetStore`, nothing when the asset is gone; no picker, and the PATCH never touches `assetId` for an income.
2. Copy: `budget.incomeOrigin.asset`, `netWorth.link.drawnLabel`, `drawnHint`, `drawnFrom` with `de`, `en`, `it`.

### `3)` Lock the paths

> Exclusivity and the untouched movement sheet are tested.

1. `AddBudgetLineIncomeOriginTests`: mapping both ways, reset clears `assetId`, submit body carries `assetId` and no `savingsGoalId`.
2. `EditBudgetLineSheetTests`: income with `assetId` sends no `assetId` key on edit.
3. `MovementSheetTests`: the toggle offers no asset segment.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | A Revenu « Tiré de mon patrimoine » is created with `assetId` and, once pointed, yields the phase 9 suggestion |
| 2    | The edit form shows « Pris sur <name> » and offers no way to change it |
| 3    | `AddBudgetLineIncomeOriginTests`, `EditBudgetLineSheetTests`, `MovementSheetTests` pass with a non-zero executed count; `AddBudgetLineSheet*` stay ≤350 lines (`BudgetDetailsArchitectureTests`); `pnpm test:lexicon`, `swiftlint lint --strict` and the full `PulpeTests` run pass |
