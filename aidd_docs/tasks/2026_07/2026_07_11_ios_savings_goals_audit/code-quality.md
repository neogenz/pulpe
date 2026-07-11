# Code Quality Audit: iOS savings goals

The implementation is generally readable, but simulator state is represented by partially independent flags and values that can disagree.

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🟡 | code-quality | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:305` | Initialization mutates the draft to the recommended amount while `isDirty` remains false. | Initialize from the baseline and derive control state from the draft. | S |
| 🟡 | code-quality | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:402` | `revert()` restores the baseline but leaves `isDirty` true. | Clear dirty state after recomputing the baseline. | S |

## Top actions

1. Make baseline, draft, controls, and dirty state agree.
2. Add focused view-model regression tests before changing behavior.

## Coverage

- **Scanned**: simulator view model, calculator, derived-state cards, naming and state ownership
- **Skipped**: none
