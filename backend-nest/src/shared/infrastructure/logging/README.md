# Enhanced Logging Infrastructure

This module provides a production-ready structured logging system for the Pulpe Budget API, built on top of Pino and NestJS.

## Features

- **Structured Logging**: All logs follow a consistent structure with contextual information
- **Performance Tracking**: Automatic measurement and logging of operation durations
- **Operation Context**: Track userId, requestId, correlationId across operations
- **Error Enrichment**: Automatic error context capture with stack traces
- **Audit Trail**: Built-in audit logging for compliance
- **Log Sampling**: Configurable sampling for high-volume operations
- **Custom Serializers**: Domain-specific object serialization
- **Decorators**: Easy-to-use decorators for common logging patterns

## Usage

### Basic Service Integration

```typescript
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EnhancedLoggerService } from '@shared/infrastructure/logging';

@Injectable()
export class BudgetService {
  constructor(
    @InjectPinoLogger(BudgetService.name)
    private readonly logger: PinoLogger,
    private readonly enhancedLogger: EnhancedLoggerService,
  ) {}

  async createBudget(data: any) {
    const operationId = this.enhancedLogger.startOperation('budget.create', {
      userId: data.userId,
    });

    try {
      const result = await this.performCreation(data);
      this.enhancedLogger.completeOperation(operationId, {
        budgetId: result.id,
      });
      return result;
    } catch (error) {
      this.enhancedLogger.failOperation(operationId, error);
      throw error;
    }
  }
}
```

### Using Decorators

```typescript
import { LogOperation, LogPerformance, LogErrors, LogAudit } from '@shared/infrastructure/logging';

@Injectable()
export class TransactionService {
  constructor(private readonly enhancedLogger: EnhancedLoggerService) {}

  @LogOperation('transaction.create')
  @LogAudit({ action: 'create_transaction', resourceType: 'transaction' })
  async createTransaction(userId: string, data: CreateTransactionDto) {
    // Method automatically logged with performance metrics and audit trail
    return this.repository.create(data);
  }

  @LogPerformance({ warnThreshold: 100, errorThreshold: 500 })
  async calculateBalance(budgetId: string) {
    // Performance automatically tracked and logged
    return this.complexCalculation(budgetId);
  }

  @LogErrors({ sensitiveParams: [1] }) // Redact second parameter
  async processPayment(userId: string, creditCard: string) {
    // Errors automatically logged with context
    return this.paymentGateway.process(creditCard);
  }
}
```

### Command/Query Logging

```typescript
// Log commands (state-changing operations)
await this.enhancedLogger.logCommand('CreateBudget', 
  { userId, budgetData }, 
  async () => {
    return await this.repository.create(budgetData);
  }
);

// Log queries (read operations)
await this.enhancedLogger.logQuery('FindUserBudgets',
  { userId, filters },
  async () => {
    return await this.repository.findByUser(userId, filters);
  }
);
```

### Structured Context Logging

```typescript
// Log with custom context
this.enhancedLogger.logWithContext('info', 'Budget calculation completed', {
  userId: user.id,
  budgetId: budget.id,
  calculationTime: duration,
  resultSummary: summary,
});

// Analytics events
this.enhancedLogger.logAnalytics('budget_shared', {
  budgetId: budget.id,
  sharedWith: recipientEmail,
  permissions: ['read'],
}, { userId: user.id });

// Audit logging
this.enhancedLogger.logAudit('budget_deleted', {
  budgetId: budget.id,
  deletedAt: new Date().toISOString(),
  reason: 'User requested',
}, { userId: user.id, requestId: req.id });
```

### Performance Thresholds

```typescript
// Set custom thresholds for specific operations
this.enhancedLogger.setPerformanceThreshold('budget.calculate', {
  warn: 200,  // Warn if operation takes more than 200ms
  error: 1000, // Error if operation takes more than 1s
});

// Default thresholds are configured for common operations:
// - db.query: warn at 100ms, error at 1s
// - api.request: warn at 300ms, error at 2s
// - business.calculation: warn at 50ms, error at 500ms
```

### Log Sampling

```typescript
// Sample logs for high-volume operations
this.enhancedLogger.logSampled(
  0.1, // 10% sampling rate
  'debug',
  'Transaction processed',
  { transactionId, amount }
);
```

## Middleware

The logging infrastructure includes middleware that automatically:

1. Generates/extracts correlation IDs
2. Logs all HTTP requests/responses
3. Tracks request duration
4. Sanitizes sensitive data
5. Creates audit trails for state-changing operations

## Configuration

Environment variables:

- `LOG_LEVEL`: Override default log level (debug/info/warn/error)
- `PERFORMANCE_MONITORING_ENABLED`: Enable/disable performance tracking
- `SLOW_OPERATION_THRESHOLD`: Threshold for slow operation warnings (ms)
- `CRITICAL_OPERATION_THRESHOLD`: Threshold for critical performance errors (ms)
- `PERFORMANCE_SAMPLING_RATE`: Global performance sampling rate (0-1)

## Best Practices

1. **Always use structured logging**: Pass context objects instead of string interpolation
2. **Include user context**: Always include userId when available
3. **Use appropriate log levels**:
   - `error`: Unrecoverable errors, 5xx responses
   - `warn`: Recoverable errors, 4xx responses, performance warnings
   - `info`: Normal operations, audit trails
   - `debug`: Detailed technical information
4. **Set meaningful operation names**: Use dot notation (e.g., 'budget.create', 'transaction.validate')
5. **Configure performance thresholds**: Set appropriate thresholds for your operations
6. **Use decorators for consistency**: Prefer decorators over manual logging when possible
7. **Sample high-volume logs**: Use sampling to reduce log volume while maintaining visibility

## Testing

Mock the enhanced logger in tests:

```typescript
const mockEnhancedLogger = {
  startOperation: jest.fn().mockReturnValue('op-123'),
  completeOperation: jest.fn(),
  failOperation: jest.fn(),
  logWithContext: jest.fn(),
  logCommand: jest.fn((name, ctx, fn) => fn()),
  logQuery: jest.fn((name, ctx, fn) => fn()),
  // ... other methods
};

// In test module
{
  provide: EnhancedLoggerService,
  useValue: mockEnhancedLogger,
}
```