import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  SAVINGS_GOAL_WITHDRAWAL_POLICY,
  type SavingsGoalWithdrawalPolicyPort,
} from '@modules/savings-goal/domain/ports/savings-goal-withdrawal-policy.port';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';

@Injectable()
export class RemoveTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @Inject(SAVINGS_GOAL_WITHDRAWAL_POLICY)
    private readonly withdrawalPolicy: SavingsGoalWithdrawalPolicyPort,
    @InjectInfoLogger(RemoveTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    const context = await this.repo.findMutationContext(id);
    const budgetId = context?.budgetId ?? null;

    // Supprimer un retrait rend son montant au pot : la suppression passe donc
    // par le même verrou que la création. `debit: 0` — rien n'est prélevé, mais
    // la révision reste vérifiée, sinon deux suppressions concurrentes du même
    // retrait le rendraient deux fois. Un lien CASSÉ (objectif supprimé) n'a
    // plus de solde à défendre et repart par le chemin ordinaire.
    if (context?.sourceSavingsGoalId) {
      await this.withdrawalPolicy.runAgainstBalance({
        goalId: context.sourceSavingsGoalId,
        debit: 0,
        user,
        write: (expectedRevision) =>
          this.repo.deleteWithdrawal(id, expectedRevision),
      });
    } else {
      await this.repo.delete(id);
    }

    // Cache invalidation BEFORE recalc — if recalc fails, the about-to-be-stale
    // ending_balance won't be locked in as the new cached authoritative read.
    await this.cacheService.invalidateForUser(user.id);

    if (budgetId) {
      try {
        await this.budgetRecalculation.recalculate(budgetId);
      } catch (cause) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_DELETE_FAILED,
          { id },
          {
            operation: 'transaction.remove.recalcAfterDelete',
            severity: 'critical',
            partialFailure: true,
            budgetId,
            userId: user.id,
          },
          { cause },
        );
      }
    }

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.remove' },
      'Transaction deleted',
    );
  }
}
