# Tasks: Critical Issues Before Merge

## Overview

Fix 4 critical issues identified during code review:
1. Missing tests for Signup component (412 lines)
2. Missing tests for CurrencyInput component
3. Magic number for password validation (hardcoded `8`)
4. Google OAuth code duplication (3 files)

## Task List

- [ ] **Task 1**: Create Auth Constants - `task-01.md`
- [ ] **Task 2**: Create Google OAuth Button Pattern - `task-02.md` (after Task 1)
- [ ] **Task 3**: Integrate OAuth Button & Constants - `task-03.md` (depends on Tasks 1 & 2)
- [ ] **Task 4**: Create Signup Tests - `task-04.md` (depends on Task 3)
- [ ] **Task 5**: Create CurrencyInput Tests - `task-05.md` (independent)

## Execution Order

```
Task 1 (Auth Constants)
    ↓
Task 2 (OAuth Button Pattern) ←→ Task 5 (CurrencyInput Tests) [parallel]
    ↓
Task 3 (Integration)
    ↓
Task 4 (Signup Tests)
```

### Parallel Opportunities

| Task | Can Run With |
|------|-------------|
| Task 5 | Any task (fully independent) |
| Task 1 | Task 5 |
| Task 2 | Task 5 (after Task 1 completes) |

### Sequential Requirements

| Task | Must Complete First |
|------|-------------------|
| Task 2 | Task 1 |
| Task 3 | Tasks 1 and 2 |
| Task 4 | Task 3 |

## Estimated Time

| Task | Estimate |
|------|----------|
| Task 1 | 15 min |
| Task 2 | 1-2 hours |
| Task 3 | 1 hour |
| Task 4 | 1-2 hours |
| Task 5 | 30-45 min |
| **Total** | ~4-6 hours |

## Recommended Start

Start with **Task 1** (trivial, unlocks Task 2) and **Task 5** (independent) in parallel.

## Completion Verification

After all tasks complete:
1. `pnpm quality` - All checks pass
2. `pnpm test` - All tests pass
3. Manual verification of OAuth flow on all 3 pages
