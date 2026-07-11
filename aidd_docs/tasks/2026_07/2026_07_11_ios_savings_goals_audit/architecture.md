# Architecture Audit: iOS savings goals

Feature placement follows the repository's Domain/Features/Shared boundaries and service protocol pattern.

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🔴 | architecture | `ios/Pulpe/Domain/Formulas/SavingsPlanCalculator.swift:215` | The Swift allocation formula interprets the requested month amount as an open-line subtotal; the plan contract treats it as the complete month total. With checked lines, applying a plan overshoots the displayed total. The mirrored shared formula has the same defect. | Subtract checked amounts before allocating the remaining total, in Swift and shared TypeScript. | S |
| 🟡 | architecture | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:344` | Redistribution ignores per-month overrides even though the domain calculator supports pinned adjustments. | Pass current overrides as pinned adjustments and preserve them. | S |

## Top actions

1. Fix the cross-platform allocation invariant with parity tests.
2. Connect simulator overrides to the existing pinned-adjustment domain API.

## Coverage

- **Scanned**: feature boundaries, service protocol, shared/Swift formula parity, state flow
- **Skipped**: none
