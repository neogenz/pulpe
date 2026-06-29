import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type { SpreadOccurrence } from '../domain/budget-line.entity';
import type { BudgetLineSpreadOccurrencesPort } from '../domain/ports/budget-line-allocation.port';

/**
 * PUL-17 Lot C: read all occurrences of a spread group across their months.
 * RLS scopes the repo query to the caller, so an empty result means the group
 * does not exist OR is not owned → 404 (no ownership leak).
 */
@Injectable()
export class FindBudgetLinesBySpreadGroupUseCase implements BudgetLineSpreadOccurrencesPort {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @InjectInfoLogger(FindBudgetLinesBySpreadGroupUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    spreadGroupId: string,
    user: AuthenticatedUser,
  ): Promise<SpreadOccurrence[]> {
    const occurrences = await this.repo.findBySpreadGroupId(spreadGroupId);

    if (occurrences.length === 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: spreadGroupId },
        {
          operation: 'findBudgetLinesBySpreadGroup',
          entityId: spreadGroupId,
          userId: user.id,
        },
      );
    }

    this.logger.info(
      {
        userId: user.id,
        spreadGroupId,
        occurrences: occurrences.length,
        operation: 'budgetLine.spread.occurrences',
      },
      'Spread occurrences fetched',
    );

    return occurrences;
  }
}
