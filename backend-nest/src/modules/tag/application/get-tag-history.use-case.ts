import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  periodFromIndex,
  periodIndex,
  type TagHistoryQuery,
} from 'pulpe-shared';
import {
  TAG_REPOSITORY,
  type TagRepositoryPort,
} from '../domain/ports/tag-repository.port';
import type {
  TagHistory,
  TagHistoryContribution,
  TagHistoryContributions,
  TagHistoryMonth,
} from '../domain/tag.entity';

@Injectable()
export class GetTagHistoryUseCase {
  constructor(
    @Inject(TAG_REPOSITORY)
    private readonly repo: TagRepositoryPort,
    @InjectInfoLogger(GetTagHistoryUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    query: TagHistoryQuery,
    user: AuthenticatedUser,
  ): Promise<TagHistory> {
    await this.repo.findById(id); // Enforces ownership through the repository's RLS-scoped lookup.

    const endIndex = periodIndex({
      month: query.endMonth,
      year: query.endYear,
    });
    const startIndex = endIndex - query.months + 1;
    const contributions = await this.repo.findHistoryContributions(
      id,
      periodFromIndex(startIndex),
      periodFromIndex(endIndex),
    );
    const result = this.#buildHistory(id, query, startIndex, contributions);

    this.logger.info(
      {
        tagId: id,
        userId: user.id,
        operation: 'tag.history',
        months: query.months,
      },
      'Tag history computed',
    );

    return result;
  }

  #buildHistory(
    id: string,
    query: TagHistoryQuery,
    startIndex: number,
    contributions: TagHistoryContributions,
  ): TagHistory {
    const periods = Array.from({ length: query.months }, (_, offset) => ({
      ...periodFromIndex(startIndex + offset),
      plannedAmount: 0,
      actualAmount: 0,
    }));
    this.#sumContributions(periods, contributions.planned, 'plannedAmount');
    this.#sumContributions(periods, contributions.actual, 'actualAmount');

    const totalPlanned = periods.reduce(
      (sum, period) => sum + period.plannedAmount,
      0,
    );
    const totalActual = periods.reduce(
      (sum, period) => sum + period.actualAmount,
      0,
    );
    return {
      tagId: id,
      periods,
      totalPlanned,
      totalActual,
      monthlyAverageActual: totalActual / query.months,
      actualToPlannedPercent:
        totalPlanned === 0 ? null : (totalActual / totalPlanned) * 100,
    };
  }

  #sumContributions(
    periods: TagHistoryMonth[],
    contributions: TagHistoryContribution[],
    field: 'plannedAmount' | 'actualAmount',
  ): void {
    const byPeriod = new Map(
      periods.map((period) => [periodIndex(period), period]),
    );
    for (const contribution of contributions) {
      const period = byPeriod.get(periodIndex(contribution));
      if (period) period[field] += contribution.amount;
    }
  }
}
