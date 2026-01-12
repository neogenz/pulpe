# Task: Add @MainActor to Observable ViewModels and AppState

## Problem

Three `@Observable` classes that drive SwiftUI views are missing class-level `@MainActor` annotation. Per WWDC 2023 "Discover Observation in SwiftUI", ViewModels driving UI should be MainActor-isolated to guarantee thread safety and atomic UI updates.

**Affected classes:**
- `CurrentMonthViewModel` - Has `@MainActor` on methods but not class
- `BudgetDetailsViewModel` - Same issue
- `AppState` - Global app state without MainActor isolation

**Additional minor issues in same files:**
- `AppState`: Magic strings for UserDefaults keys
- `CurrentMonthView`: Preview missing AppState environment

## Proposed Solution

Add `@MainActor` annotation to all three class declarations. While addressing AppState, also centralize UserDefaults keys into a private enum for maintainability. Fix the preview environment issue in CurrentMonthView.

## Dependencies

- None (can start immediately)
- Can be done in parallel with Task 1

## Context

- Key files:
  - `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:127` - CurrentMonthViewModel
  - `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift:215` - BudgetDetailsViewModel
  - `ios/Pulpe/App/AppState.swift:5` - AppState class
  - `ios/Pulpe/App/AppState.swift:25-41` - Magic strings
  - `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:415` - Preview
- Pattern to follow: `OnboardingState` in codebase uses `@Observable` correctly
- Existing services like `APIClient`, `AuthService` are already actors

## Success Criteria

- All three classes have `@Observable @MainActor` annotations
- UserDefaults keys in AppState are centralized in a private enum
- CurrentMonthView preview includes `.environment(AppState())`
- Build succeeds without warnings
- No runtime thread-safety warnings in debug console
