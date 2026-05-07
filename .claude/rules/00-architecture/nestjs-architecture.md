---
description: NestJS backend module architecture, 3-layer Clean Architecture, dependency rule, and port patterns
paths: "backend-nest/src/**/*.ts"
---

# NestJS Architecture

The backend uses a 3-layer Clean Architecture per module. See full details in `backend-nest/docs/ARCHITECTURE.md`.

## Module Structure

Each domain in `src/modules/[domain]/`:

```
[domain]/
├── domain/
│   ├── [domain].entity.ts         # Plain types from DB row generators
│   ├── [domain].invariants.ts     # Pure validation (throws BusinessException)
│   ├── [domain].formulas.ts       # Pure domain logic (optional)
│   └── ports/
│       ├── [domain]-repository.port.ts
│       └── other ports...
├── application/
│   └── *.use-case.ts              # @Injectable, single execute() method
├── infrastructure/
│   ├── http/
│   │   ├── [domain].controller.ts
│   │   └── dto/
│   ├── persistence/
│   │   ├── supabase-[domain].repository.ts
│   │   └── schemas/               # Zod for RPC JSONB params
│   └── mappers/
│       └── [domain].mapper.ts
├── [domain].module.ts
├── [domain].tokens.ts
└── index.ts
```

## Layer Responsibilities

| Layer | Owns | May import | Must NOT import |
|-------|------|-----------|-----------------|
| **domain/** | Entities, invariants, port interfaces | `pulpe-shared`, `src/types/`, `src/common/exceptions`, `src/common/constants` | `@nestjs/*`, `@supabase/*`, `zod`, other layers |
| **application/** | Use cases (`@Injectable`) | `domain/`, `src/common/` | `infrastructure/` |
| **infrastructure/** | Controllers, repos, mappers, Zod RPC schemas | All layers + frameworks | — |

## Dependency Rule

```
infrastructure → application → domain
```

Enforced at CI by `bun run quality` (ESLint boundaries) and `bun run lint:arch` (dep-cruiser).

## Cross-module Communication

Use ports (symbols + interfaces), never direct Service→Service imports.

```typescript
// In consuming module use-case:
@Inject(BUDGET_RECALCULATION_PORT)
private readonly recalculate: BudgetRecalculationPort,
```

Active ports: `BUDGET_REPOSITORY`, `BUDGET_RECALCULATION_PORT`, `BUDGET_LINE_REPOSITORY`,
`TRANSACTION_REPOSITORY`, `BUDGET_TEMPLATE_REPOSITORY`, `ENCRYPTION_PORT`,
`DEMO_CREDENTIALS_PORT`, `DEMO_REPOSITORY`.

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
    BudgetLineInvariants.validateCreate(dto);
    const dek = await this.encryption.ensureUserDEK(userId);
    const row = await this.repo.create(dto, userId, dek);
    this.logger.info({ operation: 'create_budget_line', userId }, 'Budget line created');
    return row;
  }
}
```

## Module Pattern

**MANDATORY:** Every class using `@InjectInfoLogger` MUST have matching `createInfoLoggerProvider` entry.

```typescript
@Module({
  imports: [ClsModule],
  providers: [
    CreateBudgetLineUseCase,
    { provide: BUDGET_LINE_REPOSITORY, useClass: SupabaseBudgetLineRepository },
    createInfoLoggerProvider(CreateBudgetLineUseCase.name),
    createInfoLoggerProvider(BudgetLineController.name),
  ],
  controllers: [BudgetLineController],
})
export class BudgetLineModule {}
```

## AuthenticatedSupabaseClient

`AuthGuard` stores user + Supabase client in CLS. Repositories inject `AuthenticatedSupabaseProvider` and call `.getClient()`. Use-cases inject repos via ports — no direct Supabase at application layer.

## Rules

- Domain layer: pure TypeScript, zero framework imports
- Application layer: use-cases only, no infrastructure imports
- Mappers live in `infrastructure/mappers/` — called by use-cases (pending move to `application/mappers/`)
- All endpoints protected by `AuthGuard` by default
- Encryption columns (`amount`, `target_amount`, `ending_balance`) go through `ENCRYPTION_PORT`
- RPC calls with JSONB params: strict Zod schema in `infrastructure/persistence/schemas/`
