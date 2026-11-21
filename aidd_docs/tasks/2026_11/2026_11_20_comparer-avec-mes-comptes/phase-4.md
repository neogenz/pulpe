---
status: pending
---

# Instruction: Backend: previous months in the comparison

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/
│   └── BUSINESS_RULES.md ✏️
└── backend-nest/src/modules/
    ├── budget/
    │   ├── domain/ports/
    │   │   └── budget-month-read.port.ts ✏️
    │   └── application/
    │       ├── read-budget-month.use-case.ts ✏️
    │       └── read-budget-month.use-case.spec.ts ✅
    └── reconciliation/
        ├── domain/
        │   ├── prior-correction.ts ✅
        │   └── prior-correction.spec.ts ✅
        └── application/
            ├── get-reconciliation-context.use-case.ts ✏️
            └── get-reconciliation-context.use-case.spec.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Seed three budgets: October (stored ending balance 1 000, unchecked card purchases 800), September (unchecked pharmacy 40), August | Budgets chained by `previousBudgetId` | system |
| Happy path | GET context for November | `priorCorrection` = +840; `priorItems` lists the October purchases with `monthsAgo: 1` and the pharmacy with `monthsAgo: 2`, each with its effect | api |
| Edge case | First budget of the user | `priorCorrection: 0`, `priorItems: []` | api |
| Edge case | Previous budget with a null stored ending balance | Its correction is its realized net minus 0, like the rollover counts it | api |
| Edge case | A month with no budget between two budgets | The chain follows existing budgets, two hops at most | api |
| Edge case | August's unchecked items | Not listed: three budgets back | api |

## Tasks to do

### `1)` Read a budget by id from other modules

> The reconciliation module reads earlier budgets without touching the budget repository.

1. Add `readBudget(id)` to `BudgetMonthReadPort`, returning `BudgetWithDetails` (with `previousBudgetId`) or `null`, backed by the existing find-with-details use case.

### `2)` Compute the prior correction and items

> The comparison ignores what the rollover counted as spent but nobody checked, two budgets back.

1. `prior-correction.ts`: for each of the two previous budgets, `realizedNet(P) − (storedEndingBalance(P) ?? 0)` with `BudgetFormulas` realized income and expenses (rollover excluded); sum them.
2. List their unchecked movements and budget lines with `monthsAgo` and their effect from `pointingEffect` (phase 1).
3. Fill `priorCorrection` and `priorItems` in the get-context use case.

### `3)` Write the rule down

> The next person reading the rollover rule finds the comparison exception.

1. Add to `docs/BUSINESS_RULES.md` (« Continuité mensuelle »): the compared figure, the two-budget window, « Disponible à dépenser » unchanged.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `read-budget-month.use-case.spec.ts` covers found, foreign and missing ids |
| 2 | `prior-correction.spec.ts` gives +840 on the seed, 0 for a first budget, and handles the null stored balance; the context spec lists items with the right `monthsAgo` |
| 3 | `BUSINESS_RULES.md` states the rule with the October example |
