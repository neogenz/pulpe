---
name: audit
description: iOS savings-goals branch audit
argument-hint: N/A
---

# Codebase Audit: iOS savings goals PUL-12/PUL-8 and simulator

iOS is explicitly required by PUL-12 and PUL-8. The branch is structurally sound, but one correctness defect can apply a larger month total than the user approved, and simulator state has four related UX inconsistencies.

- **Date**: 2026-07-11
- **Scope**: iOS savings goals PUL-12/PUL-8 and the plan simulator present on `pul-12-epic`
- **Health**: fair
- **Findings**: 1 critical, 7 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🔴 | architecture | `ios/Pulpe/Domain/Formulas/SavingsPlanCalculator.swift:215` | Checked amounts are added on top of the requested month total during apply. | Subtract checked amounts before allocating open lines; mirror in shared TS. | S |
| 🟡 | code-quality | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:305` | The simulator opens with a modified draft but reports clean state. | Initialize the draft from the current plan. | S |
| 🟡 | code-quality | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:402` | Revert restores values but marks the simulator dirty. | Clear dirty state after revert. | S |
| 🟡 | architecture | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:344` | Redistribution discards manual month edits instead of pinning them. | Feed overrides to the calculator's pinned adjustments. | S |
| 🟡 | ui | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:142` | Non-uniform redistributed cents are falsely represented as one slider value. | Show a variable state and disable the slider until a uniform value is entered. | M |
| 🟡 | ui | `ios/Pulpe/Features/SavingsGoals/Components/GoalDerivedStateCards.swift:63` | Paused/completed goals can show active-only overdue/completion actions. | Gate the prompts to active status. | S |
| 🟡 | tests | `ios/PulpeTests/Domain/Formulas/SavingsPlanCalculatorTests.swift:168` | The checked-line test codifies the incorrect total. | Replace with a total-preservation regression. | S |
| 🟡 | tests | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:258` | Risky simulator transitions have no direct tests. | Add view-model regression and happy-path tests. | M |
| 🟢 | ui | `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:113` | The chart has no VoiceOver value summary. | Expose current/final/target values. | S |

## Top actions

1. Fix month-total allocation in Swift and shared TypeScript, guarded by parity tests.
2. Make simulator baseline, dirty state, pinned redistribution, and variable control state coherent.
3. Gate active-only CTAs and improve the chart's accessibility summary.

## Coverage

- **Scanned**: code-quality, architecture, security, dependencies, performance, tests, ui
- **Skipped**: physical-device visual review; iPad layout because the project targets iPhone only

Validation baseline: `xcodebuild test ... -only-testing:PulpeTests/SavingsPlanCalculatorTests -only-testing:PulpeTests/SavingsGoalStoreTests -only-testing:PulpeTests/SavingsGoalDetailViewModelTests CODE_SIGNING_ALLOWED=NO` => 24 Swift Testing tests passed.

## Remediation

All critical and warning findings above were corrected on 2026-07-11. The chart accessibility minor was corrected in the same pass. Validation after remediation: `pnpm quality` passed; shared calculator suite passed 481 tests; the five scoped iOS suites passed 32 tests; SwiftLint reported no warning in touched files. Visual launch was verified on iPhone 17 Pro Max (iOS 26.5), but the authenticated savings screen could not be traversed because the clean simulator has no account session.
