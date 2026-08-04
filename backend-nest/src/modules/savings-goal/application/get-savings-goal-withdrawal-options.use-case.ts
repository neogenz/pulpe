import { Inject, Injectable } from '@nestjs/common';
import {
  computeSavingsGoalProgress,
  WITHDRAWAL_BALANCE_TOLERANCE,
} from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '@modules/user/domain/ports/user-repository.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoalBalanceInputs,
  SavingsGoalWithdrawalOptionResult,
} from '../domain/savings-goal.entity';

/**
 * Les objectifs proposables comme origine d'un revenu (PUL-329).
 *
 * Le filtre est ici, pas dans le client : un objectif vide n'est pas une
 * origine, et le client n'a aucun moyen honnête de le savoir — le solde se
 * calcule sur des montants que lui ne déchiffre pas. Les statuts `PAUSED` et
 * `COMPLETED` restent proposés : l'argent y est bien réel, et un objectif
 * atteint est justement celui dont on va se servir.
 */
@Injectable()
export class GetSavingsGoalWithdrawalOptionsUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepositoryPort,
  ) {}

  async execute(
    user: AuthenticatedUser,
  ): Promise<SavingsGoalWithdrawalOptionResult[]> {
    const [inputs, settings] = await Promise.all([
      this.repo.findAllBalanceInputs(),
      this.userRepo.findSettings(),
    ]);

    return inputs
      .map((entry) => ({
        goalId: entry.goal.id,
        name: entry.goal.name,
        status: entry.goal.status,
        availableAmount: this.confirmedBalance(entry, user),
        currency: settings.currency,
      }))
      .filter((option) => option.availableAmount > WITHDRAWAL_BALANCE_TOLERANCE)
      .sort((a, b) => b.availableAmount - a.availableAmount);
  }

  private confirmedBalance(
    entry: SavingsGoalBalanceInputs,
    user: AuthenticatedUser,
  ): number {
    const { confirmed } = computeSavingsGoalProgress({
      targetAmount: entry.goal.targetAmount,
      status: entry.goal.status,
      createdAt: entry.goal.createdAt,
      startDate: entry.goal.startDate,
      targetDate: entry.goal.targetDate,
      payDayOfMonth: user.payDayOfMonth ?? null,
      initialAmount: entry.goal.initialAmount ?? 0,
      lines: entry.lines,
      transactions: entry.transactions,
      withdrawals: entry.withdrawals,
    });
    return confirmed;
  }
}
