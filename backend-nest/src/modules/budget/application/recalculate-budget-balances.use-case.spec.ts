import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { RecalculateBudgetBalancesUseCase } from './recalculate-budget-balances.use-case';
import type {
  BudgetDataForRecalc,
  BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';

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

const MOCK_BUDGET_DATA: BudgetDataForRecalc = {
  budgetLines: [
    { id: 'bl-income', kind: 'income', amount: 500 },
    { id: 'bl-expense', kind: 'expense', amount: 100 },
  ],
  transactions: [],
};

describe('RecalculateBudgetBalancesUseCase', () => {
  let useCase: RecalculateBudgetBalancesUseCase;
  let mockRepo: {
    fetchBudgetDataForRecalc: ReturnType<typeof mock>;
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
      fetchBudgetDataForRecalc: mock(() => Promise.resolve(MOCK_BUDGET_DATA)),
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

    it('should never persist when strict decryption fails (fail-closed)', async () => {
      // Arrange: one undecryptable ciphertext aborts the whole recalculation.
      mockRepo.fetchBudgetDataForRecalc = mock(() =>
        Promise.reject(
          new BusinessException(ERROR_DEFINITIONS.ENCRYPTION_DECRYPT_FAILED, {
            budgetId: BUDGET_ID,
          }),
        ),
      );
      useCase = new RecalculateBudgetBalancesUseCase(
        mockRepo as unknown as BudgetRepositoryPort,
        mockLogger as never,
      );

      // Act + Assert
      await expect(useCase.recalculate(BUDGET_ID)).rejects.toMatchObject({
        code: ERROR_DEFINITIONS.ENCRYPTION_DECRYPT_FAILED.code,
      });
      expect(mockRepo.persistEndingBalance).not.toHaveBeenCalled();
    });
  });
});
