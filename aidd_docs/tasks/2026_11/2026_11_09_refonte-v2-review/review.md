# iOS redesign (PR #866): independent review, 2026-11-09

Scope: `origin/main...ddeba3e5b`, iOS only, Mon patrimoine excluded (six earlier rounds).
Five read-only reviewers, one per zone. Every finding below was re-traced in the code at
`ddeba3e5b` unless marked PLAUSIBLE. Nothing was built or run for this review.

## Tier 1: functional bugs and leaks (fix before merge)

| # | Sev | Where | Defect |
|---|-----|-------|--------|
| B1 | HIGH | `Features/Budgets/BudgetDetails/State/FiltersStore.swift:27`, `BudgetDetailsView.swift:200` | The saved filter (incl. « Dépassées », and « Pointé » saved by V1) applies to months to come, where the rail is hidden: the month shows no prévisions and no way back to « Tout ». |
| B2 | MED | `FiltersStore.swift:73` | « Dépassées » counts incomes and savings above plan; « Rattraper le dépassement » then opens a sheet saying nothing overruns. Should be expenses only, like the row and `CatchUpPlan`. |
| B3 | MED | `Budgets/BudgetDetails/Spread/SpreadExistingCalculator.swift:140` | Spreading a prévision with Réels: the server unlinks them (`ON DELETE SET NULL`), the preview keeps them on the line, so the gain is overstated by up to the amount already spent. |
| A1 | MED | `App/FloatingAddFlow.swift:65` | Global « + » → prévision → Revenu « De mon épargne » → « À remettre » → « Continuer » does nothing (`onRequestSavingsWithdrawal` nil, `offersRepay: true`). |
| A2 | MED | `Budgets/BudgetDetails/AddBudgetLineSheet+Parts.swift:24,102` | Forecast impact uses the typed amount in the input currency against a ledger in the account currency. |
| A3 | MED | `Shared/Components/ImpactBlock.swift`, `MovementSheet+Question.swift:109,163`, `MovementLinePicker.swift:99,121` | Hidden-amounts mode: before/after disponible, « reste X » and picker amounts shown in clear and read by VoiceOver. |
| A4 | MED | `CurrentMonth/Components/PointRow.swift:27` | Hidden-amounts mode: « Reste X » / « X au-delà du prévu » subtitles not blurred (À pointer, À faire). |
| A5 | MED | `CurrentMonth/Components/HomeHeroCard.swift:87`, `+Scrub.swift:41` | Hidden-amounts mode: scrubbing the plot prints « Prévu X ». Pre-existing, worsened by un-blurring the plot. |
| F1 | MED | `App/GoalWithdrawalFlow.swift:31` | « Faire un retrait » opens an empty sheet with no close button when the current month has no budget. |
| G1 | MED | `SavingsGoals/Simulator/GoalPlanSimulatorSheet+V2.swift:33` | « requis » chip writes the unrounded required (333.333…), plan ends 0.01 short, extra decimals stored. Round up to the cent. |
| G2 | MED | `SavingsGoals/Components/GoalDeletionSheet.swift:295` | Freed disponible sums prévu and ignores Réels that stay as free Réels: 500 line fully pointed shows +500, real change 0. |
| G3 | MED | `GoalDeletionSheet.swift:292`, `SavingsGoalFormSheet.swift:306` | « Ton disponible de <mois> » picks the calendar month, not the pay-day period. |
| G4 | MED | `SavingsGoals/SavingsGoalDetailView+Sections.swift:91` | An overdue active goal can no longer be paused (V1 could; `docs/SAVINGS.md` §6 allows it). |
| O1 | MED | `Onboarding/Steps/RegistrationStep.swift:45` | After « email déjà utilisé », editing the email swaps the inline banner for the generic error banner with the same message. |
| O2 | MED | `Account/AccountView.swift:37` | `navigationTitle(Tab.currentMonth.title)`: screens pushed from Compte get a « ‹ Accueil » back label. |
| F2 | MED | `Shared/Components/ToastView.swift:65` | VoiceOver reads « Annuler la suppression » on the « X pointé » undo toast. |
| A6 | LOW | `CurrentMonth/Pages/ToPointPage.swift:232` | Un-pointing keeps « pointé à l'instant » on the row. |
| B4 | LOW | `Budgets/BudgetList/CreateBudgetView.swift:91,277` | « Nouveau mois » lets you pick a month that exists; error only after the server call. |
| O3 | LOW | `Onboarding/OnboardingFlow.swift:79` | « Quitter » sends `onboarding_abandoned` and `onboarding_step_back`. |
| O4 | LOW | `Onboarding/OnboardingState+Persistence.swift:225` | `onboarding_resumed` now also fires on every foreground (`source: foreground`); recovery insights will jump unless filtered. |

