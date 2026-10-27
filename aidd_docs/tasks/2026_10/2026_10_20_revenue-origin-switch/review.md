# Review: revenue-origin-switch (iOS, phases 1-2)

- **Verdict**: changes-requested
- **Diff**: `origin/main...4ea181532` (`ios/` only)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_20
- **Findings**: 0 critical, 1 warning, 2 minor

## Phases

### Phase 1 — iOS prévision sheet, toggle + segment

- [x] A Revenu shows « Cet argent vient de mon épargne » off; « Origine » and « Revenu habituel » appear nowhere — `Shared/Components/SavingsOriginToggle.swift:33`, `AddBudgetLineSheet+IncomeOrigin.swift:71`
- [x] On: « D'un objectif » / « À remettre » on one line each, objectif selected, goal picker visible — `AddBudgetLineSheet+IncomeOrigin.swift:79`, `IncomeOrigin.savingsOrigin` defaults to `.goal`
- [x] « À remettre » + Continuer opens the withdrawal preview prefilled — `.repayNextMonth` still routes through `AddBudgetLineSheet+Submit.swift:23`, mapping covered by `segment_roundTrips`
- [x] Pointé hidden whenever the toggle is on — `AddBudgetLineSheet.swift:237` (`forbidsChecked` for both savings origins)
- [x] `AddBudgetLineIncomeOriginTests` executes the new tests and passes — 3 new tests

### Phase 2 — iOS mouvement sheet, toggle + segment + routing

- [x] Accueil Revenu shows the same toggle and segment as the prévision sheet — `AddTransactionSheet.swift:239`
- [x] Widget: no segment, goal-only toggle — `onRequestSavingsWithdrawal` defaults to `nil` → `offersRepay: false`
- [x] « À remettre » + Continuer opens this month's budget page with the preview prefilled — `MainTabView.swift:144`, `CurrentMonthView+SavingsWithdrawal.swift`; checked on the simulator (PUL-358 video)
- [ ] Confirming creates Revenu M + Épargne M+1 and the accueil reflects it — not exercised at runtime; unchanged PUL-292 mutation + PUL-270 seam (`BudgetDetailsCoordinator+Mutations.swift:22`)
- [x] `AddTransactionSheetTests` executes the new cases and passes — 2 new tests

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | conform | 2 | `Features/CurrentMonth/Components/AddTransactionSheet.swift:7` | Task 1.3 (`AddTransactionSheet+SavingsOrigin.swift`) not done; the file sits at 468 of SwiftLint's 500-line wall | Move the pure `SavingsGoalOrigin` rule to `AddTransactionSheet+SavingsOrigin.swift`; the view section stays, it binds six `private` `@State` |
| 🟢 | rot | 2 | `Features/CurrentMonth/Components/AddTransactionSheet.swift:79` | `isFromSavingsGoal` now backs « Cet argent vient de mon épargne », which also covers « À remettre » | Rename to `isFromSavings` |
| 🟢 | rot | 2 | `Features/CurrentMonth/Components/AddTransactionSheet.swift:231` | `// MARK: - Savings-goal origin (PUL-329)` no longer names the repay path | `// MARK: - Savings origin (PUL-329 / PUL-292)` |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 90% (9/10) |
| Files checked | AddBudgetLineSheet.swift, AddBudgetLineSheet+IncomeOrigin.swift, AddBudgetLineSheet+Submit.swift, AddTransactionSheet.swift, CurrentMonthView.swift, CurrentMonthView+SavingsWithdrawal.swift, MainTabView.swift, SavingsWithdrawal.swift, SavingsOriginToggle.swift, BudgetDetailsCoordinator+Mutations.swift, Localizable.xcstrings |
| Unchecked     | Confirm creates Revenu M + Épargne M+1 — not-applicable (confirm path unchanged by this diff) |
| Unplanned     | « À remettre » hides tags, date and Pointé and drops the description requirement (no operation is created on the accueil); `missingAmount` dropped from the accueil route (deficit chip read a foreign currency, commit 4ea181532); routing goes through an `@Entry` closure + `SavingsWithdrawalRequest` instead of an injected `BudgetDetailsRouter` (feature isolation: CurrentMonth never imports Budgets) |
