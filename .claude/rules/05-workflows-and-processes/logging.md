---
description: Logging standards and level guidelines for NestJS backend
paths: "backend-nest/**/*.ts"
---

# Logging Standards

## Configuration

- **Development**: Pretty-printed with `pino-pretty`
- **Production**: JSON structured logs
- **Correlation**: Request IDs propagated automatically

## Log Levels

| Level   | Use Case                                   |
| ------- | ------------------------------------------ |
| `error` | Server errors (5xx), critical exceptions   |
| `warn`  | Client errors (4xx), abnormal situations   |
| `info`  | Business operations, audit, metrics        |
| `debug` | Technical details (dev only)               |

## Examples

```typescript
// Error - server failures
this.logger.error('Database connection failed', { error: err.message });

// Warn - client errors or unusual situations
this.logger.warn('Invalid request payload', { userId, field: 'amount' });

// Info - business events
this.logger.info('Budget created', { budgetId, userId });

// Debug - technical details (dev only)
this.logger.debug('Query executed', { query, params });
```

## Rules

- **NEVER** log sensitive data (passwords, tokens, personal info)
- **ALWAYS** include relevant context (userId, resourceId)
- **PREFER** structured objects over string interpolation
