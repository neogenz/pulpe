# 0003 — Use case = single `execute()` method

**Status:** Accepted
**Date:** 2026-05-08
**Deciders:** Pulpe team

## Context

The previous `*.service.ts` files held many public methods (`create`, `update`, `findAll`, `findOne`, `remove`, plus a handful of private helpers). They tended to grow past 500 LOC, mixed orchestration with validation, and made PR diffs hard to review. We wanted a uniform shape per business action.

## Decision

Each business action is a separate file in `application/`, named `<verb>-<entity>.use-case.ts`. The file exports a single `@Injectable()` class with one public method `execute(...)`. Naming is verb-first: `create-budget-line.use-case.ts`, `toggle-budget-line-check.use-case.ts`, `find-all-budget-lines.use-case.ts`.

Constructor parameters are dependencies only (ports, common services, logger). `execute(...)` parameters are the request payload + the authenticated user. Return type is the domain entity (or a list).

```typescript
@Injectable()
export class CreateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY) private readonly repo: BudgetLineRepositoryPort,
    @InjectInfoLogger(CreateBudgetLineUseCase.name) private readonly logger: InfoLogger,
  ) {}

  async execute(dto: BudgetLineCreate, user: AuthenticatedUser): Promise<BudgetLine> {
    BudgetLineInvariants.validateCreate(dto);
    const entity = await this.repo.insert(/* ... */);
    this.logger.info({ operation: 'budgetLine.create', userId: user.id }, 'Budget line created');
    return entity;
  }
}
```

## Consequences

- Positive: a use case is one file, one class, one verb. PR diffs read top-to-bottom.
- Positive: testing is per-action — no per-service combinatorial mocks.
- Positive: predictable controller wiring: `useCase.execute(dto, user)`.
- Negative: more files. A module with 8 actions has 8 use case files instead of one service. Trade-off accepted.
- Negative: shared private helpers between use cases need a home. We extract them to `domain/<x>.formulas.ts` (pure) or `domain/<x>.invariants.ts` (validation), never to a shared service.

## Alternatives considered

- One `Service` class with many methods: rejected — see Context.
- Command/Handler split (one class per command, one per handler): rejected as over-engineering. We don't have a mediator and don't need one.
- CQRS with separate query and command stacks: rejected. See ADR-0010.

## References

- `backend-nest/src/modules/budget-line/application/` — 8 use case files, real example
- `.claude/rules/00-architecture/nestjs-architecture.md`
- ADR-0001
