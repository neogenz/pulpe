---
status: pending
---

# Instruction: Shared rules: candidates, screen selection, guide events (TS + Swift)

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── shared/
│   ├── index.ts ✏️
│   └── src/
│       ├── feature-flags.ts ✏️
│       └── calculators/
│           ├── account-reconciliation.ts ✏️
│           └── account-reconciliation.spec.ts ✏️
└── ios/
    ├── Pulpe/
    │   ├── Core/Analytics/
    │   │   └── AnalyticsEvent.swift ✏️
    │   └── Features/CurrentMonth/Reconciliation/
    │       └── AccountReconciliation.swift ✏️
    └── PulpeTests/Features/CurrentMonth/
        └── AccountReconciliationTests.swift ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Keep the current fixtures of both suites (814.93 with bonus 800 and dinner 50, 84.30 with coffee 20, groceries line 100, four movements capped at three) | Both suites green before any change | cli |
| Happy path | Gap −100.00, unchecked budget line « Assurance » 100, movement « Essence » 60, prior item « Pharmacie » effect −40 `monthsAgo` 1 | Candidates: Assurance (budget line, remaining 0), Essence (remaining 40), Pharmacie (1 month back, remaining 60) in that order on both sides | cli |
| Edge case | Gap −2.40, no candidate | Screen = small gap; at −10.00 screen = large gap; at +3 100.00 with `first` = first comparison | cli |
| Edge case | Gap +6 000.00, pay day 25, 3 days to next period | Salary maybe early = true; pay day 1 or null, or 6 days left = false | cli |
| Edge case | Checked expense line 600 with 200 allocated; checked line 1 200 with nothing allocated | Only the first is a partly spent budget line (spent 200, left 400) | cli |
| Edge case | Matched: remaining 900, compared 4 050, starting amount 3 100 | Breakdown: encore prévu −50, d'avant Pulpe −3 100, à dépenser 900 | cli |
| Edge case | Old call shape `pointingCandidates(gap, lines, transactions)` | Same result as before the change | cli |

## Tasks to do

### `1)` Candidates include budget lines and prior items

> One ranked list of what the person can check, from three sources, same rule as today.

1. Extend `pointingCandidates` with unchecked budget lines of the month and an optional list of prior items carrying their own effect and `monthsAgo` (1 or 2).
2. Tag each candidate with its source (`transaction`, `budgetLine`, `prior`) and `monthsAgo` (0 for the month).
3. Keep the filter (same sign, `|effect| <= |gap|`, effect not 0), the ranking by remaining gap, the stable order on ties and the cap of 3.
4. Extract the inline per-item effect (`account-reconciliation.ts:139-149`) into an exported `pointingEffect`, reused by `pointingCandidates` and by the server; it needs no Swift twin.

### `2)` Screen selection and gap rules

> Every platform picks the same step-2 screen from the same numbers.

1. Add `SMALL_GAP_THRESHOLD = 10`, `isSalaryMaybeEarly({ gap, payDayOfMonth, daysUntilNextPeriod })` and `comparisonScreen({ gap, candidateCount, dismissed, first, salaryMaybeEarly })` returning `matched | suggestions | firstComparison | salaryEarly | smallGap | largeGap | moreOnAccounts`, per spec.md §4.3.
2. Add `comparedFigure(realizedBalance, priorCorrection, startingAmount)` and `availableAfterNote(available, gap)`.
3. Add `partlySpentBudgetLines(budgetLines, transactions)` (checked expense lines with 0 < allocated < amount, with spent and left) and `matchedBreakdown({ available, compared, startingAmount })` per spec.md §4.4.

### `3)` Swift twin with the same fixtures

> iOS shows the same amounts and screens as web and Android.

1. Mirror tasks 1 and 2 in `AccountReconciliation.swift` (Android imports the TS directly).
2. Copy every new fixture number into `AccountReconciliationTests.swift`, same cases, same expected values.
3. Break each new assertion's line once on each side, see it red, restore.

### `4)` Guide analytics events

> The guide's use is measurable on the three platforms.

1. Add `ACCOUNT_RECONCILIATION_GUIDE_VIEWED`, `_COMPLETED`, `_SKIPPED` to `ANALYTICS_EVENTS` with the JSDoc contract (`source`: `auto` or `help`).
2. Mirror the three cases in `AnalyticsEvent.swift`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `cd shared && pnpm test` passes with budget-line and prior candidates ranked as in the happy path, and every pre-existing assertion unchanged |
| 2 | The screen table of spec.md §4.3 is covered row by row, salary and partly spent cases included |
| 3 | iOS `PulpeTests` `AccountReconciliationTests` passes with the same numbers; each new assertion was seen red once |
| 4 | `pnpm test:lexicon` and the shared type-check pass; the three events exist with the same string on both sides |
