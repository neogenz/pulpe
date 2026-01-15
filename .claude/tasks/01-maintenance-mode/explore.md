# Task: Maintenance Mode Implementation

## Summary

Implement a maintenance mode feature that:
1. Blocks ALL app access when activated (except health endpoints)
2. Displays a maintenance page to users
3. Can be toggled instantly via Railway environment variable (no redeploy needed)
4. Handles both new visitors AND existing sessions

---

## Architecture Decision

**Chosen approach: Backend 503 + Angular Interceptor**

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (NestJS on Railway)                                    │
│  ─────────────────────────────────────────────────────────────  │
│  MAINTENANCE_MODE=true → Middleware returns 503 for ALL routes  │
│  Whitelist: /health, /api/v1/maintenance/status                 │
│                                                                 │
│  Response: { statusCode: 503, code: 'MAINTENANCE', message }    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Angular on Vercel)                                   │
│  ─────────────────────────────────────────────────────────────  │
│  1. maintenanceInterceptor: catch 503 + code=MAINTENANCE        │
│     → Redirect to /maintenance via window.location.href         │
│     → Handles EXISTING sessions                                 │
│                                                                 │
│  2. APP_INITIALIZER: check /maintenance/status at startup       │
│     → Handles NEW visitors                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Codebase Context

### Backend - Existing Middlewares

**PayloadSizeMiddleware** (`backend-nest/src/common/middleware/payload-size.middleware.ts:1-40`)
- Validates payload size for bulk operations
- Uses `ConfigService` for env vars
- Path-specific logic with `req.path.includes()`

**ResponseLoggerMiddleware** (`backend-nest/src/common/middleware/response-logger.middleware.ts:1-53`)
- Logs responses when `DEBUG_HTTP_FULL=true`
- Example of conditional behavior via env var

**Registration Pattern** (`backend-nest/src/app.module.ts:293-296`)
```typescript
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(ResponseLoggerMiddleware, PayloadSizeMiddleware)
    .forRoutes('*');
}
```

### Backend - Environment Configuration

**Environment Schema** (`backend-nest/src/config/environment.ts:4-21`)
- Zod validation for all env vars
- `isProductionLike()` helper for env checks

**Health Endpoints** (`backend-nest/src/main.ts:137-158`)
- `GET /` - Root health check
- `GET /health` - Health status

### Frontend - HTTP Interceptors

**Auth Interceptor** (`frontend/projects/webapp/src/app/core/auth/auth-interceptor.ts:1-96`)
- Functional pattern: `HttpInterceptorFn`
- Redirect pattern: `window.location.href = '/' + ROUTES.LOGIN` (lines 73, 87)
- Full page reload to clear all state

**Error Interceptor** (`frontend/projects/webapp/src/app/core/analytics/http-error-interceptor.ts:1-168`)
- Catches errors, logs to PostHog, re-throws

**Registration** (`frontend/projects/webapp/src/app/core/auth/auth-providers.ts:6-14`)
```typescript
provideHttpClient(
  withInterceptors([
    authInterceptor,      // First
    httpErrorInterceptor, // Second
  ]),
),
```

### Frontend - Routing & Guards

**Routes Constants** (`frontend/projects/webapp/src/app/core/routing/routes-constants.ts:1-40`)
- All routes centralized: `ROUTES.LOGIN`, `ROUTES.APP`, etc.
- Page titles: `PAGE_TITLES`

**Public Routes** (`frontend/projects/webapp/src/app/app.routes.ts:31-34`)
- Legal routes have NO guards (publicly accessible)

**APP_INITIALIZER** (`frontend/projects/webapp/src/app/core/core.ts:122-165`)
- Sequential: config → PostHog → auth
- `withEnabledBlockingInitialNavigation()` blocks until complete

### Frontend - Page Structure

**Welcome Page** (`frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`)
- Standalone component with OnPush
- Full-screen centered layout: `min-h-screen flex items-center justify-center`

**Route Definition** (`frontend/projects/webapp/src/app/feature/welcome/welcome.routes.ts:4-11`)
```typescript
{
  path: '',
  title: PAGE_TITLES.WELCOME,
  loadComponent: () => import('./welcome-page').then((m) => m.default),
}
```

