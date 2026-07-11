# Test Audit: iOS savings goals

Core domain and view-model suites run, but simulator behavior lacks direct regression coverage.

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🟡 | tests | `ios/PulpeTests/Domain/Formulas/SavingsPlanCalculatorTests.swift:168` | The checked-line test expects an applied month total of 800 while the UI requested 500, codifying the allocation bug. | Assert that checked + newly allocated open lines equals the requested total. | S |
| 🟡 | tests | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:258` | There is no direct test for initial cleanliness, revert, pinned redistribution, or variable redistributed amounts. | Add bug-reproduction and happy-path tests for the simulator view model. | M |

## Top actions

1. Correct the allocation expectation in both Swift and shared suites.
2. Add focused simulator view-model tests.
3. Keep UI automation as a later follow-up; unit tests cover the risky state transitions faster.

## Coverage

- **Scanned**: iOS unit suites, UI test inventory, shared calculator parity tests
- **Skipped**: full UI automation run, no savings-goal UI tests exist yet
