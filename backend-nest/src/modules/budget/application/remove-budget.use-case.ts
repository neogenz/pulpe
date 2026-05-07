import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type BudgetDeleteResponse } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';

@Injectable()
export class RemoveBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(RemoveBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<BudgetDeleteResponse> {
    await this.repo.deleteBudget(id);
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { budgetId: id, userId: user.id, operation: 'budget.remove' },
      'Budget deleted',
    );

    return { success: true, message: 'Budget deleted successfully' };
  }
}