---

## Key Files to Create/Modify

### Backend

| File | Action | Purpose |
|------|--------|---------|
| `backend-nest/src/common/middleware/maintenance.middleware.ts` | **CREATE** | New middleware |
| `backend-nest/src/config/environment.ts` | **MODIFY** | Add MAINTENANCE_MODE to schema |
| `backend-nest/src/app.module.ts` | **MODIFY** | Register middleware with exclude |
| `backend-nest/src/main.ts` | **MODIFY** | Add /api/v1/maintenance/status endpoint |

### Frontend

| File | Action | Purpose |
|------|--------|---------|
| `frontend/.../core/maintenance/maintenance.interceptor.ts` | **CREATE** | New interceptor |
| `frontend/.../core/maintenance/maintenance.service.ts` | **CREATE** | Status check service |
| `frontend/.../core/routing/routes-constants.ts` | **MODIFY** | Add MAINTENANCE route |
| `frontend/.../core/auth/auth-providers.ts` | **MODIFY** | Register interceptor FIRST |
| `frontend/.../feature/maintenance/maintenance-page.ts` | **CREATE** | Maintenance page component |
| `frontend/.../feature/maintenance/maintenance.routes.ts` | **CREATE** | Route config |
| `frontend/.../app.routes.ts` | **MODIFY** | Add maintenance route |
| `frontend/.../core/core.ts` | **MODIFY** | Add status check to APP_INITIALIZER |

---

## Patterns to Follow

### Backend Middleware Pattern

```typescript
// maintenance.middleware.ts
@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const isMaintenanceMode = this.configService.get('MAINTENANCE_MODE') === 'true';

    if (isMaintenanceMode) {
      return res.status(503).json({
        statusCode: 503,
        code: 'MAINTENANCE',
        message: 'Application en maintenance. Veuillez réessayer plus tard.',
      });
    }

    next();
  }
}
```

### Frontend Interceptor Pattern

```typescript
// maintenance.interceptor.ts
export const maintenanceInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logger);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 503 && error.error?.code === 'MAINTENANCE') {
        logger.info('Maintenance mode detected, redirecting...');
        window.location.href = '/' + ROUTES.MAINTENANCE;
        return EMPTY; // Don't propagate error
      }
      return throwError(() => error);
    }),
  );
};
```

### Interceptor Order

```typescript
// auth-providers.ts
withInterceptors([
  maintenanceInterceptor,  // ← FIRST: catch 503 before auth retry
  authInterceptor,
  httpErrorInterceptor,
]),
```

---

## Dependencies

### Backend
- `@nestjs/common` - NestMiddleware, MiddlewareConsumer
- `@nestjs/config` - ConfigService
- `express` - Request, Response, NextFunction

### Frontend
- `@angular/common/http` - HttpInterceptorFn, HttpErrorResponse
- `@angular/router` - Router (for programmatic navigation if needed)
- `rxjs` - catchError, throwError, EMPTY

---

## Toggle Mechanism

**Railway Dashboard:**
1. Go to Railway → Project → Variables
2. Add/modify: `MAINTENANCE_MODE=true`
3. Railway auto-restarts the backend (instant, no redeploy needed)
4. All API calls now return 503

**To disable:**
1. Set `MAINTENANCE_MODE=false` or remove variable
2. Service restarts, normal operation resumes

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| New visitor during maintenance | APP_INITIALIZER check → redirect before app loads |
| Existing session during maintenance | Next API call → 503 → interceptor → redirect |
| Health check probes | Excluded from middleware → always return 200 |
| Maintenance page refresh | No API calls needed → page loads normally |
| Maintenance disabled | 200 responses → normal operation |

---

## Testing Checklist

- [ ] Backend returns 503 when MAINTENANCE_MODE=true
- [ ] Backend returns 200 on /health when in maintenance
- [ ] Backend returns 200 on /api/v1/maintenance/status
- [ ] Frontend redirects on 503 with code=MAINTENANCE
- [ ] Maintenance page displays correctly
- [ ] New visitor blocked at APP_INITIALIZER
- [ ] Existing session redirected on next API call
- [ ] Toggle via Railway works instantly