## Tier 2: dead code and stale docs (V1 leftovers)

- Files with no caller: `Shared/Components/TwoColumnReflowLayout.swift`, `Shared/Components/HeroZone/HeroVerdictRow.swift`, `Shared/Design/DesignTokens+Deck.swift`, `SavingsGoals/GoalContributionsSection.swift`, `Resources/Lottie/maintenance-animation.json`.
- `SavingsGoalDetailViewModel` still fetches contributions on every load for nothing (`:50`, `:59-68`).
- Orphaned members: ~30 colours, tokens, fonts and button styles (onboarding, PIN, hero, deck), `HeroVerdictPresentation` V1 helpers, `GoalPlanTimelinePresentation.repairMessage`, `SavingsGoalProgress.currentMonthPlannedAmount`/`displayedProjectionFraction`, `AddBudgetLineSheet.forbidsChecked`, unused new `coralWash`, `midAmount`, `midCurrencySuffix`.
- `ios/DESIGN.md:404-425` documents the deleted deck; `:306` lists `HeroVerdictRow`; `:237`/`:300` say red is delete-only while errors now use it.
- Removed status picker leftovers in `SavingsGoalFormSheet` (`status` state, doc comments).

## Tier 3: polish and risk

- `SegmentedPicker.swift:58` fixed 36 pt height: likely clipped at accessibility sizes (PLAUSIBLE, not rendered).
- PIN change and recovery screens half on V1 styling, « Revenir » under 44 pt.
- Maintenance « Réessayer » lost its loading state.
- Onboarding currency sheet may inherit the forced dark scheme (PLAUSIBLE).
- Goal quick-amount chips lack `.isSelected`; plan button title can name months the repair won't write; history totals vs groups; « Décembre à février » for non-contiguous months.
- Widget deep link loads the month before `setPayDay` (PLAUSIBLE race).
- Edit sheet clears the asset link on a kind round-trip (Épargne → Dépense → Épargne).
- `refreshProgress()` writes after cancellation (PLAUSIBLE flicker).
- Double feature-flag reload on sign-in.
- Hidden-amounts UI test can pass without asserting anything (`ContextualCreationUITests.swift:168`).
- Missing emission tests for `onboarding_step_back`, `recovery_key_acknowledged`, `onboarding_handoff_completed`.
- Files at the 500-line wall: `GoalDeletionSheet` 489, `ReconcileAccountsSheet` 490, `OnboardingState` 481.
- Duplicate `EmptyStateCard` / `PulpeEmptyState`; template totals recomputed inline in `HomeNoBudgetView`.

## Product decisions (wording contradicts CLAUDE.md / PRODUCT.md)

1. « Chaque mois » / « Une fois » replace « Mensuel » / « Ponctuel » (`Shared/Copy/PendingWording.swift:13`).
2. « Déjà sur mon compte » replaces « Déjà pointé » (`Shared/Components/CheckedToggle.swift:32`); web keeps « Déjà pointé ».
3. « Couvrir avec mon épargne » lists goals with their balance but does not debit the goal (deliberate per `docs/SAVINGS.md` §11.2; the screen implies a debit).

Decided 2026-11-09: 1 and 2 follow the glossary (« Mensuel » / « Ponctuel », « Déjà pointé »). 3 is still open.

## Cleared

Ledger and pending-deletion math, delete/postpone/pointing confirmations, catch-up plan, spread split, plurals in fr/en/de/it, xcstrings (1946 keys, no gap, no « transaction »), onboarding step order and idempotency, PIN gate, force-update gate, logout reset, no retired analytics alias, no amounts in events, `swiftlint --strict` clean on all of `ios/`.
