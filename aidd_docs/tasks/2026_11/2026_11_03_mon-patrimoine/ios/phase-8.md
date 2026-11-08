---
status: pending
---

# Instruction: Asset picker on prévisions and template lines

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete. Files created by an earlier phase of this plan are marked `modify (phase n)`.

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Domain/
    │   │   └── Models/
    │   │       ├── Asset.swift modify (phase 1)
    │   │       ├── BudgetLine.swift ✏️
    │   │       ├── BudgetTemplate.swift ✏️
    │   │       └── BudgetLineSpread.swift ✏️
    │   ├── Shared/
    │   │   └── Components/
    │   │       ├── AssetPickerField.swift ✅
    │   │       └── EditBudgetLineSheet.swift ✏️
    │   ├── Features/
    │   │   ├── Budgets/
    │   │   │   └── BudgetDetails/
    │   │   │       ├── AddBudgetLineSheet.swift ✏️
    │   │   │       ├── AddBudgetLineSheet+Parts.swift ✏️
    │   │   │       ├── AddBudgetLineSheet+Submit.swift ✏️
    │   │   │       └── Spread/
    │   │   │           └── AddBudgetLineSpreadLogic.swift ✏️
    │   │   └── Templates/
    │   │       └── TemplateDetails/
    │   │           └── EditTemplateLineSheet.swift ✏️
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        ├── Domain/
        │   ├── Models/
        │   │   ├── BudgetLineTests.swift ✏️
        │   │   └── AssetLinkTests.swift ✅
        │   └── Services/
        │       └── BudgetLineSpreadRequestTests.swift ✏️
        ├── Shared/
        │   └── Components/
        │       └── EditBudgetLineSheetTests.swift ✏️
        └── Features/
            ├── Budgets/
            │   └── BudgetDetails/
            │       └── Spread/
            │           └── AddBudgetLineSpreadLogicTests.swift ✏️
            └── Templates/
                └── EditTemplateLineSheetTests.swift ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag forced, demo account, « Livret » own and « Leasing » owe active, current month open | Both assets in the store | simulator |
| Happy path | Add an Épargne prévision « Versement livret », « Versée sur » Livret | `POST /v1/budget-lines` body carries `assetId`; the edit sheet shows Livret selected | simulator |
| Happy path | Add a Dépense « Mensualité leasing », « Dette remboursée » Leasing, each month | `POST /v1/budget-templates/.../lines` carries `assetId`; the template line edit shows Leasing | simulator |
| Happy path | Spread an Épargne over 3 months linked to Livret | Spread request carries `assetId` | cli |
| Edge case  | Picker options | Épargne offers own assets only, Dépense debts only, Revenu shows no picker; archived assets absent; « Aucun » first | cli |
| Edge case  | Edit the name of a linked prévision only | PATCH body has no `assetId` key; the link survives | cli |
| Edge case  | Change the link to « Aucun » | PATCH body carries `"assetId": null` | cli |
| Edge case  | Kind changes from Épargne to Dépense | Picker resets to « Aucun »; the backend clears the old link | cli |
| Edge case  | `BudgetLine.toggled()` on a linked line | `assetId` kept | cli |
| Edge case  | Template propagation of a linked line | `propagationUpdate` carries the link change | cli |
| Edge case  | Flag off | No picker; create and update bodies byte-identical to today (no `assetId` key) | cli |
| Teardown   | Delete the test prévisions and assets, remove the plist key | Baseline restored | simulator |

## Tasks to do

### `1)` Models carry the link

> The wire field `assetId` exists wherever `savingsGoalId` does.

1. `BudgetLine` and `TemplateLine` gain `var assetId: String?` (synthesized `decodeIfPresent`); `BudgetLine.toggled()` copies it.
2. `BudgetLineCreate`, `TemplateLineCreate`, `BudgetLineSpreadCreate` and `AddBudgetLineSpreadLogic.SubmitInput` gain `assetId: String? = nil`; `BudgetLineUpdate`, `TemplateLineUpdate`, `TemplateLineUpdateWithId` gain `assetId: String??` (memory: tri-state PATCH).
3. `Asset.swift`: `extension TransactionKind { var assetDirection: AssetDirection? }` (saving → own, expense → owe, income → nil for the picker) and `static func assetLinkChange(initial:current:) -> String??` (`nil` when unchanged, `.some(current)` otherwise).
4. Tests: `AssetLinkTests` (direction, change), `BudgetLineTests` (`toggled()` keeps `assetId`, decode with and without the key), `BudgetLineSpreadRequestTests` (`assetId` encoded when set, absent when nil).

### `2)` Picker

> Same chrome as the savings-goal picker.

1. `AssetPickerField(selection:direction:style:)`: a `Menu` with « Aucun » then `AssetStore.activeAssets(direction:)`, label through `savingsGoalMenuLabel(style:title:value:isPlaceholder:)` of `SavingsGoalFieldChrome.swift`; title « Versée sur » (own) or « Dette remboursée » (owe), hint `netWorth.link.oweHint` or none.
2. Rendered only when `FeatureFlagsStore.isNetWorthEnabled` and `kind.assetDirection != nil`; it triggers `assetStore.loadIfNeeded()` in `.task`.

### `3)` Sheets

> Create, edit and template paths send the link; untouched edits never clear it.

1. `AddBudgetLineSheet`: `@State var assetId: String?` reset on kind change (beside `savingsGoalId`, line 170); picker in `detailsCard` of `+Parts`; `+Submit` passes `assetId` on once, every month and spread when the flag is on.
2. `EditBudgetLineSheet`: initial `assetId` from the line, picker under the savings-goal picker, reset on kind change, `data.assetId = assetLinkChange(initial:current:)`.
3. `EditTemplateLineSheet`: same, and `propagationUpdate` copies `data.assetId`.
4. Tests: `EditBudgetLineSheetTests` and `EditTemplateLineSheetTests` assert the untouched, cleared and changed bodies; `AddBudgetLineSpreadLogicTests` asserts the spread input carries `assetId`.

### `4)` Copy

> Wording in the four languages; the link rules are already in `docs/BUSINESS_RULES.md` Patrimoine.

1. `netWorth.link.*` with `de`, `en`, `it`; `pnpm test:lexicon`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `AssetLinkTests`, `BudgetLineTests`, `BudgetLineSpreadRequestTests` pass with a non-zero executed count |
| 2    | The picker offers only compatible active assets and is absent with the flag off |
| 3    | `EditBudgetLineSheetTests`, `EditTemplateLineSheetTests`, `AddBudgetLineSpreadLogicTests` pass, including the flag-off byte-identical bodies; the Test Scope simulator rows pass |
| 4    | `pnpm test:lexicon`, `swiftlint lint --strict` (`EditTemplateLineSheet.swift` under 500, `AddBudgetLineSheet*` under 350 per `BudgetDetailsArchitectureTests`) and the full `PulpeTests` run pass |
