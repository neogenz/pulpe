import { Inject, Injectable } from '@nestjs/common';
import type { ReconciliationContext } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  BUDGET_MONTH_READ_PORT,
  type BudgetMonthReadPort,
} from '@modules/budget/domain/ports/budget-month-read.port';

@Injectable()
export class GetReconciliationContextUseCase {
  constructor(
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
    return {
      // Neither money from before Pulpe nor previous months count (spec.md §4.1);
      // these keys stay for iOS 1.14.2, which requires them. Always completed:
      // otherwise that build still asks whether the gap was there before Pulpe.
      startingAmount: 0,
      hasCompletedComparison: true,
      priorCorrection: 0,
      priorItems: [],
    };
  }
}
