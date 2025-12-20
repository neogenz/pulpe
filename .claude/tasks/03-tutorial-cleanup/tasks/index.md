# Tasks: Tutorial System Cleanup

## Overview

Post-bugfix cleanup to improve code quality in the tutorial system:
- Replace `console.*` with Logger service
- Integrate PostHog analytics for tutorial events
- Extract magic number constant

**Out of scope:** Help Menu dynamic generation (user decision to keep static).

## Task List

- [ ] **Task 1**: Replace console logging with Logger - `task-01.md`
- [ ] **Task 2**: Integrate PostHog analytics - `task-02.md` (depends on Task 1)
- [ ] **Task 3**: Extract tutorial start delay constant - `task-03.md`
- [ ] **Task 4**: Update tests for Logger/Analytics - `task-04.md` (depends on Tasks 1, 2)

## Execution Order

```
Task 1 ─────┬──► Task 2 ──┬──► Task 4
            │             │
Task 3 ─────┴─────────────┘
```

**Parallel work possible:**
- Task 1 and Task 3 can be done simultaneously
- Task 2 depends on Task 1 (needs Logger in place)
- Task 4 depends on both Task 1 and Task 2 (tests both integrations)

## Estimated Scope

| Task | Files Modified | Complexity |
|------|----------------|------------|
| Task 1 | 1 | Low |
| Task 2 | 1 | Low |
| Task 3 | 1 | Trivial |
| Task 4 | 1 | Low |

**Total:** 3 source files + 1 test file

## Files Affected

- `frontend/projects/webapp/src/app/core/tutorial/tutorial.service.ts`
- `frontend/projects/webapp/src/app/core/tutorial/tutorial.service.spec.ts`
- `frontend/projects/webapp/src/app/feature/current-month/current-month.ts`

## Verification

After all tasks complete:
1. Run `pnpm test -- --filter tutorial.service`
2. Manual test: Complete a tour from Help Menu
3. Verify PostHog receives `tutorial_completed` event
