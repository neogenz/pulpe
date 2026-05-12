import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type { BudgetRepositoryPort } from '../domain/ports/budget-repository.port';
import type { BudgetWithRelations } from '../domain/budget.entity';

const BUDGET_ID = 'budget-current';
const USER_ID = 'user-abc';

/**
 * Persisted `monthly_budget.ending_balance` is the CURRENT-MONTH DELTA only —
 * `income − expenses` for the month. Rollover from prior months is added at
 * READ time by `find-all-budgets.use-case.ts:117/131`. Storing rollover into
 * the column would compound across months on every read path that adds
 * rollover, double-counting the carry-over.
 *
 * Cross-stack contract:
 *   - frontend `excel-export.service.ts:103` displays `endingBalance` as the
 *     month's "Solde final" delta;
 *   - iOS `BudgetListView+YearComponents.swift:13` documents the contract
 *     verbatim: "Sum of endingBalance per month (remaining - rollover) to
 *     avoid double-counting rollover across months".
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

describe('RecalculateBudgetBalancesUseCase', () => {
  let useCase: RecalculateBudgetBalancesUseCase;
  let mockRepo: {
    fetchBudgetData: ReturnType<typeof mock>;
    fetchBudgetUserId: ReturnType<typeof mock>;
    fetchAllBudgetsForRollover: ReturnType<typeof mock>;
    persistEndingBalance: ReturnType<typeof mock>;
  };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    debug: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
    trace: ReturnType<typeof mock>;
  };

  beforeEach(() => {
    // A non-zero rollover so any regression that adds it to the persist path
    // shifts the asserted value visibly (400 → 1200), instead of 0 hiding the bug.
    mockRepo = {
      fetchBudgetData: mock(() => Promise.resolve(MOCK_BUDGET_DATA)),
      fetchBudgetUserId: mock(() => Promise.resolve(USER_ID)),
      fetchAllBudgetsForRollover: mock(() =>
        Promise.resolve([
          {
            id: 'budget-prior',
            month: 4,
            year: 2026,
            endingBalance: 800,
          },
          {
            id: BUDGET_ID,
            month: 5,
            year: 2026,
            endingBalance: null,
          },
        ]),
      ),
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
      mockLogger as never,
    );
  });

  describe('recalculate', () => {
    it('should persist current-month delta only (income − expenses), no rollover added', async () => {
      // Arrange
      // income=500, expenses=100 → expected delta = 400
      // Rollover MUST NOT be added at persist — it is applied at read time only.

      // Act
      await useCase.recalculate(BUDGET_ID);

      // Assert
      expect(mockRepo.persistEndingBalance).toHaveBeenCalledTimes(1);
      const persistedBalance = mockRepo.persistEndingBalance.mock
        .calls[0][1] as number;
      expect(persistedBalance).toBe(400);
    });

    it('should never call fetchAllBudgetsForRollover when persisting (rollover lives at read time)', async () => {
      // Act
      await useCase.recalculate(BUDGET_ID);

      // Assert: persist path must not touch rollover at all.
      expect(mockRepo.fetchAllBudgetsForRollover).not.toHaveBeenCalled();
    });
  });
});
