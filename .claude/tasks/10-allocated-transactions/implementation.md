# Implementation: Allocated Transactions Feature

## Summary

Successfully implemented the allocated transactions feature that allows transactions to be linked to specific budget lines. This enables users to:
- See which transactions are consuming a budget line
- Track consumed vs remaining amounts per budget line
- Add/edit/delete transactions directly from a budget line context

## Completed

### Backend (NestJS + Supabase)

1. **Migration DB** (`backend-nest/supabase/migrations/20251223103908_add_budget_line_id_to_transaction.sql`)
   - Added `budget_line_id` nullable column to `transaction` table
   - Created partial index for performance
   - Added FK constraint with ON DELETE SET NULL

2. **Shared Schemas** (`shared/schemas.ts`, `shared/index.ts`)
   - Added `budgetLineId` to transaction schemas (transactionSchema, transactionCreateSchema, transactionUpdateSchema)
   - Created new schemas: budgetLineWithTransactionsSchema, allocatedTransactionsListResponseSchema

3. **Error Definition** (`backend-nest/src/common/constants/error-definitions.ts`)
   - Added `TRANSACTION_BUDGET_LINE_KIND_MISMATCH` error

4. **Transaction Mappers** (`backend-nest/src/modules/transaction/transaction.mappers.ts`)
   - Updated `toApi`, `toInsert`, `toUpdate` to include `budget_line_id`

5. **Transaction Service** (`backend-nest/src/modules/transaction/transaction.service.ts`)
   - Added `validateBudgetLineAllocation()` method
   - Updated `prepareTransactionData()` and `prepareTransactionUpdateData()`

6. **BudgetLine Service** (`backend-nest/src/modules/budget-line/budget-line.service.ts`)
   - Added `getConsumedAmount()` method
   - Added `getRemainingAmount()` method
   - Added `getAllocatedTransactions()` method
   - Added `getWithTransactions()` method
   - Added `findByBudgetIdWithTransactions()` method

7. **BudgetLine Controller** (`backend-nest/src/modules/budget-line/budget-line.controller.ts`)
   - Added `GET /:id/transactions` endpoint
   - Added `GET /budget/:budgetId/with-transactions` endpoint

### Frontend (Angular)

1. **API Service** (`frontend/.../budget-line-api/budget-line-api.ts`)
   - Added `getAllocatedTransactions$()` method
   - Added `getBudgetLinesWithTransactions$()` method

2. **AllocatedTransactionsDialog** (`frontend/.../allocated-transactions-dialog/`)
   - Created dialog to display allocated transactions
   - Shows budget line summary (prévu, consommé, restant)
   - Displays transaction table with edit/delete actions
   - Button to add new transaction

3. **AllocatedTransactionFormDialog** (`frontend/.../allocated-transactions-dialog/`)
   - Form dialog for creating/editing transactions
   - Validates inputs
   - Auto-fills budget line context

4. **Budget Table Integration** (`frontend/.../budget-table/budget-table.ts`)
   - Added "Voir les transactions" button for budget lines
   - Opens AllocatedTransactionsDialog on click
   - Available on both mobile (menu) and desktop (icon button)

5. **E2E Tests** (`frontend/e2e/tests/features/allocated-transactions.spec.ts`)
   - Test for opening dialog from budget table
   - Test for empty state display
   - Mock helpers in `api-mocks.ts`

### Test Files Updated

- `frontend/.../mock-factories.ts` - Added `budgetLineId` to default transaction
- `frontend/.../budget-calculator.spec.ts` - Added `budgetLineId` to test transactions
- `frontend/.../current-month.spec.ts` - Added `budgetLineId` to test transactions
- `frontend/.../current-month-store.spec.ts` - Added `budgetLineId` to mock transactions
- `backend-nest/.../demo-data-generator.service.ts` - Added `budget_line_id: null`

## Deviations from Plan

- None significant - followed the plan closely

## Test Results

- Typecheck: ✓
- Lint: ✓ (only pre-existing warnings)
- Format: ✓
- Backend tests: Not run (no new unit tests added)
- E2E tests: Created but not executed (requires running app)

## Follow-up Tasks

1. **Run E2E tests** to validate the full flow
2. **Add unit tests** for new backend service methods
3. **Consider optimistic updates** in the dialog for better UX
4. **Performance optimization** if many transactions per budget line
5. **Add confirmation dialog** before deleting transactions (currently uses `confirm()`)
