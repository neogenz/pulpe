---
status: pending
---

# Instruction: Web: step 2, more on accounts and other reasons

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
        └── src/app/pattern/reconcile-accounts/
            ├── reconcile-reasons-sheet.ts ✅
            ├── reconcile-reasons-sheet.spec.ts ✅
            ├── reconcile-starting-amount-sheet.ts ✅
            ├── reconcile-starting-amount-sheet.spec.ts ✅
            ├── reconcile-compare-step.ts ✏️
            ├── reconcile-compare-step.spec.ts ✏️
            ├── reconcile-accounts-dialog.ts ✏️
            └── reconcile-accounts-dialog.spec.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Demo user with no stored completion, realized 900.00, no unchecked income | Step 1 ready | browser |
| Happy path | Type 4 000, « Comparer » | First comparison: « Ces 3 100.00 étaient là avant Pulpe ? » | browser |
| Happy path | [Oui, c'était déjà là] | Matched; Pulpe figure « 900.00 + 3 100.00 d'avant Pulpe »; breakdown shows « D'avant Pulpe −3 100.00 »; stored starting amount 3 100 | browser + api |
| Happy path | Tap « 3 100.00 d'avant Pulpe », [Remettre à 0] | Figure back to 900.00, screen recomputed | browser |
| Edge case | Completed once, pay day 25, today the 23rd, gap +6 000 | Salary early, « Reviens comparer le 25, jour de ta paie. »; [Voir les autres raisons] opens the sheet | browser |
| Edge case | Other reasons, no « Je dois » row, a 600 line checked with 200 spent | Reasons: card, partly spent line (« 200.00 dépensés » / « 400.00 encore là »), money received; 3 at most | browser |
| Edge case | Gap +800, completed before, no salary rule | More on accounts: card question then « Tu vois +800.00… »; [Ajouter ce que je dois] returns to step 1 with a new « Je dois » row | browser |
| Edge case | Phone width / desktop | Reasons and starting amount open as bottom sheets on 390×664, dialogs on 1280×800 | browser |
| Teardown | `PUT /v1/reconciliation/state` `{ "startingAmount": 0 }` | Back to setup except completion | api |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) D'où viennent ces 6 000.00 ? ×│
│ ┌──────────────────────────────┐ │
│ │ (2) Tu as reçu de l'argent ? │ │
│ │ (3) Prime · 20 nov. +6 000.00│ │
│ │ (4) [ Noter un revenu de … ] │ │
│ │     Disponible : 900 → 6 900 │ │
│ └──────────────────────────────┘ │
│ (5) up to 2 more reasons         │
│ (6)       Laisser comme ça       │
└──────────────────────────────────┘
```

1. Sheet title with the gap, close.
2. One question per reason.
3. Mini visual with numbers, per spec.md §4.4.
4. The reason's action, with its effect line when it writes.
5. Other reasons kept by their conditions, fixed order.
6. Leave as is, completes the comparison.

## Tasks to do

### `1)` More on accounts and salary early

> Positive gaps ask before writing an income.

1. Screens « More on accounts » and « Salary early » of spec.md §4.4 from `comparisonScreen` and `isSalaryMaybeEarly` (pay day from user settings, days left from the period helpers).
2. [Ajouter ce que je dois] returns to step 1 and adds a focused « Je dois » row.

### `2)` First comparison and starting amount

> Money from before Pulpe is stored once, shown, and can be corrected.

1. First comparison screen; [Oui, c'était déjà là] sends `updateState({ startingAmount, completed: true })`.
2. « d'avant Pulpe » part of the Pulpe figure opens `reconcile-starting-amount-sheet.ts` (amount, [Enregistrer], [Remettre à 0]).

### `3)` Other reasons sheet

> The person sees the likely causes with numbers, at most three.

1. `reconcile-reasons-sheet.ts` with the four reasons and conditions of spec.md §4.4 (`partlySpentBudgetLines` for the second), opened like the add-account sheet.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Compare step spec: salary early only within 5 days with a pay day set; card question hidden when a « Je dois » row exists |
| 2 | Starting amount spec: save and reset update the figure and the screen; one write per answer |
| 3 | Reasons sheet spec: order and conditions, 3 at most; e2e passes at 1280×800 and 390×664; `ng build` passes |
