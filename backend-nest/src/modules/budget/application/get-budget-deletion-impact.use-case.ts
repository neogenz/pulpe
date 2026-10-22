import { Inject, Injectable } from '@nestjs/common';
import type { BudgetDeletionImpact } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { formatBusinessCalendarDate } from '@common/utils/business-calendar-date';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  assertDeletableMonth,
  summarizeDeletionImpact,
} from '../domain/budget-deletion';

/** What deleting this month takes with it. Refuses the current and past months. */
@Injectable()
export class GetBudgetDeletionImpactUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<BudgetDeletionImpact> {
    assertDeletableMonth(
      await this.repo.fetchBudgetById(id, user.id),
      formatBusinessCalendarDate(),
      user.payDayOfMonth,
      { operation: 'budget.deletionImpact', userId: user.id, entityId: id },
    );

    return summarizeDeletionImpact(await this.repo.fetchDeletionLinkRows(id));
  }
}
