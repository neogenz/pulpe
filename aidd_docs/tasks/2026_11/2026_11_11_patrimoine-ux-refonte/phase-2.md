---
status: done
---

# Instruction: Web : page, groupes et Sankey

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/
├── e2e/tests/features/net-worth.spec.ts ✏️
└── projects/webapp/
    ├── public/i18n/{fr,en,de,it}.json ✏️
    └── src/app/feature/net-worth/
        ├── net-worth-page.ts ✏️
        ├── net-worth-page.spec.ts ✏️
        ├── components/
        │   ├── net-worth-section.ts ✏️
        │   ├── net-worth-asset-row.ts ✏️
        │   ├── net-worth-asset-row.spec.ts ✏️
        │   ├── net-worth-fx-notes.ts ✏️
        │   ├── net-worth-sankey.ts ✏️
        │   ├── net-worth-sankey.flows.ts ✏️
        │   ├── net-worth-sankey.flows.spec.ts ✏️
        │   ├── asset-categories-dialog.ts ❌
        │   └── asset-categories-dialog.spec.ts ❌
        └── services/
            ├── net-worth-dialog.service.ts ✏️
            └── rename-type-dialog.ts ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Demo account with 3 Types, 25 elements, 2 debts, 1 overdraft, 1 EUR element | Page loaded | browser |
