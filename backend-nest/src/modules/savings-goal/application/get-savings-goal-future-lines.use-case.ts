import { Inject, Injectable } from '@nestjs/common';
import {
  getBudgetPeriodForDate,
  periodIndex,
  type LinkedSavingLine,
} from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';

/**
 * PUL-285 CA5 — candidates advisory à l'arrêt de génération : les prévisions
 * liées du cycle courant (payDay-aware) et au-delà, non pointées et non
 * ajustées à la main (CA9). Aucune borne à l'échéance : les lignes générées
 * après `target_date` sont candidates aussi. Lecture pure — aucune écriture ;
 * la conversion en DTO wire appartient au mapper, au boundary HTTP.
 */
@Injectable()
export class GetSavingsGoalFutureLinesUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
  ) {}

  async execute(
    id: string,
    _user: AuthenticatedUser,
  ): Promise<LinkedSavingLine[]> {
    await this.repo.findById(id);
    const payDayOfMonth = await this.repo.findPayDayOfMonth();
    const minPeriodIndex = periodIndex(
      getBudgetPeriodForDate(new Date(), payDayOfMonth),
    );

    const lines = await this.repo.findLinkedSavingLines(id);
    return lines
      .filter(
        (line) =>
          line.checkedAt == null &&
          line.isManuallyAdjusted !== true &&
          periodIndex(line) >= minPeriodIndex,
      )
      .sort((a, b) => periodIndex(a) - periodIndex(b));
  }
}
