import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type TransactionDeleteResponse } from 'pulpe-shared';
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

  async execute(
    id: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<TransactionDeleteResponse> {
    const budgetId = await this.repo.fetchBudgetIdForTransaction(id);
    await this.repo.delete(id);

    if (budgetId) {
      await this.budgetRecalculation.recalculate(budgetId, user.clientKey);
    }

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.remove' },
      'Transaction deleted',
    );

    return { success: true, message: 'Transaction deleted successfully' };
  }
}
