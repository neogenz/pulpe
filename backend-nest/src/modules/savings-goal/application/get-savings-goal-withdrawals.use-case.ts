import { Inject, Injectable } from '@nestjs/common';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalWithdrawalRecord } from '../domain/savings-goal.entity';

/**
 * L'historique des retraits d'un objectif (PUL-329), du plus récent au plus
 * ancien.
 *
 * `findById` d'abord : sous RLS, un objectif inexistant et un objectif
 * étranger sont indiscernables, et tous deux méritent un 404 plutôt qu'une
 * liste vide — laquelle laisserait croire qu'un objectif bien réel n'a jamais
 * servi.
 */
@Injectable()
export class GetSavingsGoalWithdrawalsUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
  ) {}

  async execute(goalId: string): Promise<SavingsGoalWithdrawalRecord[]> {
    await this.repo.findById(goalId);
    return this.repo.findWithdrawals(goalId);
  }
}
