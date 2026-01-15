# Task: Frontend Startup Maintenance Check

## Problem

New visitors hitting the application while maintenance is active won't trigger the interceptor until they make an API call. They might see a partially loaded app before being redirected, creating a poor user experience.

## Proposed Solution

Add a maintenance status check during application initialization (in `core.ts`) that redirects to the maintenance page before the app fully loads. This ensures new visitors are immediately shown the maintenance page.

## Dependencies

- Task 1: Needs `/api/v1/maintenance/status` endpoint
- Task 2: Needs `ROUTES.MAINTENANCE` constant
- Task 3: Needs maintenance page to redirect to

## Context

- App initialization: `frontend/projects/webapp/src/app/core/core.ts:129-132`
- Backend API URL: `applicationConfig.backendApiUrl()`
- Status endpoint returns: `{ maintenanceMode: boolean, message: string }`

## Success Criteria

- Startup check fetches `/api/v1/maintenance/status`
- If `maintenanceMode === true`, redirect to `/maintenance` immediately
- If fetch fails, continue normal startup (graceful degradation)
- Check happens after config load, before app initialization completes
- Users already on maintenance page are not redirected in a loop
