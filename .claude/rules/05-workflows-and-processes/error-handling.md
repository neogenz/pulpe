---
description: "Error classification, logging, and Sentry integration"
paths: "frontend/**/core/error-handling/**/*.ts"
---

# Error Handling

## Choosing the Right Type

```
Can the app continue?
├── NO → FatalError (missing config, critical service down)
└── YES → Technical or business?
          ├── TECHNICAL → OperationalError (network, timeout, parse, 500)
          └── BUSINESS → BusinessError (permission, quota, invalid state)
```

| Situation | Type | Why |
|-----------|------|-----|
| Missing config at boot | `FatalError` | App cannot start |
| API returns 500 | `OperationalError` | Technical, retry possible |
| User without permission | `BusinessError` | Business rule, user message |
| Zod fails on API response | `OperationalError` | Technical parse |
| Zod fails on user input | `BusinessError` | Business validation |
| External timeout | `OperationalError` | Technical, retry |
| Quota exceeded | `BusinessError` | Business rule |

## Error Classes

| Class | Severity | Use Case | Sentry Level |
|-------|----------|----------|--------------|
| `FatalError` | `fatal` | App crash, non-recoverable | `fatal` |
| `OperationalError` | `operational` | Technical (API, network, timeout) | `error` |
| `BusinessError` | `business` | Business rule violations | `warning` |

## Error Creation

Always use typed errors with `ErrorCodes`:

```typescript
import { ErrorCodes, FatalError, OperationalError, BusinessError } from '@core/error-handling';

// FatalError - App cannot continue
throw new FatalError(
  ErrorCodes.Fatal.InitializationFailed,
  'Auth endpoint not configured',
  { context: { metadata: { service: 'AuthService' } } }
);

// OperationalError - Technical failure, recoverable
throw new OperationalError(
  ErrorCodes.Operational.ParseError,
  'Invalid response format',
  {
    context: { metadata: { endpoint: '/api/users' } },
    cause: originalError,  // ES2022 cause chaining
  }
);

// BusinessError - Domain rule violation
throw new BusinessError(
  ErrorCodes.Business.QuotaExceeded,
  `Team limit reached (${team.maxMembers})`,
  { context: { metadata: { teamId: team.id } } }
);
```

### Cause Chaining

Always preserve the original error via `cause`:

```typescript
// Good
throw new OperationalError(code, 'Request failed', { cause: originalError });

// Bad - loses original error context
throw new OperationalError(code, 'Request failed');
```

Access cause chain:

```typescript
error.cause;                             // Error | undefined
getRootCause(error);                     // deepest cause
composeErrorMessageWithAllCauses(error); // "Msg - Caused by: Root"
```

## HTTP Interceptor

`errorHttpInterceptor` transforms `HttpErrorResponse` automatically:

| Status | Error Type | Code |
|--------|------------|------|
| 0 | `OperationalError` | `operational.network_error` |
| 403 | `BusinessError` | `business.insufficient_permissions` |
| 404 | `OperationalError` | `operational.resource_not_found` |
| 408, 504 | `OperationalError` | `operational.timeout_error` |
| 409 | `BusinessError` | `business.resource_conflict` |
| 422 | `BusinessError` | `business.business_rule_violation` |
| 4xx | `OperationalError` | `operational.validation_error` |
| 5xx | `OperationalError` | `operational.http_error` |

Handle typed errors in subscriptions:

```typescript
this.#http.get('/api/users').subscribe({
  error: (err) => {
    // Already typed by interceptor
    this.#log.error(err); // Sends to Sentry with handled: true
    if (err instanceof BusinessError) {
      this.#showPermissionDenied();
    } else {
      this.#showRetryOption();
    }
  }
});
```

## Handled vs Unhandled (Crash-Free Sessions)

Sentry distinguishes errors via `mechanism.handled`:

| Path | `handled` | KPI Impact |
|------|-----------|------------|
| `throw` → ErrorHandler | `false` | Session "crashed" |
| `catch` → `LoggingService.error()` | `true` | Session "healthy" |

**Rule:**

- **ErrorHandler** = **unexpected** errors (bugs, broken invariants)
- **LoggingService.error()** = **expected/recoverable** errors (API, timeout)

```typescript
// ❌ Impacts Crash-Free for an expected error
throw new OperationalError(code, 'API timeout');

// ✅ Does not impact Crash-Free
try {
  await this.#api.fetchData();
} catch (error) {
  this.#log.error(error); // handled: true
  this.#showRetryOption();
}
```

## Logging Service

```typescript
readonly #log = inject(LoggingService);

this.#log.debug('msg', { extra: {} });  // Dev only
this.#log.info('msg');                   // Console + breadcrumb
this.#log.warn('msg');                   // Console + breadcrumb
this.#log.error(error, { tags: {} });    // Console + Sentry (prod)
this.#log.setUser({ id, email });
this.#log.addBreadcrumb('action', 'category', data);
```

## Sentry Integration

### Filtered Errors (not sent)

| Pattern | Reason |
|---------|--------|
| `ResizeObserver loop` | Browser noise |
| `ChunkLoadError` | User refresh handles it |
| `Failed to fetch`, `NetworkError` | Client connectivity |
| `401 Unauthorized` | Normal auth flow |
| `chrome://`, `moz-extension://` | Browser extensions |

### Fingerprinting (error grouping)

URLs are sanitized for grouping:

- `/users/123` → `/users/[id]`
- `/orders/550e8400-...` → `/orders/[uuid]`
- `/reports/2024-01-15` → `/reports/[date]`

### Sanitized Data

Keys filtered from Sentry: `password`, `token`, `secret`, `authorization`, `cookie`, `apikey`

Headers excluded: `authorization`, `cookie`, `x-api-key`, `x-auth-token`, `x-csrf-token`

## Extending ErrorCodes

Add domain-specific codes to `error-codes.ts`:

```typescript
export const ErrorCodes = {
  // existing...
  Order: {
    NotFound: 'order.not_found',
    AlreadyProcessed: 'order.already_processed',
  },
} as const;

export type OrderErrorCode = (typeof ErrorCodes.Order)[keyof typeof ErrorCodes.Order];
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `throw new Error('msg')` | `throw new OperationalError(code, 'msg')` |
| `catch (e) { throw new Error(e.message) }` | `catch (e) { throw new OperationalError(code, 'msg', { cause: e }) }` |
| Log passwords/tokens | Use context.metadata for safe data only |
| Catch and swallow errors silently | Log via `LoggingService.error()` |

## Reference

See your project's error-handling module documentation for implementation details.