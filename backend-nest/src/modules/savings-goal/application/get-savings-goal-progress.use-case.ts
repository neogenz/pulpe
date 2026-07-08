import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  buildSavingsGoalTimeline,
  computeSavingsGoalProgress,
  type SavingsGoalProgressInput,
} from 'pulpe-shared';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalProgressComputation } from '../domain/savings-goal.entity';

/**
 * Progression d'un objectif (PUL-8 + PUL-12) — les 11 formules de docs/SAVINGS.md
 * §4 / docs/SAVINGS_PLAN.md §5.1 plus la timeline mensuelle (ancrage → cible).
 *
 * Le repo fournit la cible et les contributions DÉCHIFFRÉES ; le calcul est
 * payDay-aware via le payDayOfMonth de l'utilisateur. `computeSavingsGoalProgress`
 * et `buildSavingsGoalTimeline` partagent le MÊME input (lignes/transactions
 * déchiffrées + payDay). Tout est calculé côté serveur — le serveur reste seul
 * propriétaire des formules canoniques.
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

    const input: SavingsGoalProgressInput = {
      targetAmount: goal.targetAmount,
      status: goal.status,
      createdAt: goal.createdAt,
      targetDate: goal.targetDate,
      payDayOfMonth,
      lines,
      transactions,
    };

    const computed = computeSavingsGoalProgress(input);
    const months = buildSavingsGoalTimeline(input);

    this.logger.info(
      {
        savingsGoalId: id,
        userId: user.id,
        operation: 'savingsGoal.progress',
        linkedLineCount: computed.linkedLineCount,
      },
      'Savings goal progress computed',
    );

    return { goal, computed, months };
  }
}
