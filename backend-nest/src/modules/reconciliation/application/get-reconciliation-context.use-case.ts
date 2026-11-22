import { Inject, Injectable } from '@nestjs/common';
import type { ReconciliationContext } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';
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
    const state = await this.repo.get();
    return {
      startingAmount: state.startingAmount,
      hasCompletedComparison: state.lastCompletedAt !== null,
      // Previous months never count (spec.md §4.1); both keys stay for iOS 1.14.2.
      priorCorrection: 0,
      priorItems: [],
    };
  }
}
