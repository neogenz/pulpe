import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { computeSavingsGoalProgress } from 'pulpe-shared';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalProgressComputation } from '../domain/savings-goal.entity';

/**
 * Progression d'un objectif (PUL-8) — les 9 formules de docs/SAVINGS.md §4.
 *
 * Le repo fournit la cible et les contributions DÉCHIFFRÉES ; le calcul est
 * payDay-aware via le payDayOfMonth de l'utilisateur. Tout est calculé côté
 * serveur — les clients n'implémentent aucune formule.
 */
@Injectable()
export class GetSavingsGoalProgressUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @InjectInfoLogger(GetSavingsGoalProgressUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalProgressComputation> {
    // findById throws SAVINGS_GOAL_NOT_FOUND for a missing/foreign goal (RLS).
    const goal = await this.repo.findById(id);
    const [{ lines, transactions }, payDayOfMonth] = await Promise.all([
      this.repo.findLinkedContributions(id),
      this.repo.findPayDayOfMonth(),
    ]);

    const computed = computeSavingsGoalProgress({
      targetAmount: goal.targetAmount,
      status: goal.status,
      createdAt: goal.createdAt,
      targetDate: goal.targetDate,
      payDayOfMonth,
      lines,
      transactions,
    });

    this.logger.info(
      {
        savingsGoalId: id,
        userId: user.id,
        operation: 'savingsGoal.progress',
        linkedLineCount: computed.linkedLineCount,
      },
      'Savings goal progress computed',
    );

    return { goal, computed };
  }
}
