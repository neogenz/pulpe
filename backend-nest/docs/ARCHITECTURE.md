# Backend Architecture

The backend follows a 3-layer Clean Architecture per module: `domain`, `application`, `infrastructure`. The dependency rule flows in one direction only: `infrastructure -> application -> domain`. The why behind every decision lives in [ADRs](./adr/README.md).

## Layers at a glance

```
┌──────────────────────────────────────────────────────────┐
│                  infrastructure/                          │
│  controllers, repositories, mappers, Zod RPC schemas      │
│  (NestJS, Supabase, zod allowed)                          │
└───────────────────────────┬──────────────────────────────┘
                            │ depends on
                            ▼
┌──────────────────────────────────────────────────────────┐
│                  application/                             │
│  *.use-case.ts — @Injectable, single execute()            │
│  (NestJS allowed; no Supabase, no zod)                    │
└───────────────────────────┬──────────────────────────────┘
                            │ depends on
                            ▼
┌──────────────────────────────────────────────────────────┐
│                  domain/                                  │
│  entity types, invariants, formulas, port interfaces      │
│  (pure TS — no NestJS, no Supabase, no zod)               │
└──────────────────────────────────────────────────────────┘
```

Cross-module: modules talk to each other only through ports + Symbol tokens, never via direct service imports. See [ADR-0002](./adr/0002-cross-module-via-ports-and-tokens.md).

## Folder layout per module

```
backend-nest/src/modules/<domain>/
├── domain/
│   ├── <domain>.entity.ts              # Plain types from DB row generators
│   ├── <domain>.invariants.ts          # Pure validation, throws BusinessException
│   ├── <domain>.formulas.ts            # Pure domain logic (optional)
│   └── ports/
│       ├── <domain>-repository.port.ts # Symbol token + interface
│       └── <other>.port.ts
├── application/
│   └── *.use-case.ts                   # @Injectable, single execute()
├── infrastructure/
│   ├── http/
│   │   ├── <domain>.controller.ts
│   │   └── dto/
│   ├── persistence/
│   │   ├── supabase-<domain>.repository.ts
│   │   └── schemas/                    # Zod schemas for RPC JSONB params
│   └── mappers/
│       └── <domain>.mapper.ts          # Entity <-> API DTO (called by controllers)
├── <domain>.module.ts
├── <domain>.tokens.ts                  # Public token re-exports
└── index.ts
```

## Layer rules

| Layer | Owns | May import | Must NOT import |
|-------|------|-----------|-----------------|
| `domain/` | Entities, invariants, ports | `pulpe-shared`, `src/types/`, `src/common/exceptions`, `src/common/constants` | `@nestjs/*`, `@supabase/*`, `zod`, sibling layers |
| `application/` | Use cases | `domain/`, `src/common/`, ports of OTHER modules | own `infrastructure/`, other modules' `infrastructure/` |
| `infrastructure/` | Controllers, repositories, mappers, RPC Zod schemas | All layers + frameworks | n/a |

The single permanent exception: `encryption/application/*` may import `encryption/infrastructure/crypto/*`. Reason: the encryption module IS the crypto layer; primitives are intentionally not on the public `ENCRYPTION_PORT`. See [ADR-0008](./adr/0008-encryption-service-decomposition.md).

Enforcement is double: ESLint `boundaries` (fast, IDE) and `dependency-cruiser` (transitive, CI). See [ADR-0009](./adr/0009-dependency-cruiser-and-eslint-boundaries.md).

## Use case pattern

One `@Injectable` class per file, with a single `execute()` method. See [ADR-0003](./adr/0003-use-case-single-execute-method.md).

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
    const entity = await this.repo.insert(/* plain numbers, no encryption here */);
    await this.budgetRecalculation.recalculate(entity.budgetId, user.clientKey);
    this.logger.info({ operation: 'budgetLine.create', userId: user.id }, 'Budget line created');
    return entity;
  }
}
```

Use cases work with plain numbers; repositories own the encryption boundary. See [ADR-0004](./adr/0004-repos-return-decrypted-entities.md).

## Port + token pattern

```typescript
// domain/ports/budget-line-repository.port.ts
export const BUDGET_LINE_REPOSITORY = Symbol('BUDGET_LINE_REPOSITORY');

export interface BudgetLineRepositoryPort {
  findById(id: string): Promise<BudgetLine>;
  insert(input: BudgetLineCreateInput): Promise<BudgetLine>;
  update(id: string, patch: BudgetLineUpdatePatch): Promise<BudgetLine>;
  delete(id: string): Promise<void>;
}
```

The Supabase implementation lives in `infrastructure/persistence/supabase-<domain>.repository.ts`, injects `AuthenticatedSupabaseProvider` + `ENCRYPTION_PORT`, decrypts on read, encrypts on write — use cases never see ciphertext.

## Module registration

Every class using `@InjectInfoLogger` MUST have a matching `createInfoLoggerProvider` entry, otherwise NestJS throws at startup.

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
  exports: [BUDGET_LINE_REPOSITORY],
})
export class BudgetLineModule {}
```

The authenticated Supabase client is read lazily from CLS by `AuthenticatedSupabaseProvider` (set by `AuthGuard`). Use cases never inject the client. See [ADR-0006](./adr/0006-cls-authenticated-supabase-provider.md).

## How to add a new module

1. Create the folder structure above. Mirror an existing module like `backend-nest/src/modules/budget-line/`.
2. Define entities + invariants in `domain/` (pure TS, no framework imports).
3. Define repository port + Symbol token in `domain/ports/`.
4. Implement the repository in `infrastructure/persistence/`. If it touches encrypted columns, inject `ENCRYPTION_PORT` and decrypt before returning entities.
5. Write use cases in `application/` (one verb per file, single `execute()`). Throw `BusinessException` with `ERROR_DEFINITIONS` on invariant failures. See [ADR-0005](./adr/0005-error-handling-business-exception.md).
6. Add controller(s) in `infrastructure/http/`. Use `createZodDto()` from shared schemas for request DTOs. Map entities to API DTOs with mappers in `infrastructure/mappers/`.
7. If a controller calls an RPC with JSONB ciphertexts, add a strict Zod schema in `infrastructure/persistence/schemas/`. See [ADR-0007](./adr/0007-zod-rpc-payload-schemas.md).
8. Wire the module: import `ClsModule`, register use cases, repository binding, `createInfoLoggerProvider` for every `@InjectInfoLogger` consumer, export ports that other modules need.
9. Run `bun run quality` and `bun run lint:arch`. Both must pass.

## Common layer

```
backend-nest/src/common/
├── guards/          # AuthGuard — stores user + supabase in CLS
├── decorators/      # @User(), @SupabaseClient() (legacy back-compat)
├── interceptors/    # Response shape, client-key cleanup
├── filters/         # GlobalExceptionFilter — only place logger.error is called
├── exceptions/      # BusinessException
├── constants/       # ERROR_DEFINITIONS
├── logger/          # InfoLogger, InjectInfoLogger, createInfoLoggerProvider
└── pipes/           # ZodValidationPipe
```

## ADR index

Decisions and trade-offs live in [`backend-nest/docs/adr/`](./adr/README.md). Read those when changing architecture, not the rules.
