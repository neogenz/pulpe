# Budget Vertical Slice

This is a complete implementation of the budget feature following the vertical slice architecture pattern.

## Architecture Overview

The budget slice is organized into three main layers:

### 1. Domain Layer (`/domain`)
- **Entities**: `Budget` - The core business entity with invariants and business rules
- **Value Objects**: `BudgetPeriod` - Encapsulates month/year validation and operations
- **Repository Interfaces**: `BudgetRepository` - Abstract interface for data persistence
- **Domain Events**: `BudgetCreatedEvent`, `BudgetUpdatedEvent`, `BudgetDeletedEvent`

### 2. Application Layer (`/application`)
- **Commands**: `CreateBudgetCommand`, `UpdateBudgetCommand`, `DeleteBudgetCommand`
- **Queries**: `GetBudgetQuery`, `ListBudgetsQuery`, `GetBudgetByPeriodQuery`
- **Handlers**: Implement CQRS pattern with Result monad for error handling

### 3. Infrastructure Layer (`/infrastructure`)
- **Persistence**: `SupabaseBudgetRepository` - Concrete implementation using Supabase
- **API**: `BudgetController` - RESTful endpoints with Swagger documentation
- **Mappers**: `BudgetMapper` - Handles domain <-> persistence <-> API transformations

## Key Design Decisions

### Domain-Driven Design
- Rich domain model with business logic encapsulated in entities
- Value objects for complex types (BudgetPeriod)
- Domain events for future event-driven features

### CQRS Pattern
- Separate command and query handlers
- Clear separation of read and write operations
- Optimized queries for different use cases

### Result Pattern
- All operations return `Result<T>` for explicit error handling
- No exceptions thrown across layer boundaries
- Type-safe error propagation

### Enhanced Logging
- Structured logging with operation context
- Performance metrics on all operations
- Correlation IDs for request tracking

### Security
- JWT authentication via guards
- Row-level security (RLS) in Supabase
- Rate limiting on all endpoints

## Business Rules

1. **Budget Period Validation**:
   - Month must be between 1-12
   - Year must be between 2020 and current year + 10
   - Budget cannot be more than 2 years in the future

2. **Budget Lifecycle**:
   - Past budgets cannot be edited or deleted (audit trail)
   - Only one budget allowed per user per period
   - Budgets must be created from a template

3. **Atomic Operations**:
   - Budget creation from template is atomic (includes budget lines)
   - Uses database stored procedures for consistency

## Testing Strategy

### Unit Tests
- Domain logic (entities, value objects)
- Command/Query handlers with mocked dependencies
- Mappers for transformation logic

### Integration Tests
- Repository with real Supabase interactions
- End-to-end API tests
- Performance benchmarks

## Migration from Old Module

The new slice runs alongside the old module with:
- New endpoints at `/v2/budgets`
- Same database tables (backward compatible)
- Gradual migration strategy

## Usage Example

```typescript
// Create a budget
POST /v2/budgets
{
  "month": 1,
  "year": 2024,
  "description": "January 2024 Budget",
  "templateId": "template-123"
}

// Get budget by period
GET /v2/budgets/period?month=1&year=2024

// Update budget
PATCH /v2/budgets/{id}
{
  "description": "Updated description"
}

// Delete budget
DELETE /v2/budgets/{id}
```

## Future Enhancements

1. **Event Sourcing**: Store domain events for audit log
2. **Projections**: Read models for complex queries
3. **Saga Pattern**: Multi-step budget operations
4. **GraphQL**: Alternative API for flexible queries
5. **Cache Layer**: Redis for performance optimization