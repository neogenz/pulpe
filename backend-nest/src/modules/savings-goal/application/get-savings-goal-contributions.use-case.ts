import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalContribution } from '../domain/savings-goal.entity';

/**
 * Contributions à un objectif (PUL-12) : une par prévision Épargne liée, avec
 * la période de son budget parent et les transactions qui lui sont allouées.
 *
 * `findById` valide d'abord l'existence — il lève SAVINGS_GOAL_NOT_FOUND pour un
 * objectif manquant ou appartenant à un autre utilisateur (RLS). Pointer une
 * prévision est une contribution SANS transaction : la liste part des lignes,
 * pas des transactions, sinon une prévision pointée sans réel disparaîtrait.
 */
@Injectable()
export class GetSavingsGoalContributionsUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @InjectInfoLogger(GetSavingsGoalContributionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalContribution[]> {
    // findById throws SAVINGS_GOAL_NOT_FOUND for a missing/foreign goal (RLS).
    await this.repo.findById(id);
    const contributions = await this.repo.findContributions(id);

    this.logger.info(
      {
        savingsGoalId: id,
        userId: user.id,
        operation: 'savingsGoal.contributions',
        contributionCount: contributions.length,
      },
      'Savings goal contributions fetched',
    );

    return contributions;
  }
}
