---
status: pending
---

# Instruction: Value and categories sheets

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete. Files created by an earlier phase of this plan are marked `modify (phase n)`.

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Features/
    │   │   └── NetWorth/
    │   │       ├── NetWorthView.swift modify (phase 3)
    │   │       ├── NetWorthAssetRow.swift modify (phase 3)
    │   │       ├── AssetValueSheet.swift ✅
    │   │       ├── AssetCategoriesSheet.swift ✅
    │   │       └── AssetCategoriesLogic.swift ✅
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── NetWorth/
                ├── AssetValueSheetTests.swift ✅
                └── AssetCategoriesLogicTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Phase 4 state: « UBS » 12 000 CHF in « Comptes », « Leasing » 8 000 CHF in « Biens » | Both rows listed | simulator |
| Happy path | UBS row menu « Mettre à jour la valeur », 12 500, Enregistrer | One `POST /v1/assets/snapshots`; row 12 500 CHF, « mis à jour aujourd'hui »; hero moves | simulator |
| Happy path | Toolbar « Catégories »: rename « Comptes » to « Banques », add « Crypto », delete « Crypto » | Section header renamed; « Crypto » created then gone | simulator |
| Edge case  | Delete « Banques » while UBS is in it | Refused; message « Déplace d'abord UBS vers une autre catégorie. »; the category stays | simulator |
| Edge case  | Own asset, overdraft toggle on, 300 | Snapshot value -300; the row moves to « Ce que je dois » with « Découvert » | cli |
| Edge case  | Debt asset | No overdraft toggle; a debt never sends a negative value | cli |
| Edge case  | Rename to a name already used | `ERR_ASSET_CATEGORY_DUPLICATE` French message; the old name stays | simulator |
| Teardown   | Delete the test assets, remove the plist key | Baseline restored | simulator |

## Wireframe

```txt
┌──────────────────────────────────────┐
│ (1) Mettre à jour la valeur           │
│     UBS · ce que j'ai aujourd'hui     │
├──────────────────────────────────────┤
│ (2)          12 500 CHF               │
│     Dernière valeur : 12 000, le 3.11 │
│ (3) [ ] Solde négatif (découvert)     │
│ (4)        [ Enregistrer ]            │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ (5) Mes catégories                    │
│ (6) Banques      Renommer · Supprimer│
│     Biens        Renommer · Supprimer│
│ (7) Nouvelle catégorie [Ex. Crypto] + │
└──────────────────────────────────────┘
```

1. Value sheet title and subtitle by direction.
2. `HeroAmountField` in the asset currency, last value and date as its hint.
3. Overdraft toggle, own assets only.
4. Primary action, disabled while empty or saving.
5. Categories sheet title and description.
6. One row per category with rename (inline field) and delete actions.
7. Create field, « Ajouter » disabled while blank.

## Tasks to do

### `1)` Value sheet

> One dated snapshot per update.

1. `AssetValueSheet(asset:)`: `HeroAmountField` with `currency: asset.currency`, hint from `netWorth.value.lastValue` through `asCurrency(asset.currency)` and the date in the app locale, overdraft toggle for `own` only; save calls `AssetStore.recordSnapshots([AssetSnapshotItem(assetId:, value:)])`, error shown in the sheet.
2. A `static func snapshotValue(amount:isNegative:direction:) -> Decimal` on the sheet, tested in `AssetValueSheetTests`.
3. `NetWorthAssetRow` menu gains « Mettre à jour la valeur » first; `NetWorthView` presents the sheet.

### `2)` Categories sheet

> Categories are renamed, created and deleted in one place.

1. `AssetCategoriesLogic`: `blockingAssetNames(categoryId:in:)` (active and archived assets of the category, from the store) and `notEmptyMessage(names:)` formatted with `ListFormatter` in the app locale.
2. `AssetCategoriesSheet`: list from `AssetStore.categories`, inline rename, create, delete; on `APIError.assetCategoryNotEmpty` show `notEmptyMessage`, other errors show their own message; empty list shows `categoriesDialog.empty`.
3. Toolbar « Catégories » in `NetWorthView` when at least one category exists.
4. `AssetCategoriesLogicTests`: blocking names, message with one and two names.
5. Copy from `netWorth.value.*` and `netWorth.categoriesDialog.*` with `de`, `en`, `it`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `AssetValueSheetTests` pass; the Test Scope value row passes on the simulator |
| 2    | `AssetCategoriesLogicTests` pass; deleting a non-empty category is refused with the asset names and the category stays |
| 2    | `pnpm test:lexicon`, `xcodegen generate --use-cache`, `swiftlint lint --strict` and `xcodebuild test ... -only-testing:PulpeTests/AssetValueSheetTests -only-testing:PulpeTests/AssetCategoriesLogicTests` (non-zero executed count) pass |
