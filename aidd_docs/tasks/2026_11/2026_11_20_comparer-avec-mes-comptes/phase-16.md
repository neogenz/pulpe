---
status: pending
---

# Instruction: Android: step 2, more on accounts and other reasons

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── android/src/
    ├── core/i18n/catalogs/
    │   ├── fr.json ✏️
    │   ├── en.json ✏️
    │   ├── de.json ✏️
    │   └── it.json ✏️
    └── features/current-month/
        ├── reconciliation-queries.ts ✏️
        └── components/
            ├── reconcile-reasons-sheet.tsx ✅
            ├── reconcile-reasons-sheet.spec.tsx ✅
            ├── reconcile-starting-amount-sheet.tsx ✅
            ├── reconcile-starting-amount-sheet.spec.tsx ✅
            ├── reconcile-compare-step.tsx ✏️
            └── reconcile-compare-step.spec.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Same data as phase 8 (no stored completion, realized 900.00) | Step 1 ready | system |
| Happy path | Type 4 000, [Oui, c'était déjà là] | Matched; « 900.00 + 3 100.00 d'avant Pulpe »; starting amount stored | system |
| Happy path | Tap « 3 100.00 d'avant Pulpe », [Remettre à 0] | Figure back to 900.00 | system |
| Edge case | Pay day 25, the 23rd, gap +6 000, completed before | Salary early, then the reasons sheet | system |
| Edge case | Reasons with no « Je dois » row and a 600 line checked with 200 spent | Card, partly spent line, money received | system |
| Edge case | Gap +800, completed before | Card question, then the +800.00 question; [Ajouter ce que je dois] back to step 1 | system |
| Teardown | Starting amount back to 0 | Setup restored except completion | api |

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
3. Mini visual with numbers.
4. The reason's action and its effect line.
5. Other reasons kept by their conditions.
6. Leave as is, completes the comparison.

## Tasks to do

### `1)` More on accounts and salary early

> Positive gaps ask before writing an income.

1. Both screens of spec.md §4.4; salary rule from `isSalaryMaybeEarly` with `useCurrentMonth().payDayOfMonth` and the period helpers.
2. [Ajouter ce que je dois] returns to step 1 with a new « Je dois » row focused.

### `2)` First comparison and starting amount

> Money from before Pulpe is stored once, shown, and can be corrected.

1. First comparison screen and its write (mutation in `reconciliation-queries.ts`); `reconcile-starting-amount-sheet.tsx` to edit or reset.

### `3)` Other reasons sheet

> At most three causes with numbers.

1. `reconcile-reasons-sheet.tsx` with the order and conditions of spec.md §4.4.

### `4)` Contributor checks for the whole feature

> Every check the repository requires passes on the final tree.

1. From the root: `pnpm quality` (includes `test:lexicon`, `test:public-surface`, `format:check:automation`).
2. `cd backend-nest && bun run quality && bun test`; `cd shared && pnpm test`; `cd frontend && pnpm exec ng build`; `cd android && pnpm quality && pnpm test`; iOS `PulpeTests` on the dedicated test simulator and SwiftLint strict.
3. `pnpm test:e2e` for `account-reconciliation.spec.ts`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Compare step spec: salary screen only with a pay day and 5 days or fewer; card question hidden with a « Je dois » row |
| 2 | Starting amount spec: save and reset recompute the screen; one write per answer |
| 3 | Reasons sheet spec: order, conditions, cap of 3 |
| 4 | Every command of task 4 exits 0 on the final commit |
