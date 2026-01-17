# Tasks: Refactor Auth-API Service Split

## Overview

Refactor the 475-line `AuthApi` service into 6 focused, single-responsibility services following clean code principles. The refactored `AuthApi` becomes a lightweight facade that delegates to specialized services, maintaining backward compatibility for 24 consumer files.

**Key Benefit**: Improved testability, maintainability, and adherence to Single Responsibility Principle.

**No Breaking Changes**: Facade pattern preserves exact API surface.

**Critical Change**: Remove budget pre-loading (BudgetApi injection) - guards already handle cache miss gracefully.

## Task List

- [ ] **Task 1**: Create AuthStateService for Signal-Based State Management - `task-01.md`
- [ ] **Task 2**: Create AuthSessionService for Supabase Session Management - `task-02.md` (depends on Task 1)
- [ ] **Task 3**: Create AuthCredentialsService for Email/Password Authentication - `task-03.md` (depends on Tasks 1, 2)
- [ ] **Task 4**: Create AuthOAuthService for Google OAuth Authentication - `task-04.md` (depends on Tasks 1, 2)
- [ ] **Task 5**: Create AuthDemoService for Demo Mode Session Injection - `task-05.md` (depends on Tasks 1, 2)
- [ ] **Task 6**: Create AuthCleanupService for Logout Cleanup Coordination - `task-06.md` (depends on Tasks 1-5)
- [ ] **Task 7**: Refactor AuthApi to Facade Pattern with Service Delegation - `task-07.md` (depends on Tasks 1-6)
- [ ] **Task 8**: Update Barrel Exports for New Auth Services - `task-08.md` (depends on Task 7)

## Execution Order

### Phase 1: Foundation (Sequential)
1. **Task 1** (start here) - No dependencies
2. **Task 2** (after Task 1) - Requires AuthStateService

### Phase 2: Authentication Methods (Parallel)
Tasks 3, 4, and 5 can be done in parallel once Tasks 1-2 are complete:
- **Task 3**: Credentials service
- **Task 4**: OAuth service
- **Task 5**: Demo service

### Phase 3: Coordination (Sequential)
1. **Task 6** (after Tasks 1-5) - Requires all services above
2. **Task 7** (after Task 6) - Facade refactor requires all services
3. **Task 8** (after Task 7) - Export updates finalize the refactor

## Dependency Graph

```
Task 1 (AuthState)
    ↓
Task 2 (AuthSession)
    ↓
    ├─→ Task 3 (Credentials) ─┐
    ├─→ Task 4 (OAuth)        ├─→ Task 6 (Cleanup)
    └─→ Task 5 (Demo)         ┘        ↓
                                  Task 7 (Facade)
                                       ↓
                                  Task 8 (Exports)
```

## Parallelization Opportunities

**Maximum Parallelization**: After completing Tasks 1-2, you can work on Tasks 3, 4, and 5 simultaneously (3 parallel work streams).

**Recommended Approach**:
1. Complete Task 1 (foundation)
2. Complete Task 2 (session management)
3. Work on Tasks 3, 4, 5 in any order or in parallel
4. Complete Task 6 (coordination)
5. Complete Task 7 (facade refactor)
6. Complete Task 8 (exports)

## Testing Strategy

- Each task includes creating unit tests alongside the service
- Run tests after each task: `pnpm test -- auth-<service>.service.spec.ts`
- After Task 7, run full test suite: `pnpm test`
- After Task 8, run E2E tests: `pnpm test:e2e`

## Quality Checks

Before considering the refactor complete:
- [ ] All unit tests pass
- [ ] All E2E tests pass (auth flows, guards, protected routes)
- [ ] Application builds: `pnpm build`
- [ ] Application runs: `pnpm dev`
- [ ] Manual testing checklist complete (see plan.md:337-342)
- [ ] Code quality checks pass: `pnpm quality`

## Success Metrics

- **Line count reduction**: 475 lines → ~60 lines in facade + 6 focused services
- **Test coverage**: Each service has comprehensive unit tests
- **Zero breaking changes**: All 24 consumers work unchanged
- **Improved maintainability**: Each service has single responsibility
- **Simplified testing**: Services can be tested in isolation
