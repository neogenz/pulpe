import { Inject, Injectable } from '@nestjs/common';
import type { BudgetDeletionImpact } from 'pulpe-shared';
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
  assertDeletableMonth,
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

  async execute(
    id: string,
    user: AuthenticatedUser,
    confirmLinks = false,
  ): Promise<BudgetDeletionImpact> {
    const loggingContext = {
      operation: 'budget.remove',
      userId: user.id,
      entityId: id,
    };
    assertDeletableMonth(
      await this.repo.fetchBudgetById(id, user.id),
      formatBusinessCalendarDate(),
      user.payDayOfMonth,
      loggingContext,
    );
    const impact = summarizeDeletionImpact(
      await this.repo.fetchDeletionLinkRows(id),
    );

    if (hasDeletionLinks(impact) && !confirmLinks) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_DELETION_LINKS_UNCONFIRMED,
        { links: impact.links },
        loggingContext,
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
