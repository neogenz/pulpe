# Review: iOS design refonte (PR #678)

- **Verdict**: changes-requested
- **Diff**: `origin/preview...feat/ios-design-refonte` (b3c086004, preview merged in)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_23
- **Findings**: 1 critical, 2 warning, 3 minor

## Phases

### Plan ios-design-refonte (2026_08_21)

- [x] P1 fondation, tokens, CTA plat, contraste — `ios/Pulpe/Shared/Design/DesignTokens+Deck.swift`, `ios/.swiftlint.yml` (exclusions retirées)
- [x] P2 saisie en trois blocs — `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`
- [x] P3 hero accueil + zone partagée — `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroSurfaceBackground.swift`, `HomeHeroSurfaceTracker.swift` + tests
- [x] P4 détail de budget — `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailHero.swift`, `BudgetLineMixedRow.swift`
- [x] P5 vue annuelle ledger — `ios/Pulpe/Features/Budgets/BudgetList/BudgetListView+YearComponents.swift`
- [x] P6 objectifs d'épargne — `ios/Pulpe/Features/SavingsGoals/*` (diff)
- [x] P7 modèles ledger — `ios/Pulpe/Features/Templates/*` (diff)
- [x] P8/P9 onboarding une question par écran — `ios/Pulpe/Features/Onboarding/OnboardingFlow.swift`, `OnboardingStepHeader.swift`

### Plan home-projection-history-prior (2026_08_22)

- [x] P1 backend drift history — `backend-nest/src/modules/budget/domain/drift-history.ts`, `supabase-budget.repository.ts:fetchHistoryData`, `shared/schemas.ts:driftHistorySchema`
- [x] P2 backtest gate — gate passed per plan Decisions (2026-08-22); script intentionally not shipped
- [x] P3 iOS projection bends with the prior — `ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift:96`, `BalanceTrajectoryTests.swift`
- [ ] P4 forecast journal + 'when' profile — `status: pending`, deferred by plan decision (not-applicable)

### Plan ios-design-fix-pass (2026_08_22)

- [x] P1-P3 hero in scroll, edge-to-edge chart, toolbar discs — `HomeHeroCard.swift`, `BudgetMonthPagerBar.swift`, `BudgetListView.swift:heroToolbarButtonStyle`
- [x] P4 pointing visible on ledger — `ios/Pulpe/Features/Budgets/BudgetDetails/PointCircle.swift`
- [x] P5 one entry-form model — `EditTransactionPage+Form.swift`, `AddBudgetLineSheet.swift`

### Plan home-burndown-chart (2026_08_23)

- [x] P1 real series + planned available — `BalanceTrajectory.swift:realSeries`
- [x] P2 plan/real/estimate drawn — `HomeHeroCard+Chart.swift`

### Plan home-chart-scrub (2026_08_23)

- [x] P1 reading + rule — `HomeHeroCard+Scrub.swift`, `HomeHeroCardScrubTests.swift`

### Plan home-hero-clarity (2026_08_23)

- [x] P1-P3, P5-P8 roles, verdict, tiles, destinations, deck copy, Imprévus, bottom inset — `HomeHeroCard.swift`, `UncheckedOperationsCard*.swift`, `CurrentMonthView.swift`
- [x] P4 superseded by P1 (status: superseded)

### Plan ios-tips-refresh (2026_08_23)

- [x] P1 checking tip anchored on the disc — `ios/Pulpe/Features/Tips/ProductTips.swift`, `CheckingTipAnchorTests.swift`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 | conform | burndown P1 / prior P3 | `ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift:96` | Swift trajectory gained `real`, `plannedOutflows`, `driftDate`, `trendBalance(priorDays:)` with the history prior; `shared/src/calculators/balance-trajectory.ts` untouched. Breaks CLAUDE.md "ALWAYS mirror a formula change across both sides, same commit" (`formula-mirrors-ts-swift.md`). | Port the four additions and their tests to `balance-trajectory.ts`, or record in the rule/ADR that the home chart is iOS-only and the mirror stops at `landing`. |
| 🟡 | code | prior P1 | `backend-nest/src/modules/budget/infrastructure/persistence/supabase-budget.repository.ts:392
465
736
778` | `fetchHistoryData` ignores `error` on both selects (`.data ?? []`): a failed query yields months with zero lines/transactions, i.e. a fake "held" history (`usualOutflowDrift` 0, K max) cached 30 s and fed to the projection. | Throw `BusinessException(BUDGET_FETCH_FAILED)` like `fetchAllBudgets`, or return `null` history on error. |
| 🟡 | fit | prior P1 | `backend-nest/src/modules/budget/application/find-budget-with-details.use-case.ts:72` | History (all budgets + lines + transactions of 12 months, full decrypt, 31×12 `calculateAllMetrics` replays) is computed for every details GET, including past budgets and the web client that never reads it. Plan accepts "persist only if the cost shows up" but nothing measures it. | Log duration under `budget.details.fetched`, or skip `computeHistory` when the budget is not the current period. |
| 🟢 | rot | prior P4 | `backend-nest/src/modules/budget/domain/drift-history.ts:12` | `driftProfile` is computed, validated, decoded on iOS, and unused (plan P4 pending). | Accept per plan decision; remove if P4 is dropped. |
| 🟢 | code | burndown P2 | `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard+Chart.swift:53` | `Self.chartYDomain(for:)` recomputed inside the `AreaMark` `ForEach` per point; `plan(for:)`/`projection(for:)` each called 2-3× per body. Body runs on every scrub day. | Hoist the three into `let`s at the top of `balanceChart`. |
| 🟢 | code | scrub P1 | `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard+Scrub.swift:36` | Eyebrow built by string concatenation (`lead + " · " + …`) around two localized halves; word order fixed for DE/IT. | One key `"%@ · Prévu %@"`. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 97% (29/30 phases) |
| Files checked | drift-history.ts, find-budget-with-details.use-case.ts, supabase-budget.repository.ts, budget.mapper.ts, shared/schemas.ts, BalanceTrajectory.swift, HomeHeroCard(+Chart,+Scrub).swift, BudgetListView.swift, BudgetListStore.swift, OnboardingState.swift, Localizable.xcstrings (114 new keys, all translated en/de/it) |
| Unchecked     | prior P4 forecast journal — not-applicable (deferred by decision) |
| Unplanned     | `ios/.swiftlint.yml` exclusion cleanup; frontend e2e/mocks `history: null` (contract follow-through) |
