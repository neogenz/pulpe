# Task: Maintenance Mode Testing

## Problem

The maintenance mode feature spans backend middleware, frontend interceptor, and startup logic. Without tests, regressions could leave the app unable to enter or exit maintenance mode correctly.

## Proposed Solution

Write unit tests for the backend middleware and frontend interceptor to verify correct behavior. Cover the key scenarios: maintenance enabled, disabled, and edge cases.

## Dependencies

- Task 1: Backend middleware code
- Task 2: Frontend interceptor code
- Task 3: Maintenance page (for E2E if added)
- Task 4: Startup check (for E2E if added)

## Context

- Backend test pattern: `backend-nest/src/**/*.spec.ts`
- Frontend test pattern: `frontend/**/*.spec.ts`
- Test framework: Vitest for frontend, Bun test for backend
- Mocking: `vi.fn()` for frontend, service mocks for backend

## Success Criteria

### Backend Tests (`maintenance.middleware.spec.ts`)
- Returns 503 when `MAINTENANCE_MODE=true`
- Calls `next()` when `MAINTENANCE_MODE=false`
- Calls `next()` when `MAINTENANCE_MODE` undefined

### Frontend Tests (`maintenance.interceptor.spec.ts`)
- Redirects on 503 with `code === 'MAINTENANCE'`
- Passes through 503 without MAINTENANCE code
- Passes through other error codes (401, 500)

### Manual Verification
- Toggle `MAINTENANCE_MODE` locally and verify behavior
