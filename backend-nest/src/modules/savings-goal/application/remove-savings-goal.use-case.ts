import { Inject, Injectable } from '@nestjs/common';
import { API_ERROR_CODES, type SavingsGoalDeletionCommand } from 'pulpe-shared';
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

@Injectable()
export class RemoveSavingsGoalUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(RemoveSavingsGoalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    command?: SavingsGoalDeletionCommand,
  ): Promise<void> {
    const touchedBudgetIds = command
      ? await this.applyDeletion(id, command)
      : await this.applyLegacyDeletion(id);

    await this.cacheService.invalidateForUser(user.id);
    await this.recalculateAfterCommit(touchedBudgetIds, id, user.id);

    this.logger.info(
      {
        savingsGoalId: id,
        userId: user.id,
        operation: 'savingsGoal.remove',
        mode: command?.mode ?? 'goal_only',
      },
      'Savings goal deleted',
    );
  }

  private async applyLegacyDeletion(id: string): Promise<string[]> {
    // Backward-compatible DELETE: FK SET NULL, no forecast is deleted.
    await this.repo.delete(id);
    return [];
  }

  private async applyDeletion(
    id: string,
    command: SavingsGoalDeletionCommand,
  ): Promise<string[]> {
    try {
      return (await this.repo.applyDeletion(id, command)).touchedBudgetIds;
    } catch (cause) {
      if (
        cause instanceof BusinessException &&
        cause.code === API_ERROR_CODES.CONCURRENT_MODIFICATION
      ) {
        throw new BusinessException(
          ERROR_DEFINITIONS.SAVINGS_GOAL_DELETION_IMPACT_CHANGED,
          undefined,
          {
            operation: 'savingsGoal.remove',
            savingsGoalId: id,
          },
          { cause },
        );
      }
      throw cause;
    }
  }

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
        ERROR_DEFINITIONS.SAVINGS_GOAL_DELETION_RECALCULATION_FAILED,
        undefined,
        {
          operation: 'savingsGoal.remove.recalcAfterCommit',
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
