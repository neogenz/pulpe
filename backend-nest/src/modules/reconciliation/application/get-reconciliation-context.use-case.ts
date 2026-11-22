import { Inject, Injectable } from '@nestjs/common';
import type { ReconciliationContext } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';
import { priorCorrection, type PriorMonth } from '../domain/prior-correction';
import {
  RECONCILIATION_STATE_REPOSITORY,
  type ReconciliationStateRepositoryPort,
} from '../domain/ports/reconciliation-state-repository.port';

@Injectable()
export class GetReconciliationContextUseCase {
  constructor(
    @Inject(RECONCILIATION_STATE_REPOSITORY)
    private readonly repo: ReconciliationStateRepositoryPort,
    @Inject(BUDGET_MONTH_READ_PORT)
    private readonly budgets: BudgetMonthReadPort,
  ) {}

  async execute(budgetId: string): Promise<ReconciliationContext> {
    // `null` too for a budget of someone else: nothing else is read then.
    const current = await this.budgets.readBudget(budgetId);
    if (!current) {
      throw new BusinessException(
        ERROR_DEFINITIONS.RECONCILIATION_BUDGET_NOT_FOUND,
        { id: budgetId },
      );
    }
    const [state, prior] = await Promise.all([
      this.repo.get(),
      this.#previousMonths(current.previousBudgetId),
    ]);
    return {
      startingAmount: state.startingAmount,
      hasCompletedComparison: state.lastCompletedAt !== null,
      ...priorCorrection(prior),
    };
  }

  /** The two existing budgets before this one, following `previousBudgetId`. */
  async #previousMonths(
    previousBudgetId: string | null,
  ): Promise<PriorMonth[]> {
    const months: PriorMonth[] = [];
    let id = previousBudgetId;
    for (const monthsAgo of [1, 2] as const) {
      const details = id ? await this.budgets.readBudget(id) : null;
      if (!details) break;
      months.push({ details, monthsAgo });
      id = details.previousBudgetId;
    }
    return months;
  }
}
