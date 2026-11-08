---
status: pending
---

# Instruction: Asset form and row actions

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
    │   │       ├── AssetFormDraft.swift ✅
    │   │       └── AssetFormSheet.swift ✅
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── NetWorth/
                └── AssetFormDraftTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Phase 3 setup: local backend, flag forced through the plist, demo account signed in, no asset | Empty state shows « Ajouter un avoir » | simulator |
| Happy path | Empty-state action, name « Compte UBS », Ce que j'ai, CHF, suggestion « Comptes », Dans Pulpe on, value 12 000, Ajouter | Sheet closes; « Comptes » section with « Compte UBS » 12 000 CHF, badge « Dans Pulpe », age « aujourd'hui »; hero equals 12 000 CHF | simulator |
| Happy path | « + », « Leasing », Ce que je dois, CHF, suggestion « Biens », 8 000 | Leasing in « Ce que je dois »; net 4 000 CHF | simulator |
| Happy path | Row menu Modifier on Compte UBS: rename « UBS », move to a new category typed in the form | Row renamed and moved; sens and devise shown read-only | simulator |
| Happy path | Row menu Archiver, then Désarchiver from « Voir les archives » | Row leaves the sections and totals, then comes back | simulator |
| Happy path | Row menu Supprimer, confirm | Row gone; a refetch shows the new totals | simulator |
| Edge case  | Empty name, or no category | Ajouter disabled, « Donne-lui un nom » under the name | cli |
| Edge case  | A suggestion already used by a category (any case) | Not offered as a suggestion | cli |
| Edge case  | Create with a negative value | Impossible: the create form takes a value ≥ 0 only (`docs/BUSINESS_RULES.md` Patrimoine); an overdraft is entered later through « Mettre à jour la valeur » (phase 5) | cli |
| Edge case  | Server refuses the write (`ERR_ASSET_CATEGORY_DUPLICATE`) | The sheet stays open with the French message; the list is refetched | simulator |
| Edge case  | Double tap on Ajouter | One `POST /v1/assets` in the backend log | simulator |
| Teardown   | Delete the test assets, remove the plist key | Baseline restored | simulator |

## Wireframe

```txt
┌──────────────────────────────────────┐
│ (1) Annuler  Ajouter à mon patrimoine │
├──────────────────────────────────────┤
│ (2)        12 000 CHF                 │
├──────────────────────────────────────┤
│ (3) Nom          Compte UBS           │
│ (4) Sens   [Ce que j'ai|Ce que je dois]│
│ (5) Devise       CHF ▾                │
│ (6) Catégorie    Comptes ▾  [Nouvelle]│
│ (7) Dans Pulpe   (on)                 │
│     Pour le compte que tu pointes...  │
├──────────────────────────────────────┤
│ (8)          [ Ajouter ]              │
└──────────────────────────────────────┘
```

1. Sheet title: « Ajouter à mon patrimoine » on create, « Modifier <nom> » on edit.
2. `HeroAmountField`, value ≥ 0, shown on create only; the edit form shows the edit note instead.
3. Name field, required.
4. `SegmentedPicker` on the direction; read-only on edit with the read-only hint.
5. `CurrencyAmountPicker`, `isReadOnly` on edit.
6. Category `Menu`: « Mes catégories », then « Suggestions » (starter names not yet used), then a free name field; a starter or typed name shows the « Nouvelle » chip and the new-category hint.
7. In-Pulpe toggle with its hint, own assets only.
8. Primary action, disabled while invalid or saving.

## Tasks to do

### `1)` Form logic out of the view

> Validation, suggestions and payload are pure and tested.

1. `AssetFormDraft` (value type): name, direction, currency, category choice, inPulpe, amount; `init(asset:)` for edit; `isValid`; `nameError`; `starterSuggestions(existing:)` (the six starter names, case-insensitive minus existing names); `createPayload(categoryId:)` with a value ≥ 0 (a client rule of `docs/BUSINESS_RULES.md` Patrimoine; the API itself accepts a negative `own`, `asset.invariants.ts:11` only guards `owe`); `updatePayload(original:categoryId:)` sends only changed keys.
2. `AssetFormDraftTests` per the Test Scope cli rows.

### `2)` Asset form sheet

> One sheet for create and edit, on the V2 form grammar.

1. `AssetFormSheet` in `SheetFormContainer` and `FormCard`, `.standardSheetPresentation()`, fields per the wireframe, tokens only.
2. Save calls `AssetStore.create(_:category:)` or `update(id:_:category:)` with `AssetCategoryChoice`; while `isSaving` the button is disabled; an `APIError` shows its `localizedDescription` in the sheet and keeps it open; success dismisses.
3. Copy from `netWorth.form.*` and `netWorth.starter.*` with `de`, `en`, `it`.

### `3)` Row actions and add entry points

> Every row can be edited, archived or deleted from the screen.

1. `NetWorthAssetRow`: trailing `Menu` « Actions pour <nom> » with Modifier, Archiver or Désarchiver, Supprimer (`role: .destructive`).
2. `NetWorthView`: toolbar « Ajouter » (`plus`) only when at least one asset exists, so the empty state keeps a single action; empty-state action « Ajouter un avoir » (spec wording, a new key), `.sheet(item:)` for create and edit, `.confirmationDialog` « Supprimer <nom> ? » with the web delete message; archive and delete go through `AssetStore`, failures through `ToastManager.show(_:type:)` with the `APIError` message.
3. Copy from `netWorth.menu.*`, `deleteTitle`, `deleteMessage`, `addButton`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `AssetFormDraftTests` pass with a non-zero executed count |
| 2    | The Test Scope create and edit rows pass on the simulator; a server error keeps the sheet open with its French message |
| 3    | Archive, unarchive and delete behave per the Test Scope; `pnpm test:lexicon`, `xcodegen generate --use-cache`, `swiftlint lint --strict` and `xcodebuild build -scheme PulpeLocal -configuration Local` pass |
