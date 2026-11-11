---
status: pending
---

# Instruction: Web : lien au patrimoine depuis le rapprochement

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/
├── public/i18n/{fr,en,de,it}.json ✏️
├── src/app/feature/current-month/current-month.spec.ts ✏️
├── src/app/feature/budget/budget-details/budget-details-page.spec.ts ✏️
└── src/app/pattern/reconcile-accounts/
    ├── reconcile-accounts-dialog.ts ✏️
    ├── reconcile-accounts-dialog.html ✏️
    ├── reconcile-accounts-dialog.spec.ts ✏️
    ├── reconcile-accounts-dialog.service.ts ✏️
    ├── reconcile-accounts-dialog.service.spec.ts ✏️
    ├── reconcile-account-links.ts ✅
    └── reconcile-account-links.spec.ts ✅
docs/BUSINESS_RULES.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Flag on, CHF budget, own CHF accounts « BCGE » (followed), « Revolut » (not followed), one EUR account | Reconciliation opens on « Comptes », one row prefilled with BCGE | browser |
| Happy path | Type 229 016 on the BCGE row, finish | One snapshot for BCGE, no `PATCH` | browser |
| Happy path | Add a row, pick « Revolut », type 6 789, finish | `PATCH Revolut {inPulpe:true}` + snapshot; the next opening prefills Revolut | browser |
| Happy path | Add a row, keep « Autre compte… », name « Neon », 300, tick « Ajouter à Mon patrimoine », finish | `POST /v1/assets` in Type « Comptes » with value 300 and `inPulpe: true`, no extra snapshot | browser |
| Happy path | Add a row, keep « Autre compte… », 50, box unticked, finish | Counted in the total, no request for it | browser |
| Edge case | Remove the prefilled BCGE row, finish | `PATCH BCGE {inPulpe:false}`, no snapshot; BCGE is offered again in the select next time | browser |
| Edge case | Two rows | The second select no longer offers the account picked by the first | browser |
| Edge case | Tick « Ajouter à Mon patrimoine » with an empty name | The name field is required, the step cannot be finished | browser |
| Edge case | Cancel or close the reconciliation | No write at all | browser |
| Edge case | Flag `net_worth` off | No select, no checkbox, no asset request (existing e2e unchanged) | browser |
| Edge case | Flag on, no own CHF account | No select; name, balance and the checkbox | browser |
| Edge case | EUR account | Never offered in a CHF reconciliation | browser |
| Teardown | Delete « Neon », stop following Revolut | Seed state | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────┐
│ Combien as-tu sur tes comptes ?              │
├──────────────────────────────────────────────┤
│ (1) [ Compte : BCGE                 ▾ ]  ✕   │
│ (2) [ Solde                229 016 CHF ]     │
│     Dernier solde : 229 016, il y a 1 mois   │
├──────────────────────────────────────────────┤
│ (1) [ Compte : Autre compte…        ▾ ]  ✕   │
│ (3) [ Nom du compte (facultatif)      ]      │
│ (2) [ Solde                    300 CHF ]     │
│ (4) ☐ Ajouter à Mon patrimoine               │
├──────────────────────────────────────────────┤
│ (5) + Ajouter un compte                      │
│ (6) 🔒 Je garde le solde de tes comptes de   │
│        Mon patrimoine. Les autres lignes     │
│        restent privées.                      │
└──────────────────────────────────────────────┘
```

1. Account select, the same pattern as the Type select of the element sheet: my own active accounts in the budget currency not picked by another row, then « Autre compte… ». A new row starts on « Autre compte… ». Hidden when the flag is off or when I have no such account.
2. The existing balance field, with the last-balance hint for an account of Mon patrimoine.
3. The existing free name field, shown only for « Autre compte… ». Required once (4) is ticked.
4. « Ajouter à Mon patrimoine », unticked by default, only on an « Autre compte… » row and only with the flag on.
5. Existing add-row action.
6. The global note, with no « Dans Pulpe » and no « rapproché ».

## Tasks to do

### `1)` Give the dialog every candidate account

> The select needs the whole list, not only the followed ones.

1. The service passes `ownAccounts` (active, own, budget currency) plus the followed subset that prefills rows; `lastBalances` covers `ownAccounts`.
2. Service spec: the currency filter and the flag-off path stay. Re-check `current-month.spec.ts` and `budget-details-page.spec.ts`, which read `ReconcileAccountsDialogData`.

### `2)` Row model

> A row is one of my accounts, or a free line.

1. `AccountRow.assetId` becomes `account: { kind: 'asset', id } | { kind: 'other', addToNetWorth: boolean }`.
2. `reconcile-account-links.ts` (pure) turns the final rows plus the originally followed ids into `{ snapshots, links: PATCH[], unlinks: PATCH[], creates: AssetCreate[] }`. A picked account gets a snapshot, and a link when it was not followed. A followed account with no row left gets an unlink. A ticked free row gets a create. It never repeats an `assetId` and never snapshots a created element.
3. Spec of the pure function for each row of the Test Scope.

### `3)` Save at completion

> Same moment and failure handling as today.

1. `#saveBalances` runs creates (Type « Comptes » via `resolveAssetCategory` from `core/asset`), then the link and unlink `PATCH`es, then one snapshot batch. It stays fire-and-forget with the `balancesNotSaved` toast.
2. Dialog spec: replace the `describe('accounts linked to « Mon patrimoine »')` cases with the new model, including cancel/close writing nothing and the required name.

### `4)` Copy and rules

> The same words as the element sheet.

1. fr, then en, de, it: add `currentMonth.reconcile.accounts.account` (« Compte »), `.otherAccount` (« Autre compte… »), `.addToNetWorth` (« Ajouter à Mon patrimoine ») and `.nameRequired`; rewrite `linkedHint` without « Dans Pulpe ». `privateHint` is unchanged. `pnpm test:lexicon` must stay green.
2. `docs/BUSINESS_RULES.md`: the accounts I finish a reconciliation with are the ones followed; removing a row stops following without deleting; an account added there lands in « Comptes ».

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | A non-followed own CHF account is offered in a CHF reconciliation; an EUR one is not |
| 2 | The pure function never emits two snapshots for one `assetId`, nor a snapshot for a created element; a removed followed account yields exactly one unlink |
| 3 | Finishing writes exactly the creates, `PATCH`es and snapshots of the Test Scope; cancelling writes nothing |
| 4 | No catalog says « Dans Pulpe » in the reconciliation; `pnpm test:lexicon` passes |
