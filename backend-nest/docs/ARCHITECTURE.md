# Backend Architecture

The backend follows a lightweight 3-layer Clean Architecture per module.

## Module Structure

```
src/modules/<domain>/
├── domain/
│   ├── <domain>.entity.ts          # Plain types from Supabase row generators
│   ├── <domain>.invariants.ts      # Pure validation functions (throw BusinessException)
│   ├── <domain>.formulas.ts        # Pure domain logic (where applicable)
│   └── ports/
│       ├── <domain>-repository.port.ts
│       └── <other-port>.port.ts
├── application/
│   └── *.use-case.ts               # @Injectable, single execute() method
├── infrastructure/
│   ├── http/
│   │   ├── <domain>.controller.ts
│   │   └── dto/
│   │       └── <domain>-swagger.dto.ts
│   ├── persistence/
│   │   ├── supabase-<domain>.repository.ts
│   │   └── schemas/                # Zod for RPC payloads with JSONB params
│   └── mappers/
│       └── <domain>.mapper.ts
├── <domain>.module.ts
├── <domain>.tokens.ts
└── index.ts
```

## Layer Responsibilities

| Layer | Owns | May import | Must NOT import |
|-------|------|-----------|-----------------|
| **domain/** | Entity types, invariants, port interfaces | `pulpe-shared`, `src/types/`, `src/common/exceptions`, `src/common/constants` | `@nestjs/*`, `@supabase/*`, `zod`, other layers |
| **application/** | Use cases (`@Injectable`) | `domain/`, `src/common/` | `infrastructure/` |
| **infrastructure/** | Controllers, repositories, mappers, Zod RPC schemas | All layers + `@nestjs/*`, `@supabase/*`, `zod` | — |

## Dependency Rule

```
infrastructure → application → domain
```

Enforced by:
- ESLint `eslint-plugin-boundaries` (`bun run quality`)
- dependency-cruiser (`bun run lint:arch`)

Any violation is a CI-blocking error.

## Use Case Pattern

```typescript
@Injectable()
export class CreateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(ENCRYPTION_PORT)
    private readonly encryption: EncryptionPort,
    @InjectInfoLogger(CreateBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(dto: BudgetLineCreate, userId: string): Promise<BudgetLine> {
    BudgetLineInvariants.validateCreate(dto); // throws BusinessException on failure
    const dek = await this.encryption.ensureUserDEK(userId);
    const row = await this.repo.create(dto, userId, dek);
    this.logger.info({ operation: 'create_budget_line', userId }, 'Budget line created');
    return row;
  }
}
```

## Cross-module Communication

Modules communicate ONLY via ports (symbols + interfaces) — never via direct Service imports.

| Symbol | Defined in | Used by |
|--------|-----------|---------|
| `BUDGET_REPOSITORY` | budget/domain/ports/ | budget use-cases |
| `BUDGET_RECALCULATION_PORT` | budget/domain/ports/ | budget-line, transaction, budget-template, demo |
| `BUDGET_LINE_REPOSITORY` | budget-line/domain/ports/ | budget-line use-cases |
| `TRANSACTION_REPOSITORY` | transaction/domain/ports/ | transaction use-cases, budget-line |
| `BUDGET_TEMPLATE_REPOSITORY` | budget-template/domain/ports/ | budget-template use-cases |
| `ENCRYPTION_PORT` | encryption/domain/ports/ | all write use-cases |
| `DEMO_CREDENTIALS_PORT` | demo/domain/ports/ | demo use-cases |
| `DEMO_REPOSITORY` | demo/domain/ports/ | demo use-cases |

## AuthenticatedSupabaseClient — CLS-based injection

Controllers no longer receive `@SupabaseClient()` as a parameter. The authenticated Supabase client is stored in CLS (continuation-local storage) by `AuthGuard` and read lazily by `AuthenticatedSupabaseProvider`.

Repositories inject `AuthenticatedSupabaseProvider` and call `.getClient()` to get the per-request client. Use cases inject repositories via ports — no direct Supabase access at the application layer.

## Conventions

- `BusinessException` + `ERROR_DEFINITIONS` — use-cases throw; `GlobalExceptionFilter` logs.
- `InfoLogger` (no `error` method — compile-time enforced) for all use cases + controllers.
- Encryption columns (`amount`, `target_amount`, `ending_balance`) MUST go through `ENCRYPTION_PORT` — never direct ciphertext shuffling outside encryption module.
- RLS enforced per request via authenticated Supabase client (passed through CLS).
- `@SupabaseClient()` decorator still works for back-compat (used by demo, encryption-controller, account-deletion).
- RPC calls with JSONB params MUST have strict Zod schemas in `infrastructure/persistence/schemas/`.

## Common Layer (`src/common/`)

```
common/
├── guards/          # AuthGuard — stores user + supabase in CLS
├── decorators/      # @User(), @SupabaseClient()
├── interceptors/    # Response formatting, client-key cleanup
├── filters/         # GlobalExceptionFilter (only place logger.error is called)
├── middleware/      # Request ID tracking
├── pipes/           # ZodValidationPipe
├── exceptions/      # BusinessException + ERROR_DEFINITIONS
├── constants/       # error-definitions.ts
├── dto/             # Shared DTOs (ErrorResponse, etc.)
├── logger/          # InfoLogger, InjectInfoLogger, createInfoLoggerProvider
└── utils/           # currency-metadata.mapper, etc.
```

## Module Registration Pattern

```typescript
@Module({
  imports: [ClsModule], // required for AuthenticatedSupabaseProvider
  providers: [
    CreateBudgetLineUseCase,
    {
      provide: BUDGET_LINE_REPOSITORY,
      useClass: SupabaseBudgetLineRepository,
    },
    createInfoLoggerProvider(CreateBudgetLineUseCase.name),
    createInfoLoggerProvider(BudgetLineController.name),
  ],
  controllers: [BudgetLineController],
  exports: [BUDGET_LINE_REPOSITORY],
})
export class BudgetLineModule {}
```

Every class using `@InjectInfoLogger` needs a matching `createInfoLoggerProvider` entry — missing one = NestJS DI error at runtime.
