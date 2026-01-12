# Task: Implement Widget Smart Stack Relevance

## Problem

Widget TimelineProviders don't implement the `relevance()` method for iOS 17+ Smart Stack prioritization. Per WWDC 2021 "Add intelligence to your widgets", widgets without relevance don't participate in Smart Stack rotation, reducing visibility.

Additionally, `WidgetDataCoordinator` silently returns nil when App Group initialization fails, making debugging extremely difficult.

## Proposed Solution

1. Add `relevance()` method to both `CurrentMonthProvider` and `YearOverviewProvider` that returns higher scores when the budget is negative (over budget = urgent information)
2. Add debug logging to `WidgetDataCoordinator` when UserDefaults initialization fails

## Dependencies

- None (can start immediately)
- Independent of other tasks

## Context

- Key files:
  - `ios/PulpeWidget/Widgets/CurrentMonth/CurrentMonthProvider.swift` - Missing relevance()
  - `ios/PulpeWidget/Widgets/YearOverview/YearOverviewProvider.swift` - Missing relevance()
  - `ios/PulpeWidget/Services/WidgetDataCoordinator.swift:7-9` - Silent nil return
- `TimelineEntryRelevance` structure has `score` (Float) and optional `duration` (TimeInterval)
- Higher score = higher priority in Smart Stack
- Relevance method signature: `func relevance(of entry: Entry) -> TimelineEntryRelevance?`

## Success Criteria

- Both providers implement `relevance()` method
- Negative budget (over budget) returns higher score than positive budget
- `WidgetDataCoordinator` logs error in DEBUG when App Group fails
- Build succeeds for both Pulpe and PulpeWidget schemes
- Widget appears in Smart Stack when budget is over
