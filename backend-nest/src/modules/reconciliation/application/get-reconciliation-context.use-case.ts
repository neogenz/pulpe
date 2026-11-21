import { Inject, Injectable } from '@nestjs/common';
import type { ReconciliationContext } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { RECONCILIATION_STATE_REPOSITORY } from '../reconciliation.tokens';
import type { ReconciliationStateRepositoryPort } from '../domain/ports/reconciliation-state-repository.port';

@Injectable()
export class GetReconciliationContextUseCase {
  constructor(
    @Inject(RECONCILIATION_STATE_REPOSITORY)
    private readonly repo: ReconciliationStateRepositoryPort,
  ) {}

  async execute(budgetId: string): Promise<ReconciliationContext> {
    if (!(await this.repo.budgetExists(budgetId))) {
      throw new BusinessException(
        ERROR_DEFINITIONS.RECONCILIATION_BUDGET_NOT_FOUND,
        { id: budgetId },
      );
    }
    const state = await this.repo.get();
    return {
      startingAmount: state.startingAmount,
      hasCompletedComparison: state.lastCompletedAt !== null,
      priorCorrection: 0,
      priorItems: [],
    };
  }
}
