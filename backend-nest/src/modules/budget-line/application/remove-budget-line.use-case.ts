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
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';

@Injectable()
export class RemoveBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(RemoveBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    // HI-09 contract: throws on real error, returns null only for genuine PGRST116 not-found.
    const budgetId = await this.repo.fetchBudgetIdForLine(id);
    await this.repo.delete(id);

    // Cache invalidation BEFORE recalc — if recalc fails, the about-to-be-stale
    // ending_balance won't be locked in as the new cached authoritative read.
    await this.cacheService.invalidateForUser(user.id);

    if (budgetId !== null) {
      try {
        await this.budgetRecalculation.recalculate(budgetId);
      } catch (cause) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_DELETE_FAILED,
          { id },
          {
            operation: 'budgetLine.remove.recalcAfterDelete',
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
      { budgetLineId: id, userId: user.id, operation: 'budgetLine.remove' },
      'Budget line deleted',
    );
  }
}
