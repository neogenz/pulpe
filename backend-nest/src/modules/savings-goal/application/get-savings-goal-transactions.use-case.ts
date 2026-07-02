import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalLinkedTransaction } from '../domain/savings-goal.entity';

/**
 * Transactions allouées aux prévisions Épargne liées à un objectif (PUL-12).
 *
 * `findById` valide d'abord l'existence — il lève SAVINGS_GOAL_NOT_FOUND pour un
 * objectif manquant ou appartenant à un autre utilisateur (RLS). On renvoie
 * ensuite les transactions déchiffrées, situées par le mois/année de leur budget
 * parent et triées par date décroissante côté repo.
 */
@Injectable()
export class GetSavingsGoalTransactionsUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @InjectInfoLogger(GetSavingsGoalTransactionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalLinkedTransaction[]> {
    // findById throws SAVINGS_GOAL_NOT_FOUND for a missing/foreign goal (RLS).
    await this.repo.findById(id);
    const transactions = await this.repo.findLinkedTransactions(id);

    this.logger.info(
      {
        savingsGoalId: id,
        userId: user.id,
        operation: 'savingsGoal.transactions',
        transactionCount: transactions.length,
      },
      'Savings goal transactions fetched',
    );

    return transactions;
  }
}
