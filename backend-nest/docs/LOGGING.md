# Logging

NestJS uses `nestjs-pino`. Development logs are pretty-printed; preview and production emit
structured JSON. The active configuration, redaction list, request serializers, and request-id
generator live in `src/app.module.ts`.

## Log or throw

Application services inject `InfoLogger`, which exposes only `trace`, `debug`, `info`, and
`warn`. A failure that must reach the caller is wrapped in `BusinessException` and thrown; it
is not logged at the same layer.

`GlobalExceptionFilter` owns terminal error logging. Infrastructure that cannot propagate an
error may inject the full `PinoLogger`, but this is the exception rather than the service
default.

```typescript
this.logger.info({ userId, operation: 'refresh' }, 'Refresh completed');

throw new BusinessException(
  ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
  { id },
  { userId, operation: 'findBudget' },
  { cause: error },
);
```

## Levels

- `trace`: very fine local diagnostics;
- `debug`: development detail and expected rejected inputs;
- `info`: lifecycle events and successful operations worth retaining;
- `warn`: degraded but handled behaviour;
- `error`/`fatal`: terminal infrastructure and exception-filter paths only.

## Privacy

Never log tokens, keys, request bodies containing financial values, user-entered labels, or
raw provider payloads. Pino redaction is defense in depth, not permission to attach sensitive
objects. `src/test/redaction.spec.ts` is the executable contract for serializers and redaction.

## Correlation and debugging

Every request receives a request ID through `src/common/utils/request-id.ts`; propagate
structured context instead of embedding identifiers in message strings. Preview can enable
detailed HTTP diagnostics with `DEBUG_HTTP_FULL=true`; production deliberately ignores that
request.

The concise coding rules live in
`.claude/rules/05-workflows-and-processes/{logging,error-handling-backend}.md`.
