---
description: NestJS backend module architecture, 3-layer Clean Architecture, dependency rule, and port patterns
paths:
  - "backend-nest/src/**/*.ts"
---

# NestJS Architecture

The backend uses a 3-layer Clean Architecture per module. See full details in `backend-nest/docs/ARCHITECTURE.md`.

## Module Structure

Each domain in `src/modules/[domain]/`:

```
[domain]/
├── domain/
│   ├── [domain].entity.ts         # Explicit decrypted domain interfaces
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

Ports live under each module's `domain/ports/`. Search those directories before adding one;
do not maintain a duplicate inventory in documentation.

## Use Case Pattern

Use cases work with plain numbers — repositories own the encryption boundary (decrypt on read, encrypt on write). Use cases never inject `ENCRYPTION_PORT` for read paths. See [ADR-0004](../../../docs/adr/0004-repos-return-decrypted-entities.md).

```typescript
@Injectable()
export class CreateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(CreateBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(dto: BudgetLineCreate, user: AuthenticatedUser): Promise<BudgetLine> {
    BudgetLineInvariants.validateCreate(dto);
    const entity = await this.repo.insert(dto);  // plain numbers in, decrypted entity out
    await this.budgetRecalculation.recalculate(entity.budgetId);
    this.logger.info({ operation: 'budgetLine.create', userId: user.id }, 'Budget line created');
    return entity;
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

`AuthGuard` stores user + Supabase client in CLS. Repositories inject `AuthenticatedSupabaseProvider` and read `.client`. Use-cases inject repos via ports — no direct Supabase at application layer.

## Rules

- Domain layer: pure TypeScript, zero framework imports
- Application layer: use cases only, no infrastructure imports — single permanent exception: `encryption/application/*` may import `encryption/infrastructure/crypto/*` (see [ADR-0008](../../../docs/adr/0008-encryption-service-decomposition.md))
- Mappers live in `infrastructure/mappers/` — called by **controllers** (entity → API DTO conversion at the HTTP boundary), never by use cases
- All endpoints protected by `AuthGuard` by default
- Encryption columns (`amount`, `target_amount`, `ending_balance`) are stored as ciphertext text. Repositories decrypt on read and encrypt on write internally via `ENCRYPTION_PORT`. Use cases see plain numbers only.
- RPC calls with JSONB params containing ciphertexts: strict Zod schema in `infrastructure/persistence/schemas/`, consumed by the repository (not by use cases)
- Full architecture overview: [`backend-nest/docs/ARCHITECTURE.md`](../../../backend-nest/docs/ARCHITECTURE.md). Decisions and trade-offs: [`docs/adr/`](../../../docs/adr/README.md)
