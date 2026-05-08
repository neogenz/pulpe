# 0005 — Error handling via `BusinessException`

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

We had three competing patterns: throwing `BadRequestException` / `NotFoundException` directly from services, wrapping errors with `try/catch` + `logger.error` + rethrow (producing duplicated logs), and ad-hoc string error codes in responses. Clients had no stable error code; logs duplicated; root causes vanished.

We also discovered that `pino` accepts `error` as a top-level method on the logger, which made it too easy to log inside `catch` blocks AND throw — producing the same error twice in the log stream.

## Decision

Three rules, enforced at compile time and runtime:

1. **Throw `BusinessException`, never NestJS HTTP exceptions.** Services and use cases throw `BusinessException(ERROR_DEFINITIONS.X, details, loggingContext, { cause })`. The fourth argument carries the original error via the ES2022 cause chain.
2. **One place logs.** `GlobalExceptionFilter` (`backend-nest/src/common/filters/global-exception.filter.ts`) is the only place that calls `logger.error`. Everywhere else uses `InfoLogger`.
3. **`InfoLogger` has no `error` method.** The interface (`backend-nest/src/common/logger/info-logger.interface.ts`) exposes `info`, `warn`, `debug`, `trace` only. Compile-time enforcement of "log or throw, never both."

```typescript
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id: budgetId },                              // details (interpolated, sent to client)
  { userId: user.id, operation: 'findOne' },     // logging context (logs only)
  { cause: error },                              // ES2022 cause chain (logs only)
);
```

## Consequences

- Positive: error responses have a stable `code` (e.g., `ERR_BUDGET_NOT_FOUND`) clients can branch on.
- Positive: logs are deduplicated — one error, one log line, with the cause chain attached.
- Positive: `loggingContext` carries operation + userId for fast querying without ever leaking to the client.
- Negative: `ERROR_DEFINITIONS` is a registry that must be maintained. Cost is low; benefit is enumerable error codes.
- Negative: developers must remember the four-arg signature. Mitigated by the rule + sample patterns in `.claude/rules/05-workflows-and-processes/error-handling-backend.md`.

## Alternatives considered

- Per-module exception classes: rejected as fragmentation. One `BusinessException` + a registry of definitions is enough.
- Returning Result types: rejected — incompatible with NestJS interceptor model and adds noise.
- Allow `logger.error` in services: rejected. The duplicate-log incident drove the split-logger design.

## References

- `backend-nest/src/common/exceptions/business.exception.ts`
- `backend-nest/src/common/constants/error-definitions.ts`
- `backend-nest/src/common/filters/global-exception.filter.ts`
- `backend-nest/src/common/logger/info-logger.interface.ts`
- `.claude/rules/05-workflows-and-processes/error-handling-backend.md`
