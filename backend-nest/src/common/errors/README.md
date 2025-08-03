# Error Handling System

This directory contains a comprehensive error handling system for the NestJS backend. It provides domain-specific exceptions, structured error responses, automatic error transformation, and consistent logging.

## Architecture Overview

```
errors/
├── Domain Exceptions (shared/domain/exceptions/)
│   ├── Base exceptions (DomainException)
│   ├── Business logic exceptions
│   ├── Infrastructure exceptions
│   └── Application exceptions
├── Error Codes (constants/)
│   ├── Standardized error codes enum
│   └── HTTP status mappings
├── Error DTOs (dto/)
│   ├── Swagger documentation DTOs
│   └── Response examples
├── Utilities (utils/)
│   ├── ErrorMapper - Maps exceptions to HTTP responses
│   └── ErrorHandler - Wraps operations with error handling
└── Filters (filters/)
    └── GlobalExceptionFilter - Catches and formats all exceptions
```

## Quick Start

### 1. Basic Exception Throwing

```typescript
import { 
  EntityNotFoundException,
  ValidationException,
  BusinessRuleViolationException 
} from '@/common/errors';

// Entity not found
throw new EntityNotFoundException('User', userId);

// Validation errors
throw new ValidationException({
  email: ['Invalid email format', 'Email already exists'],
  password: ['Password too short']
});

// Business rule violations
throw new BusinessRuleViolationException('Insufficient balance');
```

### 2. Using ErrorHandler in Services

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ErrorHandler } from '@/common/errors';

@Injectable()
export class UserService {
  private readonly errorHandler: ErrorHandler;

  constructor(
    @InjectPinoLogger(UserService.name)
    private readonly logger: PinoLogger,
  ) {
    this.errorHandler = ErrorHandler.forService(UserService.name, logger);
  }

  async createUser(input: CreateUserDto): Promise<User> {
    return this.errorHandler.handleAsync(
      async () => {
        // Your business logic here
        const user = await this.userRepository.create(input);
        return user;
      },
      {
        operation: 'createUser',
        metadata: { email: input.email }
      }
    );
  }
}
```

### 3. Database Error Handling

```typescript
async updateUser(userId: string, data: UpdateUserDto): Promise<User> {
  return this.errorHandler.handleDatabase(
    async () => {
      const { data: user, error } = await this.supabase
        .from('users')
        .update(data)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return user;
    },
    'updateUser',
    { userId }
  );
}
```

### 4. External Service Calls

```typescript
async syncWithExternalAPI(userId: string): Promise<void> {
  await this.errorHandler.handleExternalService(
    async () => {
      const response = await fetch('https://api.example.com/sync', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    },
    'ExternalAPI',
    'syncUser',
    5000, // 5 second timeout
    { userId }
  );
}
```

### 5. Result Pattern

```typescript
import { Result } from '@/shared/domain/result';

async transferMoney(
  fromId: string,
  toId: string,
  amount: number
): Promise<Result<Transaction, Error>> {
  return this.errorHandler.handleResult(
    async () => {
      // Check balance
      const balance = await this.getBalance(fromId);
      if (balance < amount) {
        return Result.fail(
          new BusinessRuleViolationException('Insufficient funds')
        );
      }

      // Perform transfer
      const transaction = await this.executeTransfer(fromId, toId, amount);
      return Result.ok(transaction);
    },
    {
      operation: 'transferMoney',
      metadata: { fromId, toId, amount }
    }
  );
}
```

## Exception Types

### Domain Exceptions

- **EntityNotFoundException**: When a requested entity doesn't exist
- **ValidationException**: Input validation failures
- **BusinessRuleViolationException**: Business logic violations
- **ConflictException**: Resource conflicts (e.g., duplicates)
- **UnauthorizedException**: Authentication required
- **ForbiddenException**: Insufficient permissions

### Infrastructure Exceptions

- **DatabaseException**: Database operation failures
- **ExternalServiceException**: External API failures
- **TimeoutException**: Operation timeouts

### Application Exceptions

- **RateLimitException**: Rate limit exceeded
- **InvalidOperationException**: Invalid state transitions
- **MissingDataException**: Required data missing

## Error Response Format

All errors are returned in a standardized format:

```json
{
  "success": false,
  "statusCode": 404,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/users/123",
  "method": "GET",
  "message": "User with id 123 not found",
  "error": "EntityNotFoundException",
  "code": "ENTITY_NOT_FOUND",
  "context": {
    "requestId": "req-123",
    "userId": "user-456"
  },
  "details": {
    "entityType": "User",
    "entityId": "123"
  }
}
```

## Swagger Documentation

Use the provided error response examples in your controllers:

```typescript
import { ErrorResponseExamples } from '@/common/errors';

@Controller('users')
export class UserController {
  @Get(':id')
  @ApiResponse(ErrorResponseExamples.NotFound)
  @ApiResponse(ErrorResponseExamples.Unauthorized)
  @ApiResponse(ErrorResponseExamples.InternalServerError)
  async findOne(@Param('id') id: string): Promise<User> {
    // ...
  }
}
```

## Testing Error Handling

```typescript
import { describe, it, expect } from 'bun:test';
import { EntityNotFoundException } from '@/common/errors';

describe('UserService', () => {
  it('should throw EntityNotFoundException when user not found', async () => {
    await expect(service.findUser('invalid-id'))
      .rejects
      .toThrow(EntityNotFoundException);
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: new Error('DB Error') })
        })
      })
    });

    await expect(service.findUser('123'))
      .rejects
      .toThrow(DatabaseException);
  });
});
```

## Best Practices

1. **Use Domain Exceptions**: Always throw domain-specific exceptions rather than generic errors
2. **Provide Context**: Include relevant IDs and operation names in error messages
3. **Log Appropriately**: Use ErrorHandler for automatic structured logging
4. **Handle at the Right Level**: Let exceptions bubble up to the global filter
5. **Document Errors**: Use Swagger decorators to document possible error responses
6. **Test Error Paths**: Write tests for both success and error scenarios

## Migration Guide

To migrate from the basic exception filter to the enhanced one:

1. Update `filters.module.ts`:
```typescript
providers: [
  {
    provide: APP_FILTER,
    useClass: GlobalExceptionFilterEnhanced, // Changed from GlobalExceptionFilter
  },
],
```

2. Replace generic error throwing with domain exceptions:
```typescript
// Before
throw new Error('User not found');
throw new HttpException('Validation failed', 400);

// After
throw new EntityNotFoundException('User', userId);
throw new ValidationException({ field: ['Error message'] });
```

3. Wrap service methods with ErrorHandler:
```typescript
// Before
async createUser(input: CreateUserDto): Promise<User> {
  try {
    const user = await this.repository.create(input);
    this.logger.info('User created');
    return user;
  } catch (error) {
    this.logger.error('Failed to create user', error);
    throw error;
  }
}

// After
async createUser(input: CreateUserDto): Promise<User> {
  return this.errorHandler.handleAsync(
    async () => this.repository.create(input),
    { operation: 'createUser', metadata: { email: input.email } }
  );
}
```

## Environment-Specific Behavior

- **Development**: Includes stack traces, detailed error messages, full context
- **Production**: Sanitized messages, no stack traces, minimal context

Configure via `NODE_ENV` environment variable.