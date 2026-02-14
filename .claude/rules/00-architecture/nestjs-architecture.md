---
description: NestJS backend module architecture, layered patterns, and dependency flow
paths: "backend-nest/src/**/*.ts"
---

# NestJS Architecture

## Module Structure

Each domain in `src/modules/[domain]/`:

```
[domain]/
├── [domain].module.ts         # Module config + DI setup
├── [domain].controller.ts     # HTTP routes + Swagger docs
├── [domain].service.ts        # Business logic + orchestration
├── [domain].repository.ts     # Data access (Supabase queries)
├── [domain].mapper.ts         # DTO <-> Entity transformation
├── [domain].calculator.ts     # Domain calculations (optional)
├── [domain].validator.ts      # Domain validation (optional)
├── [domain].constants.ts      # Domain constants (optional)
├── dto/                       # Request/Response DTOs with Zod
│   └── [domain]-swagger.dto.ts
├── entities/                  # Business entities
└── schemas/                   # Local Zod schemas (DB validation)
```

## Layer Responsibilities

| Layer | Does | Does NOT |
|-------|------|----------|
| **Controller** | Route, validate input, Swagger docs, return response | Business logic, DB queries, error handling beyond HTTP |
| **Service** | Business logic, orchestration, call repository/mapper | Direct Supabase queries, HTTP concerns |
| **Repository** | Supabase queries, data access, error translation | Business rules, response formatting |
| **Mapper** | DTO <-> Entity transformation, snake_case <-> camelCase | Business logic, DB queries |

## Controller Pattern

```typescript
@Controller('budgets')
@ApiTags('budgets')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  @ApiOperation({ summary: 'Create budget' })
  @ApiResponse({ status: 201, type: BudgetResponseDto })
  async create(
    @Body() dto: BudgetCreateDto,       // Auto-validated by ZodValidationPipe
    @User() user: AuthenticatedUser,     // Injected by AuthGuard
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    return this.budgetService.create(dto, user, supabase);
  }
}
```

## Service Pattern

```typescript
@Injectable()
export class BudgetService {
  constructor(
    @InjectInfoLogger(BudgetService.name)
    private readonly logger: InfoLogger,
    private readonly budgetMapper: BudgetMapper,
  ) {}

  async create(
    dto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    const startTime = Date.now();
    // Business logic here
    this.logger.info(
      { operation: 'create_budget', userId: user.id, duration: Date.now() - startTime },
      'Budget created successfully',
    );
    return { success: true, data: this.budgetMapper.toApi(result) };
  }
}
```

## Dependency Flow

```
Controller -> Service -> Repository -> Supabase Client -> RLS -> PostgreSQL
                |-> Mapper (DTO <-> Entity)
                |-> Calculator (domain math)
                |-> Validator (business rules)
```

## Common Layer (`src/common/`)

```
common/
├── guards/          # AuthGuard
├── decorators/      # @User(), @SupabaseClient(), @SkipBackfill()
├── interceptors/    # Response formatting, encryption backfill, client-key cleanup
├── filters/         # GlobalExceptionFilter
├── middleware/       # Request ID tracking
├── pipes/           # ZodValidationPipe
├── exceptions/      # BusinessException + ERROR_DEFINITIONS
├── dto/             # Shared DTOs (ErrorResponse, etc.)
├── logger/          # InfoLogger, split logger infrastructure
└── utils/           # Error handler utilities
```

## Rules

- Controllers: thin — route traffic, validate input, return response
- Services: inject repositories and mappers, never access Supabase directly
- Repositories: only data access — no business rules
- Mappers: pure transformation — no side effects
- All endpoints protected by `AuthGuard` by default
- `@SupabaseClient()` provides an authenticated client with RLS applied
