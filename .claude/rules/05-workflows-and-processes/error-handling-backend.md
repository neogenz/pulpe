---
description: Backend error handling — BusinessException, cause chain, Log or Throw
paths: "backend-nest/src/**/*.ts"
---

# Error Handling (Backend)

## Principle: Log or Throw, Never Both

In a `catch` block, either handle and log, or throw — never both.

- Services **throw** `BusinessException` with context
- `GlobalExceptionFilter` **logs** the error (it's the only place `logger.error()` is called)
- InfoLogger type enforces this at compile-time: no `error` method available

## BusinessException Pattern

```typescript
throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,       // Definition (code + message + httpStatus)
  { id: budgetId },                         // Details (interpolated into client message)
  { userId: user.id, operation: 'findOne' }, // Context (for logs, never sent to client)
  { cause: error },                         // ES2022 cause chain
);
```

### Parameters

| # | Name | Purpose | Goes to client? |
|---|------|---------|----------------|
| 1 | `errorDef` | `ERROR_DEFINITIONS.*` with code, message factory, httpStatus | Yes (code + message) |
| 2 | `details` | Data interpolated into the message | Yes |
| 3 | `loggingContext` | Operation name, userId, entityId — for log enrichment | No (logs only) |
| 4 | `options` | `{ cause: error }` — original error for cause chain | No (logs only) |

### Rules

- **Always** pass `{ cause: error }` when wrapping a caught error
- **Always** include `operation` and `userId` in `loggingContext`
- **Never** put the original error in `loggingContext` — use `cause` parameter
- **Never** use `BadRequestException` or `NotFoundException` directly — use `BusinessException`

## ERROR_DEFINITIONS

Defined in `src/common/exceptions/` or `src/config/error-definitions.ts`:

```typescript
BUDGET_NOT_FOUND: {
  code: 'ERR_BUDGET_NOT_FOUND',
  message: (details) => details?.id
    ? `Budget with ID '${details.id}' not found`
    : 'Budget not found',
  httpStatus: HttpStatus.NOT_FOUND,
}
```

## Standard Error Response

```json
{
  "success": false,
  "statusCode": 404,
  "timestamp": "2026-02-14T10:00:00Z",
  "path": "/api/v1/budgets/123",
  "method": "GET",
  "message": "Budget with ID '123' not found",
  "error": "BusinessException",
  "code": "ERR_BUDGET_NOT_FOUND"
}
```

## Logging Pattern (Split Logger)

| Logger | Available methods | Used by |
|--------|-------------------|---------|
| `InfoLogger` | `info`, `debug`, `warn`, `trace` | All services |
| `PinoLogger` | `error`, `fatal` + all above | GlobalExceptionFilter only |

### Injection

```typescript
import { type InfoLogger, InjectInfoLogger } from '@common/logger';

@Injectable()
export class MyService {
  constructor(
    @InjectInfoLogger(MyService.name)
    private readonly logger: InfoLogger,
  ) {}
}
```

### Module Setup

```typescript
import { createInfoLoggerProvider } from '@common/logger';

@Module({
  providers: [MyService, createInfoLoggerProvider(MyService.name)],
})
export class MyModule {}
```

## Correct Patterns

### Throw Only (standard — most services)

```typescript
async findOne(id: string, supabase: AuthenticatedSupabaseClient) {
  const { data, error } = await supabase.from('budget').select('*').eq('id', id).single();

  if (error || !data) {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
      { id },
      { operation: 'findOne', entityId: id },
      { cause: error },
    );
  }
  return data;
}
```

### Enrichir et Relancer (DB error -> business error)

```typescript
private handleCreationError(error: unknown, userId: string): never {
  const message = (error as { message?: string })?.message;
  if (message?.includes('23505')) {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS,
      { month, year },
    );
  }
  throw new BusinessException(
    ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
    undefined,
    { userId },
    { cause: error },
  );
}
```

### Warn for Non-Blocking Issues

```typescript
// Degradation gracieuse — warn is appropriate
if (!this.config.externalApiKey) {
  this.logger.warn({}, 'External API key not configured, using fallback');
}
```

## Anti-Patterns

```typescript
// NEVER: Log + Throw
catch (error) {
  this.logger.error({ err: error }, 'Failed');  // Log
  throw new BusinessException(...);              // AND throw = duplicate logs
}

// NEVER: Exception without context
throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND);
// Missing: details, loggingContext, cause

// NEVER: BadRequestException for business errors
throw new BadRequestException('Amount too high');
// Use: BusinessException with ERROR_DEFINITIONS

// NEVER: originalError in loggingContext
throw new BusinessException(def, details, { originalError: error });
// Use: { cause: error } as 4th parameter
```

## Log Message Rules

- Messages in **English** (for indexing and search)
- Use `err:` field for Error objects (Pino auto-serializes stack trace)
- Include `operation`, `userId`, `duration` in structured data
- Never log sensitive data (amounts, emails, passwords)
