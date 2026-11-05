---
status: done
---

# Instruction: « Mon patrimoine » page

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── pnpm-lock.yaml ✏️
├── shared/
│   └── src/
│       └── feature-flags.ts ✏️
├── docs/
│   └── BUSINESS_RULES.md ✏️
└── frontend/
    ├── package.json ✏️
    ├── e2e/
    │   └── tests/
    │       └── features/
    │           └── net-worth.spec.ts ✅
    └── projects/
        └── webapp/
            ├── public/
            │   └── i18n/
            │       ├── fr.json ✏️
            │       ├── en.json ✏️
            │       ├── de.json ✏️
            │       └── it.json ✏️
            └── src/
                └── app/
                    ├── app.routes.ts ✏️
                    ├── core/
                    │   ├── asset/
                    │   │   ├── asset-api.ts ✅
                    │   │   └── asset-api.spec.ts ✅
                    │   ├── auth/
                    │   │   ├── auth-cleanup.service.ts ✏️
                    │   │   └── auth-cleanup.service.spec.ts ✏️
                    │   └── routing/
                    │       └── routes-constants.ts ✏️
                    ├── layout/
                    │   ├── main-layout.ts ✏️
                    │   └── main-layout.spec.ts ✏️
                    └── feature/
                        └── net-worth/
                            ├── net-worth.routes.ts ✅
                            ├── net-worth-page.ts ✅
                            ├── net-worth-page.spec.ts ✅
                            ├── services/
                            │   ├── net-worth-store.ts ✅
                            │   ├── net-worth-store.spec.ts ✅
                            │   └── net-worth-dialog.service.ts ✅
                            └── components/
                                ├── net-worth-sankey.ts ✅
                                ├── net-worth-sankey.flows.ts ✅
                                ├── net-worth-sankey.flows.spec.ts ✅
                                ├── asset-form-dialog.ts ✅
                                ├── asset-form-dialog.schema.ts ✅
                                ├── asset-form-dialog.spec.ts ✅
                                ├── asset-value-dialog.ts ✅
                                └── asset-categories-dialog.ts ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Backend from phase 2 running, `pnpm dev:frontend`, signed in with the seed demo account, flag forced with `localStorage.setItem('pulpe-dev-feature-flags','{"version":1,"data":{"net_worth":true},"updatedAt":""}')` then reload | Nav shows « Mon patrimoine »; `/net-worth` loads | browser |
