import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';

@Injectable()
export class RemoveTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(RemoveTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    const budgetId = await this.repo.fetchBudgetIdForTransaction(id);
    await this.repo.delete(id);

    // Cache invalidation BEFORE recalc — if recalc fails, the about-to-be-stale
    // ending_balance won't be locked in as the new cached authoritative read.
    await this.cacheService.invalidateForUser(user.id);

    if (budgetId) {
      try {
        await this.budgetRecalculation.recalculate(budgetId, user.clientKey);
      } catch (cause) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_DELETE_FAILED,
          { id },
          {
            operation: 'transaction.remove.recalcAfterDelete',
            severity: 'critical',
            partialFailure: true,
            budgetId,
            userId: user.id,
          },
          { cause },
        );
      }
    }

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.remove' },
      'Transaction deleted',
    );
  }
}
