import type {
  BudgetDetailsResponse,
  BudgetLineResponse,
  Budget,
  BudgetLine,
  Transaction,
} from '@pulpe/shared';

/**
 * Type-safe helper functions for creating E2E API mocks using shared Zod schemas
 *
 * IMPORTANT: All IDs must be valid UUIDs to pass Zod runtime validation.
 */

// Predefined valid UUIDs for testing (avoids generating random UUIDs in tests)
export const TEST_UUIDS = {
  BUDGET_1: '00000000-0000-4000-a000-000000000001',
  BUDGET_2: '00000000-0000-4000-a000-000000000002',
  TEMPLATE_1: '00000000-0000-4000-a000-000000000101',
  TEMPLATE_2: '00000000-0000-4000-a000-000000000102',
  USER_1: '00000000-0000-4000-a000-000000000201',
  LINE_1: '00000000-0000-4000-a000-000000001001',
  LINE_2: '00000000-0000-4000-a000-000000001002',
  LINE_3: '00000000-0000-4000-a000-000000001003',
  LINE_4: '00000000-0000-4000-a000-000000001004',
  LINE_5: '00000000-0000-4000-a000-000000001005',
  LINE_6: '00000000-0000-4000-a000-000000001006',
  LINE_7: '00000000-0000-4000-a000-000000001007',
  LINE_8: '00000000-0000-4000-a000-000000001008',
  TRANSACTION_1: '00000000-0000-4000-a000-000000002001',
  TRANSACTION_2: '00000000-0000-4000-a000-000000002002',
} as const;

export function createBudgetDetailsMock(
  budgetId: string,
  overrides?: {
    budget?: Partial<Budget>;
    budgetLines?: BudgetLine[];
    transactions?: Transaction[];
  }
): BudgetDetailsResponse {
  const defaultBudget: Budget = {
    id: budgetId,
    month: 1,
    year: 2025,
    userId: TEST_UUIDS.USER_1,
    description: 'Test budget for E2E testing',
    templateId: TEST_UUIDS.TEMPLATE_1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides?.budget,
  };

  return {
    success: true,
    data: {
      budget: defaultBudget,
      transactions: overrides?.transactions || [],
      budgetLines: overrides?.budgetLines || [],
    },
  };
}

export function createBudgetLineMock(
  id: string,
  budgetId: string,
  overrides?: Partial<BudgetLine>
): BudgetLine {
  return {
    id,
    budgetId,
    name: 'Test Budget Line',
    amount: 100,
    kind: 'expense',
    recurrence: 'one_off',
    isManuallyAdjusted: false,
    templateLineId: null,
    savingsGoalId: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createBudgetLineResponseMock(
  budgetLine: BudgetLine
): BudgetLineResponse {
  return {
    success: true,
    data: budgetLine,
  };
}

export function createMultipleBudgetLinesMock(
  budgetId: string,
  lines: { id: string; name: string; amount: number; kind?: BudgetLine['kind'] }[]
): BudgetLine[] {
  return lines.map((line) =>
    createBudgetLineMock(line.id, budgetId, {
      name: line.name,
      amount: line.amount,
      kind: line.kind || 'expense',
    })
  );
}