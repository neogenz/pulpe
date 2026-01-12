# Tasks: Code Review Fixes - Widget iOS Branch

## Overview

Fix 14 code review issues identified in the `widget_ios` branch. Issues are validated against official Apple documentation (WWDC 2021-2023) and grouped into 6 focused tasks.

**Original issues:** 14 (5 P1, 6 P2, 3 P3)
**Consolidated tasks:** 6

## Task List

### P1 - Critical (Tasks 1-3)

- [ ] **Task 1**: Replace AnyView Anti-Pattern with @ViewBuilder - `task-01.md`
  - Files: AlertsSection.swift, UncheckedTransactionsSection.swift
  - Impact: 10-17% performance improvement

- [ ] **Task 2**: Add @MainActor to Observable ViewModels - `task-02.md`
  - Files: CurrentMonthView.swift, BudgetDetailsView.swift, AppState.swift
  - Includes: UserDefaults keys centralization, preview fix

- [ ] **Task 3**: Add UIBackgroundModes for BGTaskScheduler - `task-03.md`
  - Files: project.yml
  - Impact: Enables background refresh (currently broken)

### P2 - Important (Tasks 4-5)

- [ ] **Task 4**: Optimize DateFormatter Usage - `task-04.md`
  - Files: Budget.swift
  - Impact: Reduces object allocation in list views

- [ ] **Task 5**: Implement Widget Smart Stack Relevance - `task-05.md`
  - Files: CurrentMonthProvider.swift, YearOverviewProvider.swift, WidgetDataCoordinator.swift
  - Impact: Better widget visibility in Smart Stacks

### P2/P3 - Cleanup (Task 6)

- [ ] **Task 6**: Remove Deprecated Code and Fix iOS Checks - `task-06.md`
  - Files: View+Extensions.swift, HeroBalanceCard.swift
  - Impact: Code quality, no deprecation warnings

## Execution Order

### Parallel Execution (Recommended)

**Phase 1 - P1 Critical** (can all run in parallel):
```
Task 1 ──┐
Task 2 ──┼── All independent, no dependencies
Task 3 ──┘
```

**Phase 2 - P2 Important** (can all run in parallel):
```
Task 4 ──┐
Task 5 ──┴── All independent, no dependencies
```

**Phase 3 - Cleanup**:
```
Task 6 ── Run after P1/P2 to verify no breaking changes
```

### Sequential Execution (Alternative)

If running sequentially, follow task numbers 1 → 2 → 3 → 4 → 5 → 6

## Post-Implementation

After all tasks complete:

1. **Regenerate Xcode project** (required after Task 3):
   ```bash
   cd ios && xcodegen generate
   ```

2. **Build verification**:
   ```bash
   xcodebuild -scheme Pulpe -sdk iphonesimulator build
   xcodebuild -scheme PulpeWidget -sdk iphonesimulator build
   ```

3. **Manual testing**:
   - Test CurrentMonthView with empty and populated alerts
   - Test widget refresh behavior
   - Verify Smart Stack appearance

## Files Modified Summary

| Task | Files |
|------|-------|
| 1 | AlertsSection.swift, UncheckedTransactionsSection.swift |
| 2 | CurrentMonthView.swift, BudgetDetailsView.swift, AppState.swift |
| 3 | project.yml |
| 4 | Budget.swift |
| 5 | CurrentMonthProvider.swift, YearOverviewProvider.swift, WidgetDataCoordinator.swift |
| 6 | View+Extensions.swift, HeroBalanceCard.swift |

**Total unique files:** 11
