# Implementation Plan: Maintenance Mode

## Overview

Implement a toggle-able maintenance mode that blocks all app access when activated via Railway environment variable. The solution uses a two-layer approach:
1. **Backend middleware** returns 503 for all requests (except health endpoints)
2. **Frontend interceptor** catches 503 and redirects to maintenance page

This handles both new visitors (blocked at app startup) AND existing sessions (blocked on next API call).

## Dependencies Order

```
1. Backend: environment.ts (add MAINTENANCE_MODE var)
2. Backend: maintenance.middleware.ts (create)
3. Backend: app.module.ts (register middleware)
4. Backend: main.ts (add /maintenance/status endpoint)
5. Frontend: routes-constants.ts (add MAINTENANCE route)
6. Frontend: maintenance.interceptor.ts (create)
7. Frontend: auth-providers.ts (register interceptor)
8. Frontend: maintenance-page.ts (create)
9. Frontend: maintenance.routes.ts (create)
10. Frontend: app.routes.ts (add route)
11. Frontend: core.ts (add startup check)
```

---

## File Changes

### Backend

#### `backend-nest/src/config/environment.ts`

**Line 20**: Add MAINTENANCE_MODE to envSchema
- Add `MAINTENANCE_MODE: z.string().optional()` after DEBUG_HTTP_FULL
- Pattern: Follow existing optional string vars like `DEBUG_HTTP_FULL` (line 20)
- No validation transform needed (simple string comparison in middleware)

---

#### `backend-nest/src/common/middleware/maintenance.middleware.ts` [CREATE]

**Purpose**: Block all requests when maintenance mode is active

- Create new file in `common/middleware/` folder
- Pattern: Follow `PayloadSizeMiddleware` structure (lines 13-39)
- Implement `NestMiddleware` interface
- Inject `ConfigService` in constructor
- In `use()` method:
  - Check `this.configService.get('MAINTENANCE_MODE') === 'true'`
  - If true: return `res.status(503).json({ statusCode: 503, code: 'MAINTENANCE', message: 'Application en maintenance. Veuillez réessayer plus tard.' })`
  - If false: call `next()`
- Add JSDoc comment explaining purpose
- Consider: Log when maintenance mode blocks a request (optional, useful for debugging)

---

#### `backend-nest/src/app.module.ts`

**Line 38**: Add import for MaintenanceMiddleware
- Import alongside existing middleware imports

**Line 289**: Add MaintenanceMiddleware to providers array
- Add to providers list with other middleware (lines 288-289)

**Lines 293-296**: Register middleware with exclusions
- Add `consumer.apply(MaintenanceMiddleware).exclude({ path: 'health', method: RequestMethod.GET }, { path: '/', method: RequestMethod.GET }).forRoutes('*');`
- Must be FIRST middleware applied (before ResponseLogger and PayloadSize)
- Pattern: Use `exclude()` method to whitelist health endpoints
- Import `RequestMethod` from `@nestjs/common` (already imported line 2)

---

#### `backend-nest/src/main.ts`

**Lines 148-150**: Add maintenance status endpoint in `setupHealthEndpoints()`
- Add new endpoint: `app.getHttpAdapter().get('/api/v1/maintenance/status', ...)`
- Handler returns: `res.json({ maintenanceMode: configService.get('MAINTENANCE_MODE') === 'true', message: 'Application en maintenance. Veuillez réessayer plus tard.' })`
- Pattern: Follow existing health endpoint pattern (lines 141-150)
- Endpoint is public (no auth required) for frontend startup check
- Consider: Add to exclude list in maintenance middleware (already handled by API prefix exclusion)

---

### Frontend

#### `frontend/projects/webapp/src/app/core/routing/routes-constants.ts`

**Line 12**: Add MAINTENANCE route constant
- Add `MAINTENANCE: 'maintenance',` after LEGAL entry
- Pattern: Follow existing route constant naming

**Line 38**: Add MAINTENANCE page title
- Add `MAINTENANCE: 'Maintenance',` to PAGE_TITLES

---

#### `frontend/projects/webapp/src/app/core/maintenance/maintenance.interceptor.ts` [CREATE]

**Purpose**: Catch 503 maintenance errors and redirect

- Create new folder `core/maintenance/`
- Create file `maintenance.interceptor.ts`
- Pattern: Follow `auth-interceptor.ts` functional pattern (lines 13-30)
- Export `maintenanceInterceptor: HttpInterceptorFn`
- Use `inject(Logger)` for logging
- In pipe:
  - Use `catchError((error: HttpErrorResponse) => ...)`
  - Check: `error.status === 503 && error.error?.code === 'MAINTENANCE'`
  - If match: log info, then `window.location.href = '/' + ROUTES.MAINTENANCE`
  - Return `EMPTY` to stop error propagation (import from rxjs)
  - Else: `throwError(() => error)` to pass to next handler
- Consider: Skip if already on maintenance page (check `window.location.pathname`)

---

#### `frontend/projects/webapp/src/app/core/maintenance/index.ts` [CREATE]

**Purpose**: Barrel export for maintenance module

- Export `maintenanceInterceptor` from `./maintenance.interceptor`
- Pattern: Follow `core/auth/index.ts` structure

---

#### `frontend/projects/webapp/src/app/core/auth/auth-providers.ts`

**Line 3**: Add import for maintenanceInterceptor
- Import from `../maintenance`

