# UI Audit: iOS savings goals

Native UX score: 15/20. Hierarchy and design-token use are strong; simulator state feedback and derived-card relevance need correction.

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🟡 | ui | `ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:142` | After cents-exact redistribution, the control shows one numeric amount and an enabled slider even when month amounts differ. | Present an explicit variable state, disable the slider, and let numeric entry return to a uniform plan. | M |
| 🟡 | ui | `ios/Pulpe/Features/SavingsGoals/Components/GoalDerivedStateCards.swift:63` | Overdue and completion prompts are rendered from flags without checking ACTIVE status, so paused/completed goals can receive irrelevant or duplicate CTAs. | Gate both action cards to active goals. | S |
| 🟢 | ui | `ios/Pulpe/Features/SavingsGoals/Components/GoalProjectionChart.swift:113` | VoiceOver exposes only “Trajectoire d'épargne”, not the current/final/target values conveyed by the chart. | Add a concise accessibility value summarizing the plotted trajectory. | S |

## Top actions

1. Make variable monthly amounts explicit in the global control.
2. Gate derived-state actions by goal status.
3. Add an accessible chart summary.

## Coverage

- **Scanned**: clarity, hierarchy, interaction states, accessibility, Dynamic Type, touch targets, sheets, design tokens, iPhone layout
- **Skipped**: iPad layout, target is configured iPhone-only; physical-device visual review, simulator build only
