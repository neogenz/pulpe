# Tasks: Error Handling Migration

## Overview

Migrate all NestJS generic exceptions to the standardized `BusinessException` pattern with proper cause chain preservation. Follow the principle: "Log or Throw, Never Both".

## Task List

- [ ] **Task 1**: Add Missing ERROR_DEFINITIONS - `task-01.md`
- [ ] **Task 2**: Migrate UserController - `task-02.md` (depends on Task 1)
- [ ] **Task 3**: Migrate BudgetTemplateService Core CRUD - `task-03.md` (depends on Task 1)
- [ ] **Task 4**: Migrate BudgetTemplateService Template Validation - `task-04.md` (depends on Task 1)
- [ ] **Task 5**: Migrate BudgetTemplateService Template Lines - `task-05.md` (depends on Task 1)
- [ ] **Task 6**: Migrate BudgetTemplateService Bulk Operations - `task-06.md` (depends on Task 1)
- [ ] **Task 7**: Remove Deprecated Error Handlers - `task-07.md` (depends on Tasks 3-6)
- [ ] **Task 8**: (Optional) Audit Remaining Services - `task-08.md` (depends on Task 1)

## Execution Order

```
Task 1 (ERROR_DEFINITIONS)
    │
    ├──→ Task 2 (UserController)
    │
    ├──→ Task 3 (Core CRUD)      ─┐
    ├──→ Task 4 (Validation)      │
    ├──→ Task 5 (Template Lines)  ├──→ Task 7 (Cleanup)
    └──→ Task 6 (Bulk Operations)─┘

    └──→ Task 8 (Optional Audit)
```

**Parallel execution opportunities:**
- Tasks 2, 3, 4, 5, 6 can all run in parallel after Task 1
- Task 8 is independent and optional

## Commit Strategy

One commit per task for easier rollback:
- `refactor(error-handling): add missing ERROR_DEFINITIONS`
- `refactor(error-handling): migrate UserController to BusinessException`
- `refactor(error-handling): migrate BudgetTemplateService core CRUD`
- etc.

## Estimated Impact

| Task | Files | Complexity |
|------|-------|------------|
| 1 | 1 | Low |
| 2 | 1-2 | Medium |
| 3 | 2 | Medium |
| 4 | 2 | Medium |
| 5 | 2-3 | Medium |
| 6 | 2 | Medium |
| 7 | 1 | Low |
| 8 | 4 | Low |
