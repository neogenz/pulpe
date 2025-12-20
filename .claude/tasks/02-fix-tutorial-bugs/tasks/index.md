# Tasks: Fix Tutorial Duplicate Event Listeners

## Overview

Fix the critical bug where Shepherd.js event listeners accumulate when `startTour()` is called multiple times. The solution adds `off()` calls before `on()` to ensure clean listener state.

## Task List

- [ ] **Task 1:** Add Event Listener Cleanup in Tutorial Service - `task-01.md`
- [ ] **Task 2:** Add Event Handler Tests for Tutorial Service - `task-02.md` (depends on Task 1)

## Execution Order

1. **Task 1** must be completed first (service fix)
2. **Task 2** can only be done after Task 1 (tests verify the fix)

## Estimated Effort

- Task 1: ~15-30 minutes (small code change)
- Task 2: ~45-60 minutes (mock update + 4 new tests)

## Verification

After both tasks complete:
```bash
cd frontend && pnpm test -- --filter tutorial.service
```

All tests must pass (31 existing + 4 new = 35+ total).
