# Task: Frontend Maintenance Interceptor

## Problem

When the backend returns a 503 maintenance response, active users with existing sessions need to be redirected to a maintenance page. The frontend currently has no mechanism to handle this specific error case.

## Proposed Solution

Create an HTTP interceptor that catches 503 responses with the `MAINTENANCE` code and redirects users to a maintenance page. The interceptor must be registered before the auth interceptor to avoid retry logic on maintenance responses.

## Dependencies

- None for code (can parallel with Task 1)
- Runtime testing requires Task 1 backend to be complete

## Context

- Existing interceptor pattern: `frontend/projects/webapp/src/app/core/auth/auth-interceptor.ts`
- Interceptor registration: `frontend/projects/webapp/src/app/core/auth/auth-providers.ts`
- Route constants: `frontend/projects/webapp/src/app/core/routing/routes-constants.ts`
- Error response format: `{ statusCode: 503, code: 'MAINTENANCE', message: '...' }`

## Success Criteria

- Route constant `ROUTES.MAINTENANCE` and `PAGE_TITLES.MAINTENANCE` added
- Interceptor catches 503 with `code === 'MAINTENANCE'`
- Redirects to `/maintenance` page via `window.location.href`
- Non-maintenance 503 errors pass through to normal error handling
- Interceptor registered FIRST in provider array (before auth)
