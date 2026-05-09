import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type { BudgetRepositoryPort } from '../domain/ports/budget-repository.port';
import type {
  BudgetForRollover,
  BudgetWithRelations,
} from '../domain/budget.entity';

const BUDGET_ID = 'budget-current';
const USER_ID = 'user-abc';
const CLIENT_KEY = Buffer.from('test-key');

/**
 * Current month budget data:
 *   - one income line: 500
 *   - one expense line: 100
 *   => income − expenses = 400
 *
 * Prior month budget:
 *   - endingBalance = 800 (rollover)
 *
 * Correct ending_balance = rollover + income − expenses = 800 + 500 − 100 = 1200
 * Buggy  ending_balance =              income − expenses =        500 − 100 =  400
 */

const MOCK_BUDGET_DATA: BudgetWithRelations = {
  budget: {
    id: BUDGET_ID,
    userId: USER_ID,
    templateId: 'tmpl-1',
    month: 5,
    year: 2026,
    description: 'May 2026',
    endingBalance: null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  },
  budgetLines: [
    {
      id: 'bl-income',
      budgetId: BUDGET_ID,
      templateLineId: null,
      savingsGoalId: null,
      name: 'Salary',
      amount: 500,
      originalAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
      kind: 'income',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
      checkedAt: null,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    },
    {
      id: 'bl-expense',
      budgetId: BUDGET_ID,
      templateLineId: null,
      savingsGoalId: null,
      name: 'Rent',
      amount: 100,
      originalAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
      checkedAt: null,
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    },
  ],
  transactions: [],
};

/** Prior month budget with a known rollover balance. */
const PRIOR_BUDGET: BudgetForRollover = {
  id: 'budget-april',
  month: 4,
  year: 2026,
  endingBalance: 800,
};

const CURRENT_BUDGET_FOR_ROLLOVER: BudgetForRollover = {
  id: BUDGET_ID,
  month: 5,
  year: 2026,
  endingBalance: null,
};

describe('RecalculateBudgetBalancesUseCase', () => {
  let useCase: RecalculateBudgetBalancesUseCase;
  let mockRepo: {
    fetchBudgetData: ReturnType<typeof mock>;
    fetchBudgetUserId: ReturnType<typeof mock>;
    fetchAllBudgetsForRollover: ReturnType<typeof mock>;
    fetchUserPayDayOfMonth: ReturnType<typeof mock>;
    persistEndingBalance: ReturnType<typeof mock>;
  };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    debug: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
    trace: ReturnType<typeof mock>;
  };

  beforeEach(() => {
    mockRepo = {
      fetchBudgetData: mock(() => Promise.resolve(MOCK_BUDGET_DATA)),
      fetchBudgetUserId: mock(() => Promise.resolve(USER_ID)),
      fetchAllBudgetsForRollover: mock(() =>
        Promise.resolve([PRIOR_BUDGET, CURRENT_BUDGET_FOR_ROLLOVER]),
      ),
      fetchUserPayDayOfMonth: mock(() => Promise.resolve(1)),
      persistEndingBalance: mock(() => Promise.resolve()),
    };

    mockLogger = {
      info: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      trace: mock(() => {}),
    };

    useCase = new RecalculateBudgetBalancesUseCase(
      mockRepo as unknown as BudgetRepositoryPort,
      mockLogger as any,
    );
  });

  describe('recalculate', () => {
    it('should persist ending_balance including rollover from prior month (expected: 1200, not 400)', async () => {
      // Arrange: prior month has endingBalance=800, current month has income=500, expense=100
      // Formula: ending_balance = rollover(800) + income(500) − expense(100) = 1200

      // Act
      await useCase.recalculate(BUDGET_ID, CLIENT_KEY);

      // Assert
      expect(mockRepo.persistEndingBalance).toHaveBeenCalledTimes(1);
      const persistedBalance = mockRepo.persistEndingBalance.mock
        .calls[0][1] as number;

      // This assertion FAILS if the bug is present (rollover ignored → 400 persisted)
      expect(persistedBalance).toBe(1200);
    });

    it('should NOT persist 400 (income minus expenses only, rollover ignored)', async () => {
      // Act
      await useCase.recalculate(BUDGET_ID, CLIENT_KEY);

      // Assert: 400 would mean rollover was never added
      const persistedBalance = mockRepo.persistEndingBalance.mock
        .calls[0][1] as number;
      expect(persistedBalance).not.toBe(400);
    });
  });
});
