---
status: pending
---

# Instruction: Web: step 1 and entry points

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── frontend/
    ├── e2e/tests/features/
    │   └── account-reconciliation.spec.ts ✏️
    └── projects/webapp/
        ├── public/i18n/
        │   ├── fr.json ✏️
        │   ├── en.json ✏️
        │   ├── de.json ✏️
        │   └── it.json ✏️
        └── src/app/
            ├── core/storage/
            │   ├── storage-keys.ts ✏️
            │   └── storage-schemas.ts ✏️
            ├── ui/dashboard-hero/
            │   └── dashboard-hero.ts ✏️
            ├── feature/budget/budget-details/
            │   ├── budget-details-page.html ✏️
            │   ├── budget-details-page.ts ✏️
            │   ├── budget-details-page.spec.ts ✏️
            │   └── store/
            │       └── budget-details-store.ts ✏️
            └── pattern/reconcile-accounts/
                ├── reconcile-accounts-step.ts ✅
                ├── reconcile-accounts-step.spec.ts ✅
                ├── reconcile-add-account-sheet.ts ✅
                ├── reconcile-add-account-sheet.spec.ts ✅
                ├── reconcile-free-accounts.ts ✅
                ├── reconcile-free-accounts.spec.ts ✅
                ├── reconcile-account-links.ts ✏️
                ├── reconcile-account-links.spec.ts ✏️
                ├── reconcile-accounts-dialog.ts ✏️
                ├── reconcile-accounts-dialog.html ✏️
                ├── reconcile-accounts-dialog.scss ✏️
                ├── reconcile-accounts-dialog.spec.ts ✏️
                ├── reconcile-accounts-dialog.service.ts ✏️
                └── reconcile-accounts-dialog.service.spec.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Demo user with `net_worth` forced on through the dev flag override (`STORAGE_KEYS.DEV_FEATURE_FLAGS`), one own account and one card debt in Mon patrimoine, guide already seen | Step 1 opens with the followed accounts | browser |
| Happy path | Type 3 000 on « Compte courant », add « Revolut » as a new account with « J'ai » 1 000, add the card from Mon patrimoine with 800 | « En tout 3 200.00 », line « 4 000 − 800 que tu dois »; « Comparer » goes on | browser |
| Happy path | Close and reopen | « Revolut » and its side come back with an empty amount; no Revolut item in Mon patrimoine | browser |
| Edge case | No « Je dois » row | Card help shows; its button adds a « Je dois » row with the name focused | browser |
| Edge case | An account receiving a saving budget line this month | Not offered in « Depuis Mon patrimoine » | browser |
| Edge case | `net_worth` off | No Mon patrimoine block, no caption | browser |
| Edge case | Budget detail of a past and of a future month | No comparison button; current month shows it | browser |
| Edge case | Phone width | Add sheet opens as a bottom sheet; at desktop as a dialog | browser |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) ×  Comparer avec mes comptes ? │
│ (2) Étape 1 sur 2                │
│     Combien as-tu aujourd'hui ?  │
│ ┌──────────────────────────────┐ │
│ │ (3) Compte courant  J'ai   × │ │
│ │     CHF [ 3 000.00 ]         │ │
│ ├──────────────────────────────┤ │
│ │ (4) Revolut                × │ │
│ │     [ J'ai  |  Je dois ]     │ │
│ │     CHF [ 1 000.00 ]         │ │
│ └──────────────────────────────┘ │
│ (5) + Ajouter un compte          │
│ (6) card help + button           │
│ (7) En tout            4 000.00  │
│ (8) [          Comparer        ] │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ (9) Ajouter un compte          × │
│ (10) Nouveau compte              │
│ (11) Une somme que je dois       │
│ (12) Depuis Mon patrimoine       │
│      Comptes · Cartes et crédits │
└──────────────────────────────────┘
```

1. Close, title, « ? » replays the guide.
2. Step label, title, one sentence.
3. Row from Mon patrimoine: fixed side label, amount, « Mis à jour dans Mon patrimoine. », remove.
4. Free row: two-segment side control, amount, remove.
5. Opens the add sheet.
6. Card help while no « Je dois » row exists.
7. Total, with the « que tu dois » line when needed.
8. Goes to step 2.
9. Add sheet header, sentence « Seulement les comptes de tes dépenses. Pas l'épargne. ».
10. Free « J'ai » row.
11. Free « Je dois » row.
12. Mon patrimoine items grouped by type, hidden when the flag is off.

## Tasks to do

### `1)` Accounts step

> Step 1 of spec.md §3 in its own component.

1. `reconcile-accounts-step.ts`: rows with fixed or two-segment side (44px segments), amount, remove with its accessible name, total line, card help, « Comparer ».
2. Remove the overdraft checkbox and the « Ajouter à Mon patrimoine » switch; `reconcile-account-links.ts` stops planning creates.
3. Amounts in tabular figures and never split across two lines (`tabular-nums`, `whitespace-nowrap`), spec.md §5.

### `2)` Add an account

> One sheet for new, owed and Mon patrimoine accounts.

1. `reconcile-add-account-sheet.ts`, opened like `add-transaction-dialog.service.ts` (bottom sheet on handset, dialog on desktop).
2. The service passes own and owe items, filtered per spec.md §3 (archived, currency, already listed, `budgetLine.assetId` of a saving line this month).

### `3)` Remember free rows on the device

> Names and sides come back next time, amounts never.

1. `reconcile-free-accounts.ts` over `StorageService`, key `pulpe-reconcile-free-accounts` (`scope: 'user'`), schema of `{ name, side }[]`.

### `4)` Current month only, one name

> The button exists only where the comparison makes sense, under its new name.

1. Expose the current-period check of `budget-details-store.ts` under a neutral name, use it for spreads and to hide the button on other months.
2. Rename « Rapprocher mes comptes » and the hero button to « Comparer avec mes comptes » in the 4 catalogs.
3. Update `budget-details-page.spec.ts:327` (months 1, 10, 12) to the current-month rule.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Step spec: totals with « Je dois », remove leaves Mon patrimoine untouched, no create planned for free rows; at 390×664 no amount wraps |
| 2 | Add sheet spec: filters of spec.md §3, flag off hides the block |
| 3 | Free accounts spec: names and sides restored, amounts absent, cleared on sign-out |
| 4 | Budget details spec: button only on the current period; e2e passes at 1280×800 and 390×664; `ng build` passes |
