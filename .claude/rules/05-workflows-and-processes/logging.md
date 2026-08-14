---
description: Logging standards and level guidelines for NestJS backend
paths:
  - "backend-nest/**/*.ts"
---

# Logging Standards

## Configuration

- **Development**: Pretty-printed with `pino-pretty`
- **Production**: JSON structured logs
- **Correlation**: Request IDs propagated automatically

## Logger Surface

Services inject `InfoLogger` — `Pick<PinoLogger, 'info' | 'debug' | 'warn' | 'trace'>`, defined in
`backend-nest/src/common/logger/info-logger.interface.ts`. `error()` and `fatal()` are deliberately
absent from it, so on a class typed `InfoLogger` they do not compile. Why they are absent belongs to
`error-handling-backend.md`, which owns the throw-instead-of-log policy.

Infrastructure is the exception and injects the full `PinoLogger`: `GlobalExceptionFilter` — the only
caller of `error()` in the codebase — plus the guards, the middleware and `DebugController`.

## Log Levels

| Level   | Use Case                                   | Available to services |
| ------- | ------------------------------------------ | --------------------- |
| `error` | Server errors (5xx), critical exceptions   | No — infrastructure only |
| `warn`  | Client errors (4xx), abnormal situations   | Yes                   |
| `info`  | Business operations, audit, metrics        | Yes                   |
| `debug` | Technical details (dev only)               | Yes                   |
| `trace` | Fine-grained tracing                       | Yes                   |

## Examples

Pino takes the structured object **first**, the message **second**. Passing the object second makes it
a printf-style argument folded into the message string, losing the structured fields.

```typescript
// Info - business events
this.logger.info({ budgetId, userId }, 'Budget created');

// Warn - client errors or unusual situations
this.logger.warn({ userId, field: 'amount' }, 'Invalid request payload');

// Debug - technical details (dev only)
this.logger.debug({ operation: 'budget.findAll' }, 'Query executed');

// Server failures - never logged here: throw, GlobalExceptionFilter logs it
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
  undefined,
  { userId, operation: 'create' },
  { cause: error },
);
```

## Rules

- **NEVER** log sensitive data (passwords, tokens, personal info)
- **ALWAYS** include relevant context (userId, resourceId)
- **PREFER** structured objects over string interpolation
