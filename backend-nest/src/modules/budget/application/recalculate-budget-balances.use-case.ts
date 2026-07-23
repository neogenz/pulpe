import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import type { BudgetRecalculationPort } from '../domain/ports/budget-recalculation.port';
import {
  calculateEndingBalanceFromMetrics,
  calculateRolloverFromBudgets,
} from '../domain/budget.formulas';

@Injectable()
export class RecalculateBudgetBalancesUseCase implements BudgetRecalculationPort {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @InjectInfoLogger(RecalculateBudgetBalancesUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async recalculate(budgetId: string): Promise<void> {
    let endingBalance: number;
    try {
      endingBalance = await this.calculateEndingBalance(budgetId);
    } catch (error) {
      // Fail-safe over fail-closed: an undecryptable amount (e.g. a legacy
      // cross-DEK row) must NOT be persisted as a wrong balance, but it also
      // must not brick every mutation to this budget — the caller's write has
      // already committed. Skip the update (last correct balance survives) and
      // surface the poisoned row via logs. Any other error still propagates.
      if (this.#isDecryptFailure(error)) {
        this.logger.warn(
          { budgetId, operation: 'balance.recalc.skipped_undecryptable' },
          'Skipped ending balance recalculation: an amount could not be decrypted — last balance preserved',
        );
        return;
      }
      throw error;
    }

    await this.repo.persistEndingBalance(budgetId, endingBalance);

    this.logger.info(
      { budgetId, operation: 'balance.recalculated' },
      'Ending balance recalculated and persisted',
    );
  }

  #isDecryptFailure(error: unknown): boolean {
    return (
      error instanceof BusinessException &&
      error.code === ERROR_DEFINITIONS.ENCRYPTION_DECRYPT_FAILED.code
    );
  }

  async calculateEndingBalance(budgetId: string): Promise<number> {
    const { budgetLines, transactions } =
      await this.repo.fetchBudgetDataForRecalc(budgetId);

    return calculateEndingBalanceFromMetrics(budgetLines, transactions);
  }

  async getRollover(
    budgetId: string,
    payDayOfMonth: number,
  ): Promise<{ rollover: number; previousBudgetId: string | null }> {
    const userId = await this.repo.fetchBudgetUserId(budgetId);
    const allBudgets = await this.repo.fetchAllBudgetsForRollover(userId);

    if (!allBudgets.length) {
      return { rollover: 0, previousBudgetId: null };
    }

    const budgetsForFormula = allBudgets.map((b) => ({
      id: b.id,
      month: b.month,
      year: b.year,
      endingBalance: b.endingBalance ?? 0,
    }));

    return calculateRolloverFromBudgets(
      budgetsForFormula,
      budgetId,
      payDayOfMonth,
    );
  }
}
