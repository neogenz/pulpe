# Tasks: Fix PayDay Rollover & Period Display

## Overview

This task fixes the **quinzaine bug** in budget period calculation and adds **period display** in the UI.

**Quinzaine Rule:**
- `payDay <= 15` (1ère quinzaine): Budget period starts in the same calendar month
- `payDay > 15` (2ème quinzaine): Budget period starts in the **previous** calendar month

**Example:** Budget "Mars 2026" with payDay=27 → Period: **27 fév - 26 mars**

## Task List

### Foundation Layer
- [ ] **Task 1**: Add Period Calculation Functions to Shared Library - `task-01.md`
- [ ] **Task 2**: Fix SQL Quinzaine Logic in Budget Rollover Function - `task-02.md`

### Testing Layer
- [ ] **Task 3**: Add Unit Tests for Period Functions - `task-03.md` *(depends on Task 1)*
- [ ] **Task 4**: Update Backend Rollover Tests - `task-04.md` *(depends on Task 2)*

### Frontend Data Layer
- [ ] **Task 5**: Add Period Field to CalendarMonth Interface - `task-05.md` *(depends on Task 1)*
- [ ] **Task 6**: Update Budget Mapper with Period Calculation - `task-06.md` *(depends on Tasks 1, 5)*

### Frontend UI Layer
- [ ] **Task 7**: Display Period in Month Tile Component - `task-07.md` *(depends on Task 6)*
- [ ] **Task 8**: Display Period in Budget Details Page - `task-08.md` *(depends on Task 1)*

## Dependency Graph

```
┌──────────┐     ┌──────────┐
│ Task 1   │     │ Task 2   │  ← Foundation (can run in parallel)
│ (Shared) │     │  (SQL)   │
└────┬─────┘     └────┬─────┘
     │                │
     ▼                ▼
┌──────────┐     ┌──────────┐
│ Task 3   │     │ Task 4   │  ← Testing (after their foundation)
│ (Tests)  │     │ (Tests)  │
└────┬─────┘     └──────────┘
     │
     ▼
┌──────────┐
│ Task 5   │  ← Types (after shared functions ready)
│ (Types)  │
└────┬─────┘
     │
     ▼
┌──────────┐     ┌──────────┐
│ Task 6   │     │ Task 8   │  ← Data/UI (Task 8 only needs Task 1)
│ (Mapper) │     │ (Details)│
└────┬─────┘     └──────────┘
     │
     ▼
┌──────────┐
│ Task 7   │  ← UI (after mapper populates data)
│ (Tile)   │
└──────────┘
```

## Execution Order

### Phase 1: Foundation (Parallel)
Start both tasks simultaneously:
1. **Task 1** - Shared library functions
2. **Task 2** - SQL migration

### Phase 2: Testing & Types (After Phase 1)
Once foundation is complete:
3. **Task 3** - Shared library tests *(after Task 1)*
4. **Task 4** - Backend tests *(after Task 2)*
5. **Task 5** - Frontend types *(after Task 1)*

### Phase 3: Frontend Data (After Phase 2)
6. **Task 6** - Budget mapper *(after Tasks 1, 5)*
7. **Task 8** - Budget details page *(after Task 1 - can run in parallel with Task 6)*

### Phase 4: Frontend UI
8. **Task 7** - Month tile display *(after Task 6)*

## Estimated Parallelization

| Time Unit | Active Tasks |
|-----------|--------------|
| T1 | Task 1, Task 2 |
| T2 | Task 3, Task 4, Task 5 |
| T3 | Task 6, Task 8 |
| T4 | Task 7 |

**Total: 4 time units** (vs 8 if sequential)

## Commands Reference

```bash
# Foundation
pnpm build:shared          # Build shared after Task 1
supabase db push           # Apply migration after Task 2 (local only)

# Testing
cd shared && pnpm test     # Run shared tests (Task 3)
cd backend-nest && bun test rollover-payday  # Run backend tests (Task 4)

# Quality Check
pnpm quality               # Run before committing any task
pnpm test                  # All unit tests
```

## Success Criteria (Overall)

- [ ] SQL: Budget "Mars 2026" with payDay=27 starts on 27 fév
- [ ] UI: Period "27 fév - 26 mars" displayed in month tiles
- [ ] UI: Period displayed in budget details header
- [ ] Tests: All shared library tests pass
- [ ] Tests: All backend rollover tests pass
- [ ] Quality: `pnpm quality` passes
