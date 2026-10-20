import { Inject, Injectable } from '@nestjs/common';
import {
  compareBudgetPeriods,
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  type BudgetDeletionImpact,
} from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { formatBusinessCalendarDate } from '@common/utils/business-calendar-date';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  hasDeletionLinks,
  summarizeDeletionImpact,
} from '../domain/budget-deletion';

@Injectable()
export class RemoveBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(RemoveBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  /** What deleting this month takes with it. Refuses the current and past months. */
  async impact(
    id: string,
    user: AuthenticatedUser,
  ): Promise<BudgetDeletionImpact> {
    const budget = await this.repo.fetchBudgetById(id, user.id);
    const livePeriod = getBudgetPeriodForDate(
      parseIsoDateLocal(formatBusinessCalendarDate()),
      user.payDayOfMonth,
    );

    if (compareBudgetPeriods(budget, livePeriod) <= 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_DELETABLE,
        undefined,
        { operation: 'budget.remove', userId: user.id, entityId: id },
      );
    }

    return summarizeDeletionImpact(await this.repo.fetchDeletionLinkRows(id));
  }

  async execute(
    id: string,
    user: AuthenticatedUser,
    confirmLinks = false,
  ): Promise<BudgetDeletionImpact> {
    const impact = await this.impact(id, user);

    if (hasDeletionLinks(impact) && !confirmLinks) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_DELETION_LINKS_UNCONFIRMED,
        { links: impact.links },
        { operation: 'budget.remove', userId: user.id, entityId: id },
      );
    }

    await this.repo.deleteBudget(id);
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetId: id,
        userId: user.id,
        confirmLinks,
        operation: 'budget.remove',
      },
      'Budget deleted',
    );

    return impact;
  }
}