| Happy path | Read the page at 1440px and 390px | One full-width column: hero, pills, FX note, Répartition, « Ce que j'ai » with one tonal card per Type, « Ce que je dois » with one tonal card per Type, Archives | browser |
| Happy path | Tap a row | The phase 1 sheet opens in edit | browser |
| Happy path | ⋮ on a Type header, own or debt → « Renommer le type » | Small dialog, the name is updated in the header and in the Sankey | browser |
| Edge case | 25 elements in 3 Types | Sankey shows 3 Type nodes, no overlapping label | browser |
| Edge case | One Type and no debt | No Sankey card | browser |
| Edge case | Dark theme | Every Sankey label ≥ 4.5:1 against what is behind it, every node ≥ 3:1 against the card | browser |
| Edge case | Two EUR elements | « Taux du jour pour Cash EUR et BPA : 1 EUR = 0.9203 CHF », no agreement to get wrong | browser |
| Teardown | none | Read-only scenarios | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────┐
│ (1) Mon patrimoine                       [+ Ajouter] │
├──────────────────────────────────────────────────────┤
│ (2) Hero : Ma fortune nette · 310 752 CHF            │
│ (3) ( Ce que j'ai 310 752 ) ( Ce que je dois 0 )     │
│     FX : Taux du jour pour … : 1 EUR = 0.92 CHF      │
├──────────────────────────────────────────────────────┤
│ (4) Répartition aujourd'hui                          │
│     Types ═══> Ce que j'ai ═══> Dettes / Fortune     │
├──────────────────────────────────────────────────────┤
│ (5) Ce que j'ai                                      │
│     ┌ Comptes ············ 240 952 CHF   ⋮ ┐         │
│     │ BCGE · Mis à jour au rapprochement  229 016   ⋮ │   │
│     │ Revolut                          6 789   ⋮ │   │
│     └────────────────────────────────────────────┘   │
│     ┌ Objets de valeur ···· 20 521 CHF    ⋮ ┐        │
│     └────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────┤
│ (6) Ce que je dois                                   │
│     ┌ Crédit ············· 12 000 CHF    ⋮ ┐         │
│     │ Leasing auto                 12 000   ⋮ │      │
│     └──────────────────────────────────────┘         │
│ (7) Voir les archives (2)                            │
└──────────────────────────────────────────────────────┘
```

1. Header with one filled action (One Primary Action Rule); the « Catégories » button is gone.
2. Hero, unchanged.
3. Pills and the reworded FX note.
4. Sankey by Type, hidden when nothing splits.
5. Under the heading « Ce que j'ai », one tonal card (`bg-surface-container-low`, `rounded-2xl`, no border, the surface the reconciliation rows already use) per Type: the header carries the subtotal and a ⋮ menu with « Renommer le type ». Tapping a row opens the edit sheet. Its ⋮ offers Modifier, Archiver and Supprimer, like every other row menu in the product.
6. « Ce que je dois » is built exactly like « Ce que j'ai »: a heading, then one card per debt Type with the same header menu. An overdrawn account stays in its own Type card with its overdraft chip.
7. Archives toggle.

## Tasks to do

### `1)` Single-column layout

> No half-empty grid.

1. Replace the `lg:grid-cols-3` block with one column, `gap-6`, the same width as the hero.
2. Remove the « Catégories » button, `openCategories` and `asset-categories-dialog.*`, and the keys `netWorth.categoriesButton`, `netWorth.categoriesDialog.*` and `netWorth.inPulpe` in the four catalogs. `netWorth.menu.edit` stays.

### `2)` Groups as M3 list cards

> Each Type reads as one list with its own actions.

1. `net-worth-section.ts`: tonal surface, header with a ⋮ (`renamable` input, on for own and debt Types, off for Archives). The page groups debts by Type the way it groups own elements. In a row, the edit button and the ⋮ button are siblings, never nested.
2. `rename-type-dialog.ts`: one field, max 30 chars, opened from the header menu, calls `renameCategory`. Add the keys `netWorth.type.{menu,rename,nameLabel}` and `netWorth.sankey.overdrafts` (« Découverts ») in fr, en, de and it.
3. `net-worth-asset-row.ts`: the row click emits `edit`. The menu holds Modifier, Archiver / Désarchiver and Supprimer; only « Mettre à jour la valeur » leaves it. The `inPulpe` chip becomes « Mis à jour au rapprochement » (`netWorth.linkedBadge`).

### `3)` Sankey by Type

> At most one node per Type and per debt Type.

1. `buildNetWorthSankey`: drop the asset column. Category totals flow into gross, gross flows to debts grouped by Type (overdrafts under « Découverts ») and to net. Return no flows when there is one Type and no debt.
2. Rewrite `net-worth-sankey.flows.spec.ts` (30 elements → ≤ 10 left nodes; single Type without debt → empty).

### `4)` Sankey contrast in both themes

> Measured, not assumed.

1. In the browser, both themes, compute the ratio of `--mat-sys-on-surface` against the band colour at `alpha 0.3` composited on `surface-container-low`, and of each node colour against the card.
2. Switch the colours to `--pulpe-financial-savings` / `--pulpe-amber` (Semantic Color Rule; `--pulpe-financial-savings` is `--mat-sys-primary` in light and `--mat-sys-on-primary-container` in dark, `_financial-colors.scss` l.69/106, so only dark changes). Pick band alpha and label placement (labels outside the bands) so that every ratio passes. Record the measured ratios in the PR.

### `5)` FX note without agreement

> No participle to agree with a list.

1. `netWorth.fxNote` → « Taux du jour pour <éléments> : 1 <devise> = <taux> <base> » in fr, with the matching en, de and it wording.

### `6)` E2E

> Lock the new page.

1. `net-worth.spec.ts`: give the mocked `/api/v1/assets` fixture a second own Type, assert that a row click opens `asset-form-dialog` and that the Sankey is present.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | At 1440px with no debt, no empty column; the « Catégories » button is absent |
| 2 | A row click and the menu « Modifier » open the same edit sheet; a header ⋮ renames an own Type and a debt Type; a row menu holds Modifier, Archiver/Désarchiver and Supprimer; no button is nested in a button |
| 3 | With 25 elements in 3 Types, the left column has 3 nodes; one Type and no debt renders no Sankey |
| 4 | Ratios measured in light and dark: labels ≥ 4.5:1, nodes ≥ 3:1, written in the PR |
| 5 | Two foreign elements render a grammatical sentence in fr, en, de and it |
| 6 | `pnpm test:e2e` net-worth spec green |
