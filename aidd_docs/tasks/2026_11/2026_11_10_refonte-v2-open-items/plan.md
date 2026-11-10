---
objective: "The items left open by the side-effect review of neogenz/pulpe#866 that are real defects are fixed on iOS, and both full test suites pass on the result."
status: implemented
---

# Plan: Refonte V2 open items

Source: user request « fais un plan pour corriger ce qui est encore ouvert et à traiter de manière pertinente », applied to the ten items left open by the side-effect review of neogenz/pulpe#866 at `7de2e30a1`. Kept: 3 (repair title), 9 (« Dépassées » empty page), 6 (goal chart accessibility), 10 (full UI suite). Left out, with the evidence in Impact: 1, 2, 4, 5, 7, 8.

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | repair-title-gaps | [`phase-1.md`](./phase-1.md) | none |
| 2   | over-filter-empty-state | [`phase-2.md`](./phase-2.md) | none |
| 3   | goal-chart-hidden-amounts | [`phase-3.md`](./phase-3.md) | none |
| 4   | full-suites-and-pr-body | [`phase-4.md`](./phase-4.md) | 1, 2, 3 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none  | none              |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Item 3. `repairTitle` (`ios/Pulpe/Features/SavingsGoals/Components/GoalPlanTimelinePresentation.swift:106`) hands every repairable month to `rangeTitle`, which names only the first and the last: mars, mai, juin reads « Planifier mars à juin » while avril is not written. Observed by code read, not reproduced on a simulator. | phase 1 |
| runtime | Item 9. « Dépassées » with no overrun line left shows the hero, the rail and a lone « Ajouter une prévision » card, with no message: `canShowEmptyChecked` only covers « À pointer » (`BudgetDetailsProjector.swift:213-225`) and `BudgetDetailsView.swift:244` then draws the add row. Common trigger: « Rattraper » clears the last overrun while the filter is on. Observed by code read, not reproduced on a simulator. | phase 2 |
| runtime | Item 6. `GoalProjectionChart.swift:96-116` sets `.accessibilityValue(accessibilitySummary)` with the saved, projected and target amounts and never reads `amountsHidden`, so the amounts are spoken while masked on screen. Observed by code read, unverified with VoiceOver. | phase 3 |
| runtime | Left out. Item 4, not reproduced: flags refresh on `.onChange(of: appState.currentUser?.id)` (`App/PulpeApp.swift:114-127`), logout sets `currentUser = nil` (`App/AppState+SessionReset.swift:346`), so a same-user login changes the id again. Item 7, pre-existing and intentional: `sessionMissing` mapping in `Core/Network/APIClient.swift:326-351` (PUL-278), not introduced by this branch. Item 8, no warning found: the unit build log at `7de2e30a1` has no `warning:` line for the `@Entry` closures (`App/GoalWithdrawalFlow.swift:7`). | not planned |
| regression | Item 10. The full UI suite on "Pulpe Tests P7" last ran before the side-effect review (37 of 38 passed); only the failing class was rerun after the « Rattraper » fix. The unit suite passed 2616 tests in 303 suites at `7de2e30a1`, before the three fixes of this plan. | phase 4 |
| regression | Callers checked by grep. `repairTitle` has one app caller (`SavingsGoalDetailView+Sections.swift:31`); `rangeTitle` is untouched and its other callers pass contiguous runs. `BudgetDetailsScreenState` has a memberwise initializer with two constructor sites (`BudgetDetailsProjector.swift:154`, `BudgetDetailsScreenState.swift:105`), both updated; `canShowEmptyChecked` keeps its value and its consumers. The chart has two call sites (same file, `Simulator/GoalPlanSimulatorSheet.swift:77`), both fed by the environment, so neither changes. | phases 1, 2, 3 |
| architecture | Phase 2 stays inside the BudgetDetails rules: the new flag is derived in the projector (316 lines today, about 12 added, ceiling 350) and the view only reads `screenState`. No new type, no new store, no new catalog key in phases 2 and 3. | phase 2 |
| architecture | Left out. Item 2: no file is over the 500-line lint ceiling (`GoalDeletionSheet` 498, `ReconcileAccountsSheet` 492, `OnboardingState` 487), so nothing fails; split when one of them next grows. Item 5: no test confirmed to call MainActor code without isolation after the four suites fixed at `7de2e30a1`; Swift 6 rejects a synchronous cross-actor call at compile time, and whether a test reaches the two `MainActor.assumeIsolated` sites (`Core/Auth/AppleSignInCoordinator.swift:79`, `Shared/Extensions/View+Extensions.swift:76`) is unverified. Item 1: `EmptyStateCard` and `PulpeEmptyState` overlap, with no defect. | not planned |
| documentation | No doc describes these behaviours: grep for `Dépassées`, `Plus rien ne dépasse`, `Trajectoire d'épargne` and `repairTitle` in `docs/`, `DESIGN.md`, `ios/DESIGN.md`, `PRODUCT.md` and `aidd_docs/memory` returns no file. | none needed |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Files under `Features/Budgets/BudgetDetails` stay at 350 lines or less, and no `.filter`, `.sorted`, `.map` or `BudgetFormulas` call in a view body there | Phase 2 adds a derived flag: it goes in the projector, the view reads `screenState` only (`BudgetDetailsArchitectureTests`) |
| A new catalog key carries fr, en, de and it in `ios/Pulpe/Resources/Localizable.xcstrings` | Phase 1 adds `Planifier %lld mois` |
| Product copy is French and never shows the word « transaction » | Phases 1 and 2 put text on screen |
| No magic design value, use `DesignTokens` | Phase 2 adds a view block: it reuses the frame and padding of the sibling empty state |
| `xcodegen generate --use-cache` after adding a file | Phase 3 creates a test file |
| `xcodebuild test` only on "Pulpe Tests" and "Pulpe Tests P7"; with `-only-testing:` read the executed count, zero tests still prints SUCCEEDED | Every phase runs tests |
| Read the live PR body before `gh pr edit`; commit and push only on the user's request; no follow-up list in a commit, a PR body or a doc | Phase 4 updates the PR body |
