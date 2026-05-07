import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type TransactionDeleteResponse } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { BudgetService } from '@modules/budget/budget.service';
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
    private readonly budgetService: BudgetService,
    @InjectInfoLogger(RemoveTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionDeleteResponse> {
    const budgetId = await this.repo.fetchBudgetIdForTransaction(id, supabase);
    await this.repo.delete(id, supabase);

    if (budgetId) {
      await this.budgetService.recalculateBalances(
        budgetId,
        supabase,
        user.clientKey,
      );
    }

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.remove' },
      'Transaction deleted',
    );

    return { success: true, message: 'Transaction deleted successfully' };
  }
}
