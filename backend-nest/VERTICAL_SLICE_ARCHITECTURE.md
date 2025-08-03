# Vertical Slice Architecture

This document describes the new vertical slice architecture implemented in the NestJS backend.

## Overview

The backend is transitioning from a traditional layered architecture to a vertical slice architecture with Domain-Driven Design (DDD) principles. This approach organizes code by features/business capabilities rather than technical layers.

## Directory Structure

```
src/
├── shared/                      # Shared kernel components
│   ├── domain/                  # Base domain classes
│   │   ├── base-entity.ts      # Base entity with identity
│   │   ├── value-object.ts     # Base value object
│   │   ├── result.ts           # Result pattern for error handling
│   │   └── exceptions/         # Domain exceptions
│   ├── infrastructure/         # Infrastructure patterns
│   │   └── repositories/       # Base repository implementation
│   └── application/            # Application services (future)
│
├── slices/                     # Vertical slices (features)
│   └── [feature]/              # e.g., budget, transaction
│       ├── domain/             # Domain layer
│       │   ├── entities/       # Aggregate roots and entities
│       │   ├── value-objects/  # Value objects
│       │   └── repositories/   # Repository interfaces
│       ├── application/        # Application services
│       ├── infrastructure/     # Infrastructure implementations
│       └── presentation/       # Controllers and DTOs
│
└── modules/                    # Legacy modules (to be migrated)
```

## Core Components

### 1. Base Entity

All domain entities extend `BaseEntity` which provides:
- Unique identity (UUID)
- Timestamp tracking (createdAt, updatedAt)
- Equality comparison based on identity

```typescript
export class Budget extends BaseEntity<BudgetProps> {
  static create(props: BudgetProps, id?: string): Result<Budget> {
    // Factory method with validation
  }
}
```

### 2. Value Objects

Immutable objects compared by value, not identity:
- Enforced immutability via `Object.freeze`
- Equality comparison by properties
- Built-in validation in factory methods

```typescript
export class Money extends ValueObject<MoneyProps> {
  static create(amount: number, currency: string): Result<Money> {
    // Validation and normalization
  }
}
```

### 3. Result Pattern

Explicit error handling without exceptions:
- Type-safe success/failure states
- Forced error handling at compile time
- Better error propagation

```typescript
const result = await repository.findById(id);
if (result.isFailure) {
  // Handle error
  return Result.fail(result.error);
}
const entity = result.value; // Type-safe access
```

### 4. Repository Pattern

Abstraction over data access with Supabase:
- Base repository with common CRUD operations
- Result-based error handling
- Structured logging with Pino
- Domain model mapping

```typescript
export class BudgetRepository extends BaseSupabaseRepository<Budget, Database> {
  protected toDomain(raw: BudgetRow): Budget { }
  protected toPersistence(entity: Budget): BudgetInsert { }
}
```

## SOLID Principles Applied

### Single Responsibility Principle (SRP)
- Each class has one reason to change
- Entities handle business rules
- Value objects handle validation and formatting
- Repositories handle data access

### Open/Closed Principle (OCP)
- Base classes are closed for modification
- Extended through inheritance for new features
- Template method pattern in repositories

### Liskov Substitution Principle (LSP)
- All entities can be used wherever BaseEntity is expected
- All value objects can be compared for equality
- Repository implementations maintain base contract

### Interface Segregation Principle (ISP)
- Small, focused interfaces (IRepository)
- Optional methods separated from required ones
- Domain doesn't depend on infrastructure details

### Dependency Inversion Principle (DIP)
- Domain depends on abstractions (interfaces)
- Infrastructure depends on domain
- No direct database dependencies in domain

## Migration Strategy

1. **Phase 1** (Current): Create shared kernel with base classes
2. **Phase 2**: Migrate existing modules to vertical slices
3. **Phase 3**: Remove legacy module structure
4. **Phase 4**: Implement CQRS patterns where beneficial

## Example: Budget Slice

The budget slice demonstrates the architecture:

```
slices/budget/
├── domain/
│   ├── budget.entity.ts         # Aggregate root
│   ├── money.value-object.ts    # Money with currency
│   └── budget-category.value-object.ts  # Valid categories
├── infrastructure/
│   └── budget.repository.ts     # Supabase implementation
└── application/                 # Use cases (to be added)
```

## Best Practices

1. **Always use Result pattern** for operations that can fail
2. **Validate in factory methods** not constructors
3. **Keep domain pure** - no framework dependencies
4. **Use value objects** for concepts with rules
5. **Test domain logic extensively** with unit tests
6. **Log all operations** with structured logging

## Testing

Each component has comprehensive tests:
- Domain entities: Business rule validation
- Value objects: Immutability and validation
- Repositories: Data mapping and error handling
- Use cases: Application flow and integration

Run tests with:
```bash
bun test src/shared/**/*.spec.ts
bun test src/slices/**/*.spec.ts
```

## Next Steps

1. Complete budget slice with application services
2. Add presentation layer (controllers)
3. Migrate authentication module
4. Implement event sourcing for audit trail