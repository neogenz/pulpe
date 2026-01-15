# Implementation: Maintenance Mode

## Completed

### Backend
- Added `MAINTENANCE_MODE` optional string to environment schema (`backend-nest/src/config/environment.ts:21`)
- Created `MaintenanceMiddleware` that returns 503 with `code: 'MAINTENANCE'` when enabled (`backend-nest/src/common/middleware/maintenance.middleware.ts`)
- Registered middleware in `AppModule` with exclusions for `/health`, `/`, and `/api/v1/maintenance/status` (`backend-nest/src/app.module.ts:297-304`)
- Added `/api/v1/maintenance/status` public endpoint in `main.ts` (`backend-nest/src/main.ts:154-162`)

### Frontend
- Added `MAINTENANCE` route constant and page title (`frontend/.../core/routing/routes-constants.ts:13,40`)
- Created `maintenanceInterceptor` that catches 503 with code MAINTENANCE and redirects (`frontend/.../core/maintenance/maintenance.interceptor.ts`)
- Created barrel export for maintenance module (`frontend/.../core/maintenance/index.ts`)
- Registered interceptor FIRST in provider chain (`frontend/.../core/auth/auth-providers.ts:11`)
- Created `MaintenancePage` component with centered layout and reload button (`frontend/.../feature/maintenance/maintenance-page.ts`)
- Created maintenance routes (`frontend/.../feature/maintenance/maintenance.routes.ts`)
- Added maintenance route to app routes (no guards, public) (`frontend/.../app.routes.ts:30-34`)
- Added startup check in `APP_INITIALIZER` that redirects if backend is in maintenance mode (`frontend/.../core/core.ts:133-155`)

## Deviations from Plan

None - implementation followed the plan exactly.

## Test Results

- Typecheck: ✓
- Lint: ✓ (only pre-existing warnings unrelated to changes)
- Format: ✓

## Usage

### Enable Maintenance Mode
1. Set `MAINTENANCE_MODE=true` in Railway environment variables
2. Railway auto-restarts backend (~10-30 seconds)
3. All API calls return 503, users are redirected to `/maintenance`

### Disable Maintenance Mode
1. Set `MAINTENANCE_MODE=false` or remove the variable
2. Service restarts, normal operation resumes

## Files Changed

| File | Action |
|------|--------|
| `backend-nest/src/config/environment.ts` | Modified |
| `backend-nest/src/common/middleware/maintenance.middleware.ts` | Created |
| `backend-nest/src/app.module.ts` | Modified |
| `backend-nest/src/main.ts` | Modified |
| `frontend/.../core/routing/routes-constants.ts` | Modified |
| `frontend/.../core/maintenance/maintenance.interceptor.ts` | Created |
| `frontend/.../core/maintenance/index.ts` | Created |
| `frontend/.../core/auth/auth-providers.ts` | Modified |
| `frontend/.../feature/maintenance/maintenance-page.ts` | Created |
| `frontend/.../feature/maintenance/maintenance.routes.ts` | Created |
| `frontend/.../app.routes.ts` | Modified |
| `frontend/.../core/core.ts` | Modified |

## Follow-up Tasks

None - feature is complete and ready for testing.
