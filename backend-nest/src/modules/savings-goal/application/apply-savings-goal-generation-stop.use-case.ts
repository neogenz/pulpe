import { Inject, Injectable } from '@nestjs/common';
import {
  getBudgetPeriodForDate,
  periodIndex,
  type SavingsGoalGenerationStop,
} from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';

/**
 * PUL-285 CA5/CA8 — applique la décision advisory prise à l'arrêt d'un
 * objectif : `freeze` (délier + protéger de RG-001) ou `remove` (supprimer)
 * les prévisions liées futures listées. Écriture atomique dans la RPC — tout
 * id inéligible (pointé, ajusté, passé, étranger : CA9) → refus total.
 */
@Injectable()
export class ApplySavingsGoalGenerationStopUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(ApplySavingsGoalGenerationStopUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: SavingsGoalGenerationStop,
    user: AuthenticatedUser,
  ): Promise<{ affectedCount: number }> {
    await this.repo.findById(id);
    const payDayOfMonth = await this.repo.findPayDayOfMonth();
    const minPeriodIndex = periodIndex(
      getBudgetPeriodForDate(new Date(), payDayOfMonth),
    );

    const result = await this.repo.applyGenerationStop(
      id,
      dto.mode,
      dto.budgetLineIds,
      minPeriodIndex,
    );

    // Invalidate BEFORE recalc (cache-invalidation-backend rule): budget lines
    // changed; a recalc failure must not lock in a stale list cache.
    await this.cacheService.invalidateForUser(user.id);
    await this.recalculateAfterCommit(result.touchedBudgetIds, id, user.id);

    this.logger.info(
      {
        operation: 'savingsGoal.generationStop',
        userId: user.id,
        savingsGoalId: id,
        mode: dto.mode,
        affectedCount: result.affectedLineIds.length,
      },
      'Savings goal generation-stop decision applied',
    );

    return { affectedCount: result.affectedLineIds.length };
  }

  /**
   * The RPC already committed; a recalc failure leaves balances stale but the
   * decision applied. Surface as critical partial failure — a freeze retry
   * 422s harmlessly (lines no longer linked), a remove retry finds nothing.
   */
  private async recalculateAfterCommit(
    budgetIds: string[],
    savingsGoalId: string,
    userId: string,
  ): Promise<void> {
    try {
      await Promise.all(
        budgetIds.map((budgetId) =>
          this.budgetRecalculation.recalculate(budgetId),
        ),
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_GENERATION_STOP_RECALCULATION_FAILED,
        undefined,
        {
          operation: 'savingsGoal.generationStop.recalcAfterCommit',
          severity: 'critical',
          partialFailure: true,
          affectedBudgetIds: budgetIds,
          savingsGoalId,
          userId,
        },
        { cause },
      );
    }
  }
}