**Lines 9-12**: Add maintenanceInterceptor FIRST in array
- Must be BEFORE authInterceptor (to avoid auth retry on 503)
- Order: `maintenanceInterceptor, authInterceptor, httpErrorInterceptor`
- Rationale: Maintenance check should short-circuit before any auth logic

---

#### `frontend/projects/webapp/src/app/feature/maintenance/maintenance-page.ts` [CREATE]

**Purpose**: Static maintenance page displayed to users

- Create new folder `feature/maintenance/`
- Create standalone component with OnPush change detection
- Pattern: Follow `terms-of-service.ts` structure (simple static page)
- Template:
  - Full-screen centered layout: `min-h-screen flex items-center justify-center bg-surface`
  - Card with Material styling
  - Icon: `build` or `engineering` from Material icons
  - Title: "Maintenance en cours"
  - Message: "L'application est temporairement indisponible. Veuillez réessayer dans quelques instants."
  - Optional: Add Lottie animation for polish (maintenance animation)
- Imports: MatCardModule, MatIconModule, MatButtonModule
- No logic needed, purely presentational
- Consider: Add "Réessayer" button that reloads the page

---

#### `frontend/projects/webapp/src/app/feature/maintenance/maintenance.routes.ts` [CREATE]

**Purpose**: Route configuration for maintenance page

- Pattern: Follow `welcome.routes.ts` structure (lines 4-11)
- Single route with path '', title PAGE_TITLES.MAINTENANCE
- Use `loadComponent: () => import('./maintenance-page')`
- Default export: Routes array

---

#### `frontend/projects/webapp/src/app/app.routes.ts`

**Lines 30-34**: Add maintenance route (before legal, after signup)
- Add route object:
  ```
  {
    path: ROUTES.MAINTENANCE,
    title: PAGE_TITLES.MAINTENANCE,
    loadChildren: () => import('./feature/maintenance/maintenance.routes'),
  }
  ```
- NO guards (must be accessible when backend is in maintenance)
- Pattern: Follow LEGAL route structure (no guard, lazy loaded)

---

#### `frontend/projects/webapp/src/app/core/core.ts`

**Lines 129-132**: Add maintenance check after config load

- After `await applicationConfig.initialize();` (line 130)
- Before logging app info (line 132)
- Add maintenance status check:
  - Fetch `${applicationConfig.backendApiUrl()}/v1/maintenance/status`
  - If response.maintenanceMode === true AND not already on maintenance page:
    - `window.location.href = '/' + ROUTES.MAINTENANCE`
    - Return early (don't continue initialization)
  - If fetch fails: continue (fail gracefully, backend might be down)
- Import ROUTES from routing
- Consider: Add Logger call for debugging

---

## Testing Strategy

### Unit Tests

**Backend:**
- `maintenance.middleware.spec.ts` [CREATE]
  - Test: Returns 503 when MAINTENANCE_MODE=true
  - Test: Calls next() when MAINTENANCE_MODE=false
  - Test: Calls next() when MAINTENANCE_MODE undefined
  - Mock: ConfigService

**Frontend:**
- `maintenance.interceptor.spec.ts` [CREATE]
  - Test: Redirects on 503 with code=MAINTENANCE
  - Test: Passes through 503 without MAINTENANCE code
  - Test: Passes through other error codes (401, 500)
  - Mock: Logger, window.location

### Integration Tests

- `maintenance.e2e.spec.ts` [CREATE]
  - Test: With MAINTENANCE_MODE=true, all API calls return 503
  - Test: With MAINTENANCE_MODE=true, /health returns 200
  - Test: With MAINTENANCE_MODE=false, API calls work normally

### Manual Verification

1. Set `MAINTENANCE_MODE=true` locally in backend `.env`
2. Start backend, verify `/health` returns 200
3. Start frontend, verify redirect to `/maintenance`
4. Verify maintenance page displays correctly
5. Set `MAINTENANCE_MODE=false`, restart backend
6. Verify app works normally

---

## Documentation

No documentation updates required for this internal feature.

---

## Rollout Considerations

### Toggle Mechanism

- **Enable**: Set `MAINTENANCE_MODE=true` in Railway variables
- **Disable**: Set `MAINTENANCE_MODE=false` or remove variable
- Railway auto-restarts backend (~10-30 seconds)
- No frontend deployment needed

### Monitoring

- Consider adding PostHog event when maintenance mode blocks a user
- Backend logs will show 503 responses

### Rollback

- If issues occur: Remove MAINTENANCE_MODE variable
- Backend restarts, normal operation resumes
- No database changes, no migrations

---

## Files Summary

| File | Action | Priority |
|------|--------|----------|
| `backend-nest/src/config/environment.ts` | Modify | 1 |
| `backend-nest/src/common/middleware/maintenance.middleware.ts` | Create | 2 |
| `backend-nest/src/app.module.ts` | Modify | 3 |
| `backend-nest/src/main.ts` | Modify | 4 |
| `frontend/.../core/routing/routes-constants.ts` | Modify | 5 |
| `frontend/.../core/maintenance/maintenance.interceptor.ts` | Create | 6 |
| `frontend/.../core/maintenance/index.ts` | Create | 7 |
| `frontend/.../core/auth/auth-providers.ts` | Modify | 8 |
| `frontend/.../feature/maintenance/maintenance-page.ts` | Create | 9 |
| `frontend/.../feature/maintenance/maintenance.routes.ts` | Create | 10 |
| `frontend/.../app.routes.ts` | Modify | 11 |
| `frontend/.../core/core.ts` | Modify | 12 |
