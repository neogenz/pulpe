# Task: Update Backend Rollover Tests for Quinzaine Logic

## Problem

The existing backend tests in `rollover-payday.spec.ts` need to be updated to verify the SQL migration correctly implements the quinzaine logic. Current tests only cover basic payDay scenarios but don't validate the month offset behavior for `payDay > 15`.

## Proposed Solution

Update and add tests in `backend-nest/src/modules/budget/__tests__/rollover-payday.spec.ts`:

1. **Update existing test descriptions** to clarify quinzaine behavior

2. **Add new test cases:**
   - `payDay=5` (1ère quinzaine): Verify budget starts in same month
   - `payDay=15` (boundary): Verify no décalage
   - `payDay=16` (2ème quinzaine): Verify budget starts in previous month
   - `payDay=27` with year transition: Verify January budget starts in December

3. **Verify RPC parameters and ordering:**
   - Confirm `p_pay_day_of_month` is passed correctly
   - Verify budgets are ordered by actual period start, not calendar month

## Dependencies

- Task 2: SQL Migration (must be completed and applied first)

## Context

- Test file: `backend-nest/src/modules/budget/__tests__/rollover-payday.spec.ts`
- Test framework: Vitest with Bun runtime
- Mocking pattern: `createMockSupabaseClient()` with spy support
- Run tests: `cd backend-nest && bun test rollover-payday`

## Success Criteria

- Tests verify quinzaine logic is applied in RPC response
- Edge cases tested: year transitions, boundary payDay values
- All tests pass: `bun test` in backend-nest directory
- Mock setup correctly intercepts RPC calls with expected parameters
