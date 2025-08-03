# Vertical Slices

This directory contains feature-based vertical slices following Domain-Driven Design principles.

## Structure

Each slice follows this structure:

```
[feature]/
├── domain/              # Domain entities, value objects, and repository interfaces
├── application/         # Use cases and application services
├── infrastructure/      # Repository implementations and external services
└── presentation/        # Controllers, DTOs, and API-related code
```

## Example Usage

To create a new vertical slice, follow these steps:

1. **Create the domain layer** with entities and value objects
2. **Define repository interfaces** in the domain layer
3. **Implement repositories** in the infrastructure layer
4. **Create use cases** in the application layer
5. **Add controllers** in the presentation layer

## Using the Shared Kernel

### Base Entity

```typescript
import { BaseEntity, Result } from '@/shared/domain';

export class YourEntity extends BaseEntity<YourProps> {
  static create(props: YourProps, id?: string): Result<YourEntity> {
    // Validation logic
    if (!props.name) {
      return Result.fail('Name is required');
    }
    
    return Result.ok(new YourEntity(props, id));
  }
}
```

### Value Objects

```typescript
import { ValueObject, Result } from '@/shared/domain';

export class Email extends ValueObject<{ value: string }> {
  static create(email: string): Result<Email> {
    if (!email.includes('@')) {
      return Result.fail('Invalid email format');
    }
    
    return Result.ok(new Email({ value: email.toLowerCase() }));
  }
}
```

### Repository Implementation

```typescript
import { BaseSupabaseRepository } from '@/shared/infrastructure';

export class YourRepository extends BaseSupabaseRepository<YourEntity, Database> {
  protected readonly tableName = 'your_table';
  
  protected toDomain(raw: any): YourEntity {
    // Map database row to domain entity
  }
  
  protected toPersistence(entity: YourEntity): any {
    // Map domain entity to database format
  }
}
```

## Migration Guide

When migrating from the old module structure:

1. Move domain logic to `domain/` directory
2. Extract repository interfaces from services
3. Move data access to `infrastructure/`
4. Create proper value objects for domain concepts
5. Use Result pattern for error handling
6. Add comprehensive unit tests