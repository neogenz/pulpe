import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalDeletionImpactResult } from '../domain/savings-goal.entity';

@Injectable()
export class GetSavingsGoalDeletionImpactUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @InjectInfoLogger(GetSavingsGoalDeletionImpactUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalDeletionImpactResult> {
    await this.repo.findById(id);
    const impact = await this.repo.getDeletionImpact(id);

    this.logger.info(
      {
        operation: 'savingsGoal.deletionImpact',
        savingsGoalId: id,
        userId: user.id,
        budgetCount: impact.summary.budgetCount,
      },
      'Savings goal deletion impact fetched',
    );

    return impact;
  }
}
