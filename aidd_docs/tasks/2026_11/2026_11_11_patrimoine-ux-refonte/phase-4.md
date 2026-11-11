---
status: pending
---

# Instruction: iOS : une seule feuille, groupes par Type

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/
├── Pulpe/
│   ├── Resources/Localizable.xcstrings ✏️
│   ├── Domain/Store/AssetStore.swift ✏️
│   └── Features/NetWorth/
│       ├── AssetFormSheet.swift ✏️
│       ├── AssetFormDraft.swift ✏️
│       ├── AssetValueSheet.swift ❌
│       ├── AssetCategoriesSheet.swift ❌
│       ├── AssetCategoriesLogic.swift ❌
│       ├── RenameAssetTypeSheet.swift ✅
│       ├── NetWorthAssetRow.swift ✏️
│       ├── NetWorthSections.swift ✏️
│       └── NetWorthView.swift ✏️
└── PulpeTests/
    ├── Features/NetWorth/AssetFormDraftTests.swift ✏️
    ├── Features/NetWorth/AssetValueSheetTests.swift ❌
    ├── Features/NetWorth/AssetCategoriesLogicTests.swift ❌
    ├── Features/NetWorth/NetWorthSectionsTests.swift ✏️
    └── Domain/Store/AssetStoreTests.swift ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Dedicated test simulator, `-configuration Local`, flag `net_worth` on, demo account | Patrimoine tab loaded | system |
| Happy path | Tap a row, change only the value | One snapshot, no `PATCH`; sheet closes | system |
| Happy path | Tap an overdrawn account | Value shows its magnitude, « Solde négatif » on | system |
| Happy path | ⋮ on a Type header, own or debt → « Renommer le type » | Name updated | system |
| Edge case | « Ce que je dois » in the create sheet | Debt suggestions only, first one preselected, no overdraft toggle | system |
| Edge case | Untouched edit | Sheet closes, no request | system |
| Teardown | Delete created elements | Seed state | system |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) Modifier BCGE            ✕   │
├──────────────────────────────────┤
│ (2) 229 016,00 CHF   (hero)      │
│     Dernière valeur : … le …     │
│ (3) ☐ Solde négatif (découvert)  │
│ (4) Nom  [ BCGE              ]   │
│ (5) Sens ( J'ai | Je dois )      │
│ (6) Type          Comptes   ›    │
│     └ Autre type… → [ … ]        │
├──────────────────────────────────┤
│ (7)          [ Enregistrer ]     │
└──────────────────────────────────┘
```

1. Title « Ajouter à mon patrimoine » or « Modifier <nom> ».
2. `HeroAmountField`, prefilled with the magnitude in edit, with its currency picker at creation only.
3. Overdraft toggle for « Ce que j'ai », prefilled from `latestValue < 0` (fixes `AssetValueSheet` starting at `false`).
4. Name.
5. Direction, frozen in edit.
6. Type menu, direction-aware suggestions and « Autre type… ».
7. Save.

## Tasks to do

### `1)` Merge the value into the form

> One sheet, the same contract as web phase 1.

1. `AssetFormDraft`: add `isOverdraft` and the edit amount. `submission(original:)` returns `PATCH` and/or snapshot only for what changed, or `.close`. Drop `inPulpe`.
2. `AssetFormSheet`: value block in both modes, per the wireframe; remove `inPulpeBlock` and the « passe par Mettre à jour la valeur » note.
3. Delete `AssetValueSheet.swift`; `NetWorthView` loses `valueTarget`.

### `2)` Type instead of Catégorie

> Same words and suggestions as web.

1. Starter lists by direction in `AssetFormDraft`; the menu lists the Types used by that direction, then the suggestions, then « Autre type… ».
2. Delete `AssetCategoriesSheet`, `AssetCategoriesLogic` and the « Gérer les catégories » `ContextLinkRow`.
3. `RenameAssetTypeSheet` opened from a Type header menu in `NetWorthSections`, which groups debts by Type the way it groups own elements.
4. `Localizable.xcstrings` (fr, en, de, it): « Type », « Autre type… », « Renommer le type », the debt suggestions, « Mis à jour au rapprochement »; remove « Gérer les catégories », « Mes catégories », « Dans Pulpe » and the other obsolete keys; reword the three category API errors (« Une catégorie porte déjà ce nom »…) with « type ».

### `3)` Row gestures

> Tap edits, ⋮ holds every action.

1. `NetWorthAssetRow`: the whole row is a button opening `form = .edit(asset)`; the menu keeps Modifier, Archiver/Désarchiver and Supprimer and loses « Mettre à jour la valeur »; the « Dans Pulpe » badge becomes « Mis à jour au rapprochement ».

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `AssetFormDraftTests`: value-only edit → snapshot only; name-only → `PATCH` only; untouched → `.close`; overdrawn asset starts with the toggle on |
| 2 | `AssetFormDraftTests`: a debt never offers « Comptes »; no net-worth string in `Localizable.xcstrings` or `Features/NetWorth` says « catégorie », API errors included |
| 3 | Tapping a row and the menu « Modifier » open the same edit sheet; the row menu has no value entry; `xcodebuild` green with SwiftLint strict |
