# Tasks: Fix Auth Refactoring Issues

## Overview

Fix 6 critical issues discovered during auth module code review. Issues include memory leaks, race conditions, silent failures, dead code, cleanup inconsistencies, and SSR safety concerns across three auth services.

**Total Issues**: 6 across 3 files
**Total Tasks**: 4 focused tasks

## Task List

- [ ] **Task 1**: Fix Resource Cleanup Using DestroyRef - `task-01.md`
  - Issues: #1 (auth subscription leak), #3 (timeout leak)
  - Files: auth-session.service.ts, auth-cleanup.service.ts
  - Effort: Medium (~1.5 hours)

- [ ] **Task 2**: Add SSR Safety and Remove Dead Code - `task-02.md`
  - Issues: #5 (unsafe window access), #6 (dead code)
  - Files: auth-session.service.ts
  - Effort: Small (~30-45 minutes)
  - Depends on: Task 1 (same file conflict)

- [ ] **Task 3**: Fix Error Logging in Auth Credentials Service - `task-03.md`
  - Issue: #4 (silent catch blocks)
  - Files: auth-credentials.service.ts
  - Effort: Small (~45 minutes)
  - Depends on: None (independent)

- [ ] **Task 4**: Unify Cleanup Flow in Sign Out - `task-04.md`
  - Issue: #7 (cleanup inconsistency)
  - Files: auth-session.service.ts
  - Effort: Medium (~1 hour, high risk)
  - Depends on: Tasks 1 and 2 (same file conflict)

## Execution Order

### Sequential Path (Recommended)
1. **Task 1** (critical bugs, establishes patterns)
2. **Task 2** (code cleanup before major changes)
3. **Task 3** (independent, can be done anytime after Task 1)
4. **Task 4** (highest risk, benefits from clean codebase)

### Parallelization Opportunity
- **Task 3** can be done in parallel with Task 2 (different files)
- All other tasks must be sequential due to auth-session.service.ts conflicts

## File Change Summary

| File | Tasks | Issues |
|------|-------|--------|
| auth-session.service.ts | 1, 2, 4 | #1, #5, #6, #7 |
| auth-cleanup.service.ts | 1 | #3 |
| auth-credentials.service.ts | 3 | #4 |

## Quality Gates

After completing all tasks:
- [ ] Run `pnpm quality` (type-check, lint, format)
- [ ] Run `pnpm test` (all unit tests pass)
- [ ] Run `pnpm test:e2e` (E2E tests still work)
- [ ] Manual verification:
  - No console errors about unsubscribed observables or leaked timers
  - Wrong credentials do NOT produce error logs (expected user error)
  - Network failures DO produce error logs (unexpected system error)
