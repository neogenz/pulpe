# Implementation: Rollover basé sur payDayOfMonth

## Completed

### 1. SQL Migration
- Created `/backend-nest/supabase/migrations/20260110150309_add_payday_to_rollover_function.sql`
- New function signature: `get_budget_with_rollover(p_budget_id UUID, p_pay_day_of_month INT DEFAULT 1)`
- Calculates `budget_start_date` for each budget based on payDay
- Orders budgets by `budget_start_date` instead of `year, month`
- Handles short months (Feb with payDay=31 uses last day of month)
- Backward compatible: payDay=1 (default) behaves like calendar ordering

### 2. Backend Calculator (`budget.calculator.ts`)
- Modified `getRollover()` signature to include `payDayOfMonth` parameter
- Passes `p_pay_day_of_month` to the RPC call

### 3. Backend Service (`budget.service.ts`)
- Added constants: `DEFAULT_PAY_DAY`, `MIN_PAY_DAY`, `MAX_PAY_DAY`
- Added `getPayDayOfMonth()` helper method to fetch and validate from user metadata
- Updated all methods that use rollover:
  - `findAll` → gets payDayOfMonth, passes to `enrichBudgetsWithRemaining`
  - `exportAll` → gets payDayOfMonth, passes to `enrichBudgetsForExport`
  - `findOneWithDetails` → gets payDayOfMonth, passes to `addRolloverToBudget`
- Updated all private methods to accept `payDayOfMonth` parameter

### 4. TypeScript Types (`database.types.ts`)
- Updated RPC function Args: `{ p_budget_id: string; p_pay_day_of_month?: number }`

## Deviations from Plan

None. Implementation followed the plan exactly.

### 5. Unit Tests (`rollover-payday.spec.ts`)
- Created `backend-nest/src/modules/budget/__tests__/rollover-payday.spec.ts`
- 7 tests covering:
  - `getPayDayOfMonth` defaults to 1 when no user metadata
  - `getPayDayOfMonth` uses value from user metadata (e.g., 27)
  - `getPayDayOfMonth` clamps invalid values to 1-31 range
  - `getPayDayOfMonth` defaults to 1 for non-numeric values
  - `getRollover` passes payDayOfMonth=1 to RPC (calendar behavior)
  - `getRollover` passes payDayOfMonth=27 to RPC (pay-period behavior)
  - `getRollover` correctly parses RPC response

## Test Results

- Typecheck: ✓
- Lint: ✓ (0 errors, 3 pre-existing warnings unrelated to changes)
- Backend tests: ✓ (84 tests passed, including 7 new rollover-payday tests)
- Frontend tests: ✓ (711 tests passed)

## Files Changed

| File | Change |
|------|--------|
| `backend-nest/supabase/migrations/20260110150309_add_payday_to_rollover_function.sql` | New migration |
| `backend-nest/src/modules/budget/budget.calculator.ts` | Added payDayOfMonth parameter |
| `backend-nest/src/modules/budget/budget.service.ts` | Added getPayDayOfMonth helper, updated all callers |
| `backend-nest/src/types/database.types.ts` | Updated RPC function signature |
| `backend-nest/src/modules/budget/__tests__/rollover-payday.spec.ts` | New test file for payDay rollover behavior |

## Follow-up Tasks

1. **Apply migration to database**: Run `supabase db push` or deploy migration to production
2. **Regenerate types from remote**: After migration is applied, run `bun run generate-types` to regenerate from actual database
3. **Manual testing**: Test with a user that has payDay=27 configured to verify rollover follows pay periods

## Rollback Plan

If issues occur:
1. The old function signature is still compatible (p_pay_day_of_month has DEFAULT 1)
2. Revert TypeScript changes to use single-parameter call
3. The migration drops the old function but behavior with payDay=1 is identical to calendar ordering