| Happy path | Add « Compte UBS » 12 000 CHF, picking the suggested « Comptes »; add « Livret » 3 000 EUR in suggested « Épargne »; add « Leasing » 8 000 CHF as a debt | « Comptes » and « Épargne » now exist; totals show gross, debts and net in CHF from the API; the Sankey draws assets → categories → Fortune brute → Leasing and Fortune nette | browser |
| Happy path | Update the value of « Compte UBS » | Row, totals and Sankey refresh; « Mis à jour aujourd'hui » | browser |
| Happy path | Rename a category, create one, delete an empty one | Sections follow | browser |
| Edge case  | Delete every category | None comes back on reload; the starter names are offered again only as suggestions in the category field | browser |
| Edge case  | Delete a category that still holds an asset | Error message asks to move its assets first; category kept | browser |
| Edge case  | No asset at all | Empty state with one « Ajouter un avoir » action, no Sankey | browser |
| Edge case  | Debts above gross | Net shows negative in the totals; the Sankey has no « Fortune nette » node, debts keep their real size and a « Il manque » node under the main flow carries the shortfall | browser |
| Edge case  | « Compte UBS » at -300 CHF (overdraft) | No flow into « Comptes »; a flow Fortune brute → « Compte UBS » of 300 on the debts side | browser |
| Edge case  | `incomplete: true` from the API | Foreign row shows its own currency only; a notice says the total leaves it out | browser |
| Edge case  | Archive an asset | It leaves the list, totals and Sankey; it shows under « Voir les avoirs archivés » | browser |
| Edge case  | Log out, log in with another account | No asset of the first account is shown, even briefly | browser |
| Edge case  | Flag override removed | No nav entry; `/net-worth` still opens by URL | browser |
| Edge case  | Mobile width 375 | Totals stack, Sankey scrolls horizontally inside its card, no page scroll | browser |
| Teardown   | Delete the created assets and categories, remove the flag override | Baseline restored | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────┐
│ (1) Title « Mon patrimoine »   [Ajouter un avoir] [Catégories]│
├──────────────────────────────────────────────────────────────┤
│ (2) Fortune nette  ·  Fortune brute  ·  Dettes  · taux du jour│
├──────────────────────────────────────────────────────────────┤
│ (3) Sankey                                                    │
│   UBS ──┐                                                     │
│         ├─ Comptes ─┐                  ┌─ Leasing             │
│ Livret ─┴─ Épargne ─┴── Fortune brute ─┤                      │
│                                        └─ Fortune nette       │
├──────────────────────────────────────────────────────────────┤
│ (4) Comptes                                      subtotal     │
│   ┌──────────────────────────────────────────────────────┐   │
│   │ (5) Compte UBS · Dans Pulpe   12 000 CHF · aujourd'hui │ ⋮ │
│   └──────────────────────────────────────────────────────┘   │
│ (4) Épargne                                      subtotal     │
│   │ (5) Livret          3 000 EUR ≈ 2 820 CHF · il y a 3 j │ ⋮ │
├──────────────────────────────────────────────────────────────┤
│ (6) Ce que je dois                                subtotal    │
│   │ (5) Leasing                    8 000 CHF · aujourd'hui │ ⋮ │
├──────────────────────────────────────────────────────────────┤
│ (7) Voir les avoirs archivés                                  │
└──────────────────────────────────────────────────────────────┘
```

1. Header: page title, add an asset or a debt, manage categories.
2. Totals: net as the hero figure, gross and debts beside it, a note that foreign values use today's rate; the incomplete notice sits here.
3. Sankey: today's breakdown, flows from each asset to its category, to gross, then to each debt and overdraft and to net.
4. Category section: one per category that holds a positive `own` asset, with the `total` the API returns.
5. Asset row: name, « Dans Pulpe » badge, value in its currency with the converted value when foreign, age of the last snapshot, menu (mettre à jour la valeur, modifier, archiver, supprimer).
6. Debts section: every `owe` asset whatever its category, and every overdrawn `own` asset, with the API `debts` figure.
7. Archived toggle: reveals archived assets with their last value, outside the totals.

## Tasks to do

### `1)` Rollout flag and Sankey dependency

> The feature ships dark and the chart library is available to its chunk only.

1. `FEATURE_FLAGS.NET_WORTH = 'net_worth'` in `shared/src/feature-flags.ts`.
2. Add `chartjs-chart-sankey@0.19.1` to `frontend/package.json`; `pnpm install` updates `pnpm-lock.yaml`.

### `2)` Asset API in core

> One cached client for every web consumer of assets, emptied at logout.

1. `core/asset/asset-api.ts` as `@Service()` with a `DataCache({ name: 'assets' })` and a `clearCache()`, on the model of `core/savings-goal/savings-goal-api.ts`; `getNetWorth`, asset create/update/delete, `recordSnapshots`, category create/update/delete, responses parsed with the shared schemas.
2. `auth-cleanup.service.ts` clears the `assets` cache beside the other domain caches; its spec asserts it.
3. `asset-api.spec.ts` for parsing and invalidation.

### `3)` Store and dialogs

> Page state and the three edit dialogs, displaying the figures the API computed.

1. `net-worth-store.ts` with `cachedResource` and `cachedMutation` invalidating `['assets']`; it groups assets under their category and the debts section without computing any amount.
2. `asset-form-dialog.ts` and its schema: name, category, currency (CHF or EUR), « Ce que j'ai » or « Ce que je dois », « Dans Pulpe », first value on create; currency and direction read-only on edit.
3. The category field lists existing categories, then the translated starter names (comptes, épargne, placements, cash, objets de valeur, biens) not yet used; saving with a starter name creates the category first, then the asset. `asset-form-dialog.spec.ts` covers both paths.
4. `asset-value-dialog.ts`: one amount field through the existing amount input pattern; the sign rule of phase 2 on the client.
5. `asset-categories-dialog.ts`: list, rename, create, delete with the not-empty error surfaced.
6. `net-worth-dialog.service.ts` opens them, handset-aware like `savings-goals-dialog.service.ts`.

### `4)` Sankey

> Today's breakdown drawn from the API figures.

1. `net-worth-sankey.flows.ts`: pure mapping from assets, category totals and totals to `{ from, to, flow }[]`; positive `own` assets flow into their category, overdrawn `own` and `owe` assets leave Fortune brute on the debts side; no net node when net ≤ 0; when debts exceed gross, a « Il manque » node under the main flow feeds the shortfall so debts keep their real size; the category column is skipped when every category holds a single asset. Widths only, no money computed.
2. `net-worth-sankey.ts` registers `SankeyController` and `Flow` in its own module so the base chunk stays lean; colours from the theme tokens of `core/chart/chart-theme.ts`; labels through `AppCurrencyPipe` `1.0-0`.
3. Flows spec covers the edge cases above.

### `5)` Page, route and nav

> Reach the page from the nav when the flag is on.

1. `net-worth-page.ts` per the wireframe; values `1.2-2` on rows, `1.0-0` on totals.
2. `net-worth.routes.ts` with route providers; `ROUTES.NET_WORTH = 'net-worth'` and its page title in `routes-constants.ts`; the route in `app.routes.ts` behind `hasBudgetGuard` like savings goals.
3. Nav entry after « Objectifs d'épargne » in `main-layout.ts`, shown only when `PostHogService.isFeatureEnabled(FEATURE_FLAGS.NET_WORTH)` holds, read in a `computed()` with `flagsVersion()`; spec both states.
4. French copy in « je » in `fr.json`, the same keys in `en.json`, `de.json`, `it.json`, starter names included; `pnpm test:lexicon`.

### `6)` Document and cover end to end

> Rules written down, the main journey locked.

1. Patrimoine section in `docs/BUSINESS_RULES.md`: snapshot model, direction, overdraft, today's-rate exception, starter suggestions, archived and category rules.
2. `net-worth.spec.ts` with `page.route` mocks of `/api/v1/assets`, as in `account-reconciliation.spec.ts`, and the flag override set before navigation: empty state, then a populated page with totals and Sankey canvas.
3. `cd frontend && pnpm exec ng build` passes.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `FEATURE_FLAGS.NET_WORTH` resolves to `net_worth`; the main chunk size does not grow by the Sankey plugin |
| 2    | `asset-api.spec.ts` passes; a mutation invalidates the `assets` cache; `auth-cleanup.service.spec.ts` asserts the `assets` cache is cleared at logout |
| 3    | Creating, editing, archiving and valuing an asset refresh the page without reload; picking a starter name creates its category once; no amount is computed in the store |
| 4    | The flows spec passes, overdraft included; the Sankey renders the demo journey of the Test Scope |
| 5    | With the flag on the nav shows « Mon patrimoine » after « Objectifs d'épargne »; with it off the entry is absent; `main-layout.spec.ts` passes |
| 6    | `net-worth.spec.ts` passes; `ng build` and `pnpm test:lexicon` pass |
