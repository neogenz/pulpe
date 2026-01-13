# Tasks: Fix 4 Important Issues (5, 6, 7, 8)

## Overview

This task breakdown addresses 4 frontend issues that impact user experience and code quality:
- Double API call causing unnecessary network requests
- Silent error handling causing confusing redirect loops
- Race condition causing product tour to re-appear
- Component file exceeding line limit

## Task List

- [ ] **Task 1**: Remove double API call for budget check - `task-01.md` (~15 min)
- [ ] **Task 2**: Improve hasBudgetGuard error handling - `task-02.md` (~30 min) - *depends on Task 1*
- [ ] **Task 3**: Fix Product Tour race condition - `task-03.md` (~30 min)
- [ ] **Task 4**: Extract Turnstile logic to service - `task-04.md` (~1 hour)

## Execution Order

### Parallel Group A (can start immediately)
1. **Task 1**: Remove double API call
3. **Task 3**: Fix Product Tour race condition
4. **Task 4**: Extract Turnstile logic

### Sequential (after Task 1)
2. **Task 2**: Improve hasBudgetGuard error handling

## Dependencies Graph

```
Task 1 ────────┐
               v
          Task 2

Task 3 (independent)

Task 4 (independent)
```

## Recommendations

1. **Start with Task 1** - Quick win, establishes understanding of guard/component flow
2. **Run Tasks 3 and 4 in parallel** - They touch completely different files
3. **Do Task 2 after Task 1** - It builds on understanding of the guard behavior

## Files by Task

| Task | Files Modified | Files Created |
|------|---------------|---------------|
| 1 | complete-profile-page.ts, complete-profile-store.ts, complete-profile-store.spec.ts | - |
| 2 | has-budget.guard.ts, has-budget.guard.spec.ts | - |
| 3 | product-tour.service.ts, product-tour.service.spec.ts | - |
| 4 | welcome-page.ts, welcome-page.spec.ts | turnstile.service.ts, turnstile.service.spec.ts, index.ts |

## Total Estimated Time

~2 hours 15 minutes (with parallel execution: ~1.5 hours)
