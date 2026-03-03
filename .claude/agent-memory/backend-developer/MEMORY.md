# Backend Developer Memory

## Envelope Logic (Budget Aggregation)
- `BudgetFormulas.calculateTotalExpensesWithEnvelopes()` combines expense+saving kinds
- For each budget line: `max(line.amount, sum_of_allocated_transactions)`
- Free transactions (no `budget_line_id`) are added separately
- `totalExpenses` in `BudgetAggregates` includes savings via envelope logic
- `remaining = totalIncome - totalExpenses + rollover` (NOT minus totalSavings separately)
- `totalSavings` is display-only (sum of saving budget line amounts)

## Test Patterns
- Budget tests use `bun:test` with `describe/it/expect/beforeEach`
- Mock Supabase via inline objects or `MockSupabaseClient` from `test/test-mocks.ts`
- NestJS DI tests use `Test.createTestingModule` with `provide/useValue` pairs
- Logger injection token: `INFO_LOGGER:${ClassName.name}`
- `createMockPinoLogger()` for mock loggers

## Key File Locations
- `backend-nest/src/modules/budget/budget.repository.ts` - Data access + aggregation
- `backend-nest/src/modules/budget/budget.calculator.ts` - Uses BudgetFormulas for ending balance
- `backend-nest/src/modules/budget/budget.mappers.ts` - `toSparseApi` computes remaining
- `shared/src/calculators/budget-formulas.ts` - Single source of truth for formulas
- `backend-nest/src/test/test-mocks.ts` - Shared test utilities

## Lint Rules
- Max 50 lines per function. Extract helpers to stay under limit.
- Pre-existing warnings in other files are acceptable; don't fix unrelated code.
