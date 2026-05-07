import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineDeleteResponse } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { BudgetService } from '@modules/budget/budget.service';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';

@Injectable()
export class RemoveBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly budgetService: BudgetService,
    @InjectInfoLogger(RemoveBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineDeleteResponse> {
    const budgetId = await this.repo.fetchBudgetIdForLine(id, supabase);
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
      { budgetLineId: id, userId: user.id, operation: 'budgetLine.remove' },
      'Budget line deleted',
    );

    return { success: true, message: 'Budget line deleted successfully' };
  }
}
