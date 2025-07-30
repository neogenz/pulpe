import type {
  BudgetDetailsResponse,
  BudgetLineResponse,
  Budget,
  BudgetLine,
  Transaction,
} from '@pulpe/shared';

/**
 * Type-safe helper functions for creating E2E API mocks using shared Zod schemas
 */

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
    userId: 'test-user',
    description: 'Test budget for E2E testing',
    templateId: 'test-template-123',
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
    kind: 'FIXED_EXPENSE',
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
      kind: line.kind || 'FIXED_EXPENSE',
    })
  );
}