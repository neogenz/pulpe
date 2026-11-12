---
status: done
---

# Instruction: Web : une seule feuille d'élément

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/
├── public/i18n/{fr,en,de,it}.json ✏️
└── src/app/
    ├── core/asset/
    │   ├── asset-category.ts ✅
    │   └── asset-category.spec.ts ✅
    ├── core/api/api-error-localizer.spec.ts ✏️
    ├── ui/currency-input/currency-input.ts ✏️
    ├── ui/currency-input/currency-input.spec.ts ✏️
    └── feature/net-worth/
        ├── components/
        │   ├── asset-form-dialog.ts ✏️
        │   ├── asset-form-dialog.spec.ts ✏️
        │   ├── asset-form-dialog.schema.ts ✏️
        │   ├── asset-form-dialog.schema.spec.ts ✏️
        │   └── asset-value-dialog.ts ❌
        ├── services/
        │   ├── net-worth-dialog.service.ts ✏️
        │   ├── net-worth-store.ts ✏️
        │   └── net-worth-store.spec.ts ✏️
        └── net-worth-page.ts ✏️
docs/BUSINESS_RULES.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `pnpm dev`, demo account, flag `net_worth` on, viewport 390×844 then 1440×900 | Page Mon patrimoine loaded | browser |
| Happy path | « Ajouter », type a name, keep « Ce que j'ai », Type preselected « Comptes », value 1200 with suffix EUR | One element created in EUR in « Comptes » | browser |
| Happy path | Tap a row, change only the value from 25'173 to 25'400 | One snapshot, no `PATCH` | browser |
| Happy path | Tap a row, rename it, keep the value | One `PATCH {name}`, no snapshot | browser |
| Edge case | Switch to « Ce que je dois » | Suggestions become Crédit, Hypothèque, Leasing, Carte de crédit; « Crédit » preselected; overdraft checkbox hidden | browser |
| Edge case | « Autre type… », type « Crypto » | Inline name field, saved as a new Type | browser |
| Edge case | 390px wide, empty value field | Label and placeholder never overlap the currency suffix | browser |
| Edge case | Edit an overdrawn account | Value shows the magnitude and « Solde négatif » is checked | browser |
| Edge case | Open the sheet at 390px and at 1440px | Full screen under `40rem`, no inner scrollbar on desktop | browser |
| Teardown | Delete the created elements | Seed state | browser |

## Wireframe

```txt
┌──────────────────────────────────────────┐
│ (1) Ajouter à mon patrimoine          ✕  │
├──────────────────────────────────────────┤
│ (2) [ Nom                             ]  │
│ (3) ( Ce que j'ai | Ce que je dois )     │
│ (4) [ Type: Comptes                 ▾ ]  │
│     └ Autre type… → [ Nom du type   ]    │
│ (5) [ Valeur actuelle   25 173  CHF ▾ ]  │
│     Dernière valeur : … le 11 nov.       │
│ (6) ☐ Solde négatif (découvert)          │
├──────────────────────────────────────────┤
│ (7)                  Annuler  [Ajouter]  │
└──────────────────────────────────────────┘
```

1. Title: « Ajouter à mon patrimoine » or « Modifier <nom> », with a close icon on handset.
2. Name, required.
3. Direction, disabled in edit.
4. Type select: Types already used by this direction, unused suggestions for it, then « Autre type… », which opens an inline name field.
5. One `pulpe-currency-input`: the currency is its suffix select at creation and a plain suffix in edit. In edit it is prefilled with the current magnitude, and the « Dernière valeur » hint shows only in edit.
6. Overdraft checkbox, only for « Ce que j'ai », prefilled from `latestValue < 0`.
7. One filled action.

## Tasks to do

### `1)` Reproduce the two layout bugs before fixing

> Root cause first, per `feedback_reproduce_visual_bugs_before_theorizing`.

1. At 390px, screenshot the create sheet: placeholder or label over « CHF ».
2. At 1440px, open « Mettre à jour la valeur »: identify the overflowing element (candidates: `mat-checkbox` 48px touch target, `-mt-2` hint, `type=number` spinner) with `scrollHeight` vs `clientHeight` on `mat-dialog-content`.
3. Write the observed cause in the PR body.

### `2)` Resolve a Type by name in `core/asset`

> The page and the reconciliation create a Type the same way.

1. `core/asset/asset-category.ts`: `resolveAssetCategory(api, categories, choice)` returns an id, creating the Type when the choice is a name. It first matches the name, case-insensitively, against every Type the API returns, including the ones no element uses: those are hidden from the select, never deleted, and reused by name.
2. `NetWorthStore.#resolveCategory` delegates to it.
3. Spec: existing name reused, new name created once.

### `3)` Merge the two sheets

> One sheet edits the name, the Type and the value.

1. `AssetFormValue` drops `inPulpe` and adds `isOverdraft`. `buildAssetCreate` sends a signed value, and `buildAssetEdit` returns `{ updates?, category?, value? }` with only the changed parts.
2. Type select per the wireframe: direction-aware suggestion keys `netWorth.starter.*` (own) and the new `netWorth.starterDebt.*` (owe). Default: first suggestion of the direction when no Type of that direction exists, otherwise the most used one.
3. Replace the `mat-select` currency plus `pulpe-currency-input` pair with one `pulpe-currency-input`, using `showCurrencySelector` at creation.
4. `NetWorthStore.saveAsset(id, edit)` runs the `PATCH` then the snapshot, each only when present, inside one `#run`.
5. `NetWorthDialogService`: `openCreate` and `openEdit` open full screen on `Breakpoints.Handset` (same config as `reconcile-accounts-dialog.service.ts`). Delete `openValue` and `asset-value-dialog.ts`.
6. Page: the `updateValue` action routes to `edit`.

### `4)` Fix the shared amount field

> The bugs come from `pulpe-currency-input`, so every amount field benefits.

1. Apply the fix found in task 1 in `currency-input.ts` (hide the number spinner, keep the suffix from shrinking the label), and check the other consumers (`feature/savings-goals/.../goal-plan-simulator-toolbar.ts`, `feature/complete-profile/complete-profile-page.ts`) at 390px. Extend `currency-input.spec.ts`.

### `5)` Copy

> Words that say what the field does.

1. fr, then en, de, it:
   - `netWorth.form.category` → « Type ».
   - Add `netWorth.form.otherType`, `netWorth.form.typeName` and `netWorth.starterDebt.{loan,mortgage,leasing,card}`.
   - Remove `netWorth.form.myCategories`, `newTag`, `newCategoryHint`, `inPulpe`, `inPulpeHint`, `editNote`, `readOnlyHint`, `netWorth.value.{title,subtitleOwn,subtitleOwe,label}` and `netWorth.menu.updateValue`. Keep `netWorth.value.lastValue` and `netWorth.value.overdraft`, which the merged sheet reuses.
   - `apiError.assetCategory{NotFound,NotEmpty,Duplicate}` say « type » instead of « catégorie »; update `api-error-localizer.spec.ts` l.191.
2. `docs/BUSINESS_RULES.md`: replace the stale bullet « Le formulaire de création n'accepte qu'une première valeur positive ou nulle » (the API already accepts a negative first value on an `own`, `assetCreateSchema` spec l.39), and add the debt suggestions. Replace the bullet « Une catégorie est créée par l'utilisateur, renommable et supprimable » : a Type is created with its first element, is renamable, and is hidden while no element uses it.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | The PR names the element that overflowed and the one that overlapped, with before screenshots |
| 2 | `resolveAssetCategory` calls `createCategory$` only for an unknown name |
| 3 | Editing only the value sends one snapshot and no `PATCH`; editing only the name sends one `PATCH` and no snapshot; a debt never offers « Comptes » |
| 4 | At 390px the label, placeholder and suffix never overlap; at 1440px `mat-dialog-content` has `scrollHeight === clientHeight` |
| 5 | `pnpm test:lexicon` passes; no removed key is still referenced (`ng build` green) |
