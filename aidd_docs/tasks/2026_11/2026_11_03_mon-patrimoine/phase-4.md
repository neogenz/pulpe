---
status: done
---

# Instruction: Reconciliation refreshes in-Pulpe assets

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── frontend/
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
                    ├── pattern/
                    │   └── reconcile-accounts/
                    │       ├── reconcile-accounts-dialog.ts ✏️
                    │       ├── reconcile-accounts-dialog.html ✏️
                    │       ├── reconcile-accounts-dialog.spec.ts ✏️
                    │       ├── reconcile-accounts-dialog.service.ts ✅
                    │       └── reconcile-accounts-dialog.service.spec.ts ✅
                    └── feature/
                        ├── current-month/
                        │   └── current-month.ts ✏️
                        └── budget/
                            └── budget-details/
                                └── budget-details-page.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag forced through the `pulpe-dev-feature-flags` override; « Compte UBS » (CHF, Dans Pulpe) and « Livret » (CHF, hors Pulpe) exist; CHF budget | Current month page open | browser |
| Happy path | Open the reconciliation | The dialog opens directly on one row « Compte UBS », amount empty and focused, last value as hint; no row for « Livret » | browser |
| Happy path | Type 12 340, add a free row « Cash » 50, record the adjustment | Reconciliation completes as today; « Mon patrimoine » shows « Compte UBS » at 12 340 updated today; « Cash » creates nothing | browser |
| Happy path | Reconciliation already up to date, finish | Snapshot for « Compte UBS » written the same way | browser |
| Edge case  | Slow assets request | The button waits for it; the dialog never re-renders its rows after opening, so nothing typed is overwritten | browser |
| Edge case  | In-Pulpe asset in EUR on a CHF budget | Not pre-filled | browser |
| Edge case  | Archived or `owe` in-Pulpe asset | Not pre-filled | browser |
| Edge case  | Pre-filled row left empty or deleted | No snapshot for it | browser |
| Edge case  | Snapshot request fails | Dialog closes with its usual result; a toast says the balances were not saved in « Mon patrimoine » | browser |
| Edge case  | Flag off, or assets request fails | One empty row, exactly today's behaviour | browser |
| Edge case  | Dialog closed before the last step | No snapshot written | browser |
| Teardown   | Delete the test snapshots' assets, remove the flag override | Baseline restored | browser |

## Tasks to do

### `1)` Open the dialog with its rows already known

> The linked accounts are resolved before the dialog opens, so its rows are built once.

1. `reconcile-accounts-dialog.service.ts` replaces the free `openReconcileAccountsDialog`, on the model of the existing `*-dialog.service.ts`: `open(data, isHandset)` reads `FEATURE_FLAGS.NET_WORTH`, awaits the cached `AssetApi` read when it is on, keeps active `own` assets with `inPulpe` and `currency === data.currency()` read once, falls back to `[]` on error, then opens the dialog with `linkedAccounts` in its data.
2. `current-month.ts` and `budget-details-page.ts`, the only two callers, inject the service instead of calling the function.
3. Service spec: flag off, filter rules, read failure.

### `2)` Seed rows from the dialog data

> The dialog stays synchronous.

1. `AccountRow` gains `assetId: string | null`.
2. The `accounts` signal starts with one row per linked account (label from the asset, amount empty, last value as hint), or the single empty row when there is none; free rows stay possible.

### `3)` Save typed balances as snapshots

> A completed reconciliation becomes a dated photo of each linked account.

1. In `record()` after success and in `finish()`, collect linked rows whose amount parses through `parseAccountAmount`.
2. Send them in one `AssetApi.recordSnapshots` call; never on dismiss.
3. On failure show a toast, keep the dialog result unchanged.
4. Copy in « je » in the four i18n files; `pnpm test:lexicon`.

### `4)` Lock both paths

> The flag-off path stays identical, the flag-on path is covered.

1. Existing `reconcile-accounts-dialog.spec.ts` cases pass unchanged with empty `linkedAccounts`.
2. New cases: seeded rows, batch content, failure toast, dismiss writes nothing.
3. `cd frontend && pnpm exec ng build`; `account-reconciliation.spec.ts` stays green.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | With the flag on the dialog opens on the in-Pulpe rows of the budget currency, with no second render of the rows; with it off or on error it opens on one empty row |
| 2    | The dialog builds its rows only from its data; no asset read happens inside it |
| 3    | Completing the reconciliation writes one snapshot per filled linked row, and the page « Mon patrimoine » shows the typed values |
| 4    | `reconcile-accounts-dialog.spec.ts`, the service spec and `account-reconciliation.spec.ts` pass; `ng build` passes |
