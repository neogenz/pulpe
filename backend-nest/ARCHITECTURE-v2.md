# Vertical Slice Architecture Documentation v2

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Architecture Layers](#architecture-layers)
4. [Project Structure](#project-structure)
5. [Key Patterns](#key-patterns)
6. [Working with the Architecture](#working-with-the-architecture)
7. [Testing Strategy](#testing-strategy)
8. [Security & Monitoring](#security--monitoring)
9. [API Design](#api-design)
10. [Migration Guide](#migration-guide)
11. [Best Practices](#best-practices)
12. [Examples](#examples)

## Overview

This document describes the vertical slice architecture implementation for the Pulpe Budget backend. The architecture follows Domain-Driven Design (DDD) principles, CQRS pattern, and clean architecture concepts to create a maintainable, scalable, and testable backend system.

### Why Vertical Slice Architecture?

Traditional layered architecture organizes code by technical concerns (controllers, services, repositories). Vertical slice architecture organizes code by features, where each feature contains all the code needed to implement a specific business capability from API to database.

**Benefits:**
- **Feature Isolation**: Changes to one feature don't affect others
- **Team Scalability**: Different developers can work on different slices without conflicts
- **Clear Boundaries**: Each slice has explicit dependencies and contracts
- **Easier Testing**: Test entire features in isolation
- **Maintainability**: Related code lives together, making it easier to understand and modify

## Core Principles

### 1. SOLID Principles

- **Single Responsibility**: Each class has one reason to change
- **Open/Closed**: Classes are open for extension but closed for modification
- **Liskov Substitution**: Derived classes properly substitute base classes
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

### 2. Domain-Driven Design (DDD)

- **Rich Domain Models**: Business logic lives in domain entities
- **Value Objects**: Immutable objects for domain concepts
- **Aggregates**: Consistency boundaries for related entities
- **Domain Events**: Decouple features through events
- **Ubiquitous Language**: Code reflects business terminology

### 3. Clean Architecture

- **Independence**: Business logic doesn't depend on frameworks
- **Testability**: Business rules can be tested without UI, database, or external services
- **Framework Agnostic**: The architecture doesn't depend on NestJS specifics in the domain layer

### 4. KISS (Keep It Simple, Stupid)

- **No Over-Engineering**: Use patterns only when they provide clear value
- **Pragmatic Choices**: Balance purity with practicality
- **Single Developer Friendly**: Architecture suitable for small teams

## Architecture Layers

Each vertical slice contains three main layers:

### 1. Domain Layer (`domain/`)

The heart of the business logic, completely framework-agnostic.

**Components:**
- **Entities**: Core business objects with identity and behavior
- **Value Objects**: Immutable objects representing domain concepts
- **Domain Events**: Important business occurrences
- **Repository Interfaces**: Contracts for data persistence
- **Domain Services**: Business logic spanning multiple entities

**Example:**
```typescript
// domain/entities/budget.entity.ts
export class Budget extends BaseEntity<BudgetProps> {
  static create(props: CreateBudgetProps): Result<Budget> {
    // Business validation
    if (props.description.length > 500) {
      return Result.fail('Description too long');
    }
    // Create with business rules enforced
    return Result.ok(new Budget(props));
  }
}
```

### 2. Application Layer (`application/`)

Orchestrates use cases and coordinates domain objects.

**Components:**
- **Commands**: Write operations (Create, Update, Delete)
- **Queries**: Read operations
- **Handlers**: Implement use cases using domain objects
- **DTOs**: Data transfer objects for use case inputs

**Example:**
```typescript
// application/handlers/create-budget.handler.ts
@CommandHandler(CreateBudgetCommand)
export class CreateBudgetHandler {
  async execute(command: CreateBudgetCommand): Promise<Result<string>> {
    // Orchestrate domain logic
    const budgetResult = Budget.create(command);
    if (budgetResult.isFailure) {
      return Result.fail(budgetResult.error);
    }
    // Persist using repository
    const saveResult = await this.repository.save(budgetResult.value);
    return saveResult;
  }
}
```

### 3. Infrastructure Layer (`infrastructure/`)

Implements technical concerns and external integrations.

**Components:**
- **Persistence**: Repository implementations (Supabase)
- **API**: REST controllers and Swagger documentation
- **Mappers**: Transform between layers (Domain ↔ API ↔ DB)
- **External Services**: Third-party integrations

**Example:**
```typescript
// infrastructure/persistence/supabase-budget.repository.ts
export class SupabaseBudgetRepository extends BaseSupabaseRepository implements BudgetRepository {
  async save(budget: Budget): Promise<Result<Budget>> {
    const data = BudgetMapper.toPersistence(budget);
    const result = await this.executeCommand(
      () => this.client.from('budgets').upsert(data),
      'save_budget'
    );
    return Result.ok(BudgetMapper.toDomain(result.data));
  }
}
```

## Project Structure

```
backend-nest/
├── src/
│   ├── shared/                         # Shared kernel
│   │   ├── domain/                     # Base classes and utilities
│   │   │   ├── base-entity.ts         # Base entity class
│   │   │   ├── value-object.ts        # Base value object
│   │   │   ├── result.ts              # Result pattern
│   │   │   └── exceptions/            # Domain exceptions
│   │   └── infrastructure/
│   │       ├── logging/               # Enhanced logging
│   │       ├── security/              # Auth guards, decorators
│   │       └── repositories/          # Base repository
│   │
│   ├── slices/                        # Vertical slices
│   │   ├── budgets/                   # Budget management feature
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   ├── value-objects/
│   │   │   │   ├── events/
│   │   │   │   └── repositories/
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   └── handlers/
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   └── api/
│   │   │   ├── tests/
│   │   │   │   ├── unit/
│   │   │   │   └── integration/
│   │   │   ├── budget.module.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── transactions/              # Transaction tracking
│   │   ├── users/                     # User management
│   │   ├── auth/                      # Authentication
│   │   ├── budget-lines/              # Budget line items
│   │   └── budget-templates/          # Template management
│   │
│   ├── common/                        # Cross-cutting concerns
│   │   ├── decorators/                # Custom decorators
│   │   ├── filters/                   # Exception filters
│   │   ├── guards/                    # Auth guards
│   │   └── utils/                     # Utilities
│   │
│   └── modules/                       # Framework modules
│       ├── health/                    # Health checks
│       ├── debug/                     # Debug endpoints
│       └── supabase/                  # Database module
```

## Key Patterns

### 1. Result Pattern

Explicit error handling without throwing exceptions.

```typescript
export class Result<T> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly error?: string,
    private readonly _value?: T
  ) {}

  static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  static fail<U>(error: string): Result<U> {
    return new Result<U>(false, error);
  }

  get value(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot get value of a failure result');
    }
    return this._value as T;
  }
}
```

**Usage:**
```typescript
const result = await this.budgetRepository.findById(id);
if (result.isFailure) {
  return Result.fail(result.error);
}
const budget = result.value;
```

### 2. Repository Pattern

Abstracts data access behind interfaces.

```typescript
// Domain layer - Interface
export interface BudgetRepository {
  findById(id: string): Promise<Result<Budget | null>>;
  save(budget: Budget): Promise<Result<Budget>>;
  delete(id: string): Promise<Result<void>>;
}

// Infrastructure layer - Implementation
export class SupabaseBudgetRepository implements BudgetRepository {
  // Implementation details hidden from domain
}
```

### 3. CQRS (Command Query Responsibility Segregation)

Separates read and write operations.

```typescript
// Command - Changes state
export class CreateBudgetCommand {
  constructor(
    public readonly userId: string,
    public readonly month: number,
    public readonly year: number,
    public readonly description: string
  ) {}
}

// Query - Reads state
export class GetBudgetQuery {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string
  ) {}
}
```

### 4. Domain Events

Decouple features through events.

```typescript
export class BudgetCreatedEvent {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly month: number,
    public readonly year: number
  ) {}
}

// Publisher
this.eventBus.publish(new BudgetCreatedEvent(...));

// Subscriber in another slice
@EventsHandler(BudgetCreatedEvent)
export class BudgetCreatedHandler {
  async handle(event: BudgetCreatedEvent) {
    // React to budget creation
  }
}
```

### 5. Value Objects

Encapsulate domain concepts with validation.

```typescript
export class BudgetPeriod extends ValueObject<{ month: number; year: number }> {
  static create(month: number, year: number): Result<BudgetPeriod> {
    if (month < 1 || month > 12) {
      return Result.fail('Invalid month');
    }
    return Result.ok(new BudgetPeriod({ month, year }));
  }

  isFuture(): boolean {
    const now = new Date();
    return this.props.year > now.getFullYear() || 
           (this.props.year === now.getFullYear() && this.props.month > now.getMonth() + 1);
  }
}
```

## Working with the Architecture

### Adding a New Feature Slice

1. **Create the folder structure**:
```bash
mkdir -p src/slices/new-feature/{domain,application,infrastructure,tests}
mkdir -p src/slices/new-feature/domain/{entities,value-objects,events,repositories}
mkdir -p src/slices/new-feature/application/{commands,queries,handlers}
mkdir -p src/slices/new-feature/infrastructure/{persistence,api}
```

2. **Define the domain model**:
```typescript
// domain/entities/new-feature.entity.ts
export class NewFeature extends BaseEntity<NewFeatureProps> {
  static create(props: CreateNewFeatureProps): Result<NewFeature> {
    // Validation and business rules
    return Result.ok(new NewFeature(props));
  }
}
```

3. **Create repository interface**:
```typescript
// domain/repositories/new-feature.repository.ts
export interface NewFeatureRepository {
  findById(id: string): Promise<Result<NewFeature | null>>;
  save(feature: NewFeature): Promise<Result<NewFeature>>;
}
```

4. **Implement use cases**:
```typescript
// application/handlers/create-new-feature.handler.ts
@CommandHandler(CreateNewFeatureCommand)
export class CreateNewFeatureHandler {
  constructor(
    @Inject(NEW_FEATURE_REPOSITORY_TOKEN) 
    private repository: NewFeatureRepository
  ) {}

  async execute(command: CreateNewFeatureCommand): Promise<Result<string>> {
    const featureResult = NewFeature.create(command);
    if (featureResult.isFailure) {
      return Result.fail(featureResult.error);
    }
    
    const saveResult = await this.repository.save(featureResult.value);
    return saveResult.isSuccess 
      ? Result.ok(saveResult.value.id)
      : Result.fail(saveResult.error);
  }
}
```

5. **Create infrastructure**:
```typescript
// infrastructure/api/new-feature.controller.ts
@Controller('v2/new-features')
@ApiTags('New Features')
export class NewFeatureController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new feature' })
  async create(@Body() dto: CreateNewFeatureDto): Promise<NewFeatureResponse> {
    const result = await this.commandBus.execute(
      new CreateNewFeatureCommand(dto)
    );
    
    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }
    
    return { id: result.value };
  }
}
```

6. **Wire up the module**:
```typescript
// new-feature.module.ts
@Module({
  imports: [CqrsModule],
  controllers: [NewFeatureController],
  providers: [
    ...NewFeatureHandlers,
    {
      provide: NEW_FEATURE_REPOSITORY_TOKEN,
      useClass: SupabaseNewFeatureRepository,
    },
  ],
})
export class NewFeatureModule {}
```

### Adding a New Use Case

1. **Create command/query**:
```typescript
export class UpdateFeatureCommand {
  constructor(
    public readonly id: string,
    public readonly updates: UpdateFeatureDto
  ) {}
}
```

2. **Create handler**:
```typescript
@CommandHandler(UpdateFeatureCommand)
export class UpdateFeatureHandler {
  async execute(command: UpdateFeatureCommand): Promise<Result<void>> {
    // Implementation
  }
}
```

3. **Add to handlers index**:
```typescript
export const NewFeatureHandlers = [
  CreateNewFeatureHandler,
  UpdateFeatureHandler, // Add new handler
  // ... other handlers
];
```

## Testing Strategy

### 1. Unit Tests (Domain Layer)

Test business logic without dependencies.

```typescript
describe('Budget Entity', () => {
  it('should create a valid budget', () => {
    const result = Budget.create({
      userId: 'user123',
      month: 1,
      year: 2024,
      description: 'January budget'
    });
    
    expect(result.isSuccess).toBe(true);
    expect(result.value.period.month).toBe(1);
  });

  it('should fail with invalid period', () => {
    const result = Budget.create({
      userId: 'user123',
      month: 13, // Invalid month
      year: 2024,
      description: 'Invalid budget'
    });
    
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Invalid month');
  });
});
```

### 2. Handler Tests (Application Layer)

Test use case orchestration with mocked dependencies.

```typescript
describe('CreateBudgetHandler', () => {
  let handler: CreateBudgetHandler;
  let repository: MockProxy<BudgetRepository>;
  let eventBus: MockProxy<EventBus>;

  beforeEach(() => {
    repository = mock<BudgetRepository>();
    eventBus = mock<EventBus>();
    handler = new CreateBudgetHandler(repository, eventBus);
  });

  it('should create budget successfully', async () => {
    // Arrange
    repository.save.mockResolvedValue(Result.ok(mockBudget));
    
    // Act
    const result = await handler.execute(command);
    
    // Assert
    expect(result.isSuccess).toBe(true);
    expect(repository.save).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(BudgetCreatedEvent)
    );
  });
});
```

### 3. Integration Tests (Infrastructure Layer)

Test repository implementations with real database.

```typescript
describe('SupabaseBudgetRepository Integration', () => {
  let repository: SupabaseBudgetRepository;
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = createTestSupabaseClient();
    repository = new SupabaseBudgetRepository(supabase, logger);
    await cleanDatabase();
  });

  it('should save and retrieve budget', async () => {
    // Arrange
    const budget = createTestBudget();
    
    // Act
    const saveResult = await repository.save(budget);
    const findResult = await repository.findById(budget.id);
    
    // Assert
    expect(saveResult.isSuccess).toBe(true);
    expect(findResult.value?.id).toBe(budget.id);
  });
});
```

### 4. E2E Tests

Test complete API flows.

```typescript
describe('Budget API E2E', () => {
  it('POST /v2/budgets should create budget', async () => {
    const response = await request(app.getHttpServer())
      .post('/v2/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 1,
        year: 2024,
        description: 'January budget'
      });
      
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
```

## Security & Monitoring

### Security Features

1. **Authentication & Authorization**:
```typescript
@Controller('v2/budgets')
@UseGuards(EnhancedAuthGuard) // JWT validation
export class BudgetController {
  @Post()
  @Roles('user') // Role-based access
  @AuthRateLimit() // Rate limiting
  async create() { }
}
```

2. **Security Headers** (Helmet):
```typescript
// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
```

3. **Input Validation** (Zod):
```typescript
const CreateBudgetSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2030),
  description: z.string().max(500)
});
```

### Monitoring

1. **Health Checks**:
```
GET /health          - Basic health status
GET /health/live     - Kubernetes liveness probe
GET /health/ready    - Kubernetes readiness probe
GET /health/metrics  - Application metrics
```

2. **Structured Logging**:
```typescript
@LogOperation('create_budget')
async create(command: CreateBudgetCommand) {
  // Automatically logs:
  // - Start time
  // - End time
  // - Duration
  // - Success/failure
  // - User context
}
```

3. **Performance Tracking**:
```typescript
@LogPerformance({ threshold: 1000 }) // Warn if > 1s
async complexOperation() { }
```

## API Design

### RESTful Endpoints

All v2 endpoints follow REST conventions:

```
POST   /v2/budgets              - Create budget
GET    /v2/budgets              - List budgets
GET    /v2/budgets/:id          - Get budget
PUT    /v2/budgets/:id          - Update budget
DELETE /v2/budgets/:id          - Delete budget
GET    /v2/budgets/period/:year/:month - Get by period
```

### Request/Response Format

**Request**:
```json
POST /v2/budgets
{
  "month": 1,
  "year": 2024,
  "description": "January budget",
  "templateId": "template_123" // Optional
}
```

**Success Response**:
```json
{
  "id": "budget_123",
  "month": 1,
  "year": 2024,
  "description": "January budget",
  "totalIncome": 5000,
  "totalExpenses": 3500,
  "totalSavings": 1500,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Error Response**:
```json
{
  "success": false,
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00Z",
  "path": "/v2/budgets",
  "method": "POST",
  "message": "Validation failed",
  "error": "BadRequestException",
  "code": "VALIDATION_FAILED",
  "details": {
    "month": ["Must be between 1 and 12"]
  }
}
```

### Swagger Documentation

All endpoints are documented with Swagger:

```typescript
@ApiOperation({ summary: 'Create a new budget' })
@ApiBody({ type: CreateBudgetDto })
@ApiResponse({ status: 201, type: BudgetResponse })
@ApiResponse({ status: 400, type: ErrorResponse })
async create(@Body() dto: CreateBudgetDto) { }
```

Access Swagger UI at: `http://localhost:3000/api`

## Migration Guide

### From v1 to v2

1. **Endpoint Changes**:
   - Add `/v2` prefix to all endpoints
   - Response format may differ slightly

2. **Authentication**:
   - Same JWT tokens work with v2
   - Same Supabase session management

3. **Breaking Changes**:
   - Error response format is more detailed
   - Some field names may have changed
   - Validation is stricter

4. **Migration Strategy**:
   - Both v1 and v2 endpoints work simultaneously
   - Gradually migrate clients to v2
   - Monitor v1 usage and sunset when ready

### Example Migration

**v1**:
```typescript
// Old module-based approach
POST /budgets
{
  "month": 1,
  "year": 2024
}
```

**v2**:
```typescript
// New vertical slice approach
POST /v2/budgets
{
  "month": 1,
  "year": 2024,
  "description": "January budget" // New required field
}
```

## Best Practices

### 1. Domain Modeling

- **Rich Entities**: Put business logic in entities, not services
- **Value Objects**: Use for concepts without identity
- **Invariants**: Enforce business rules in the domain
- **Factory Methods**: Use static `create` methods with validation

### 2. Error Handling

- **Use Result Pattern**: Avoid throwing exceptions for expected errors
- **Domain Exceptions**: Create specific exceptions for business errors
- **Consistent Responses**: Use error mapper for API responses

### 3. Testing

- **Test Pyramid**: More unit tests, fewer integration/E2E tests
- **Test Behavior**: Test what the code does, not how
- **Mock at Boundaries**: Mock repositories, not domain objects
- **Test Data Builders**: Create reusable test data factories

### 4. Performance

- **N+1 Queries**: Use DataLoader or batch operations
- **Caching**: Cache at repository level for read-heavy data
- **Pagination**: Always paginate list endpoints
- **Async Operations**: Use queues for long-running tasks

### 5. Code Organization

- **One Class Per File**: Keep files focused
- **Explicit Exports**: Use index.ts for public APIs
- **Consistent Naming**: Follow conventions (*.entity.ts, *.handler.ts)
- **Co-location**: Keep related code together in slices

## Examples

### Example 1: Creating a Budget with Template

```typescript
// Command
export class CreateBudgetFromTemplateCommand {
  constructor(
    public readonly userId: string,
    public readonly month: number,
    public readonly year: number,
    public readonly templateId: string
  ) {}
}

// Handler
@CommandHandler(CreateBudgetFromTemplateCommand)
export class CreateBudgetFromTemplateHandler {
  async execute(command: CreateBudgetFromTemplateCommand): Promise<Result<string>> {
    // 1. Validate period
    const periodResult = BudgetPeriod.create(command.month, command.year);
    if (periodResult.isFailure) {
      return Result.fail(periodResult.error);
    }

    // 2. Check for duplicate
    const existingResult = await this.budgetRepository.findByPeriod(
      periodResult.value,
      command.userId
    );
    if (existingResult.value) {
      return Result.fail('Budget already exists for this period');
    }

    // 3. Create from template
    const createResult = await this.budgetRepository.createFromTemplate(
      command.userId,
      periodResult.value,
      command.templateId
    );
    
    if (createResult.isSuccess) {
      // 4. Publish event
      this.eventBus.publish(
        new BudgetCreatedFromTemplateEvent(
          createResult.value.id,
          command.templateId
        )
      );
    }
    
    return createResult;
  }
}
```

### Example 2: Complex Query with Filtering

```typescript
// Query
export class SearchTransactionsQuery {
  constructor(
    public readonly userId: string,
    public readonly filters: {
      budgetId?: string;
      categoryId?: string;
      minAmount?: number;
      maxAmount?: number;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    },
    public readonly pagination: {
      page: number;
      limit: number;
    }
  ) {}
}

// Handler
@QueryHandler(SearchTransactionsQuery)
export class SearchTransactionsHandler {
  async execute(query: SearchTransactionsQuery): Promise<Result<PaginatedResult<Transaction>>> {
    // Validate pagination
    if (query.pagination.limit > 100) {
      return Result.fail('Limit cannot exceed 100');
    }

    // Apply filters
    const result = await this.transactionRepository.search(
      query.userId,
      query.filters,
      query.pagination
    );

    return result;
  }
}
```

### Example 3: Domain Event Handling

```typescript
// Event
export class BudgetOverspentEvent {
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly threshold: number
  ) {}
}

// Handler in notification slice
@EventsHandler(BudgetOverspentEvent)
export class BudgetOverspentNotificationHandler {
  async handle(event: BudgetOverspentEvent): Promise<void> {
    // Send notification
    await this.notificationService.send({
      userId: event.userId,
      type: 'BUDGET_OVERSPENT',
      data: {
        budgetId: event.budgetId,
        overspentAmount: event.amount - event.threshold
      }
    });
    
    // Log for analytics
    this.logger.info('Budget overspent notification sent', {
      budgetId: event.budgetId,
      userId: event.userId
    });
  }
}
```

## Conclusion

This vertical slice architecture provides a solid foundation for building maintainable, scalable, and testable applications. By organizing code around business capabilities rather than technical layers, we achieve better cohesion and looser coupling.

Key takeaways:
- Each slice is independent and can be developed, tested, and deployed separately
- Business logic is protected in the domain layer
- Use cases are explicit and testable
- Infrastructure concerns are isolated
- The architecture scales with team size and application complexity

For questions or clarifications, refer to the example slices in the codebase or consult the team lead.