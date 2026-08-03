import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type TransactionUpdate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
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
import { TransactionInvariants } from '../domain/transaction.invariants';
import type {
  Transaction,
  TransactionMutationContext,
  TransactionUpdatePatch,
} from '../domain/transaction.entity';

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @Inject(SAVINGS_GOAL_WITHDRAWAL_POLICY)
    private readonly withdrawalPolicy: SavingsGoalWithdrawalPolicyPort,
    @InjectInfoLogger(UpdateTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: TransactionUpdate,
    user: AuthenticatedUser,
  ): Promise<Transaction> {
    TransactionInvariants.validateUpdate(dto);

    const context = await this.repo.findMutationContext(id);
    if (context?.sourceSavingsGoalId || context?.sourceSavingsGoalName) {
      TransactionInvariants.validateWithdrawalUpdate(dto);
    }

    const withRate = await this.currencyService.overrideExchangeRate(dto);

    const patch: TransactionUpdatePatch = {
      ...(withRate.amount !== undefined && { amount: withRate.amount }),
      ...(withRate.name !== undefined && { name: withRate.name }),
      ...(withRate.kind !== undefined && { kind: withRate.kind }),
      ...(withRate.transactionDate !== undefined && {
        transactionDate: withRate.transactionDate,
      }),
      ...(withRate.tagIds !== undefined && { tagIds: withRate.tagIds }),
      ...(withRate.originalAmount !== undefined && {
        originalAmount: withRate.originalAmount,
      }),
      ...(withRate.originalCurrency !== undefined && {
        originalCurrency: withRate.originalCurrency,
      }),
      ...(withRate.targetCurrency !== undefined && {
        targetCurrency: withRate.targetCurrency,
      }),
      ...(withRate.exchangeRate !== undefined && {
        exchangeRate: withRate.exchangeRate,
      }),
    };

    const entity = await this.updateUnderPolicy(id, patch, context, user);

    // Cache invalidation BEFORE recalc — if recalc fails, the stale cached
    // list won't be locked in as authoritative against the just-mutated row.
    await this.cacheService.invalidateForUser(user.id);

    try {
      await this.budgetRecalculation.recalculate(entity.budgetId);
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
        { id },
        {
          operation: 'transaction.update.recalcAfterUpdate',
          severity: 'critical',
          partialFailure: true,
          transactionId: id,
          budgetId: entity.budgetId,
          userId: user.id,
        },
        { cause },
      );
    }

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.update' },
      'Transaction updated',
    );

    return entity;
  }

  /**
   * Éditer un retrait le remplace : l'ancien montant revient au pot
   * (`creditBack`) avant que le nouveau n'en sorte. Sans cela, passer un
   * retrait de 500 à 510 exigerait 510 de disponible en plus des 500 déjà
   * sortis, et l'ajustement le plus banal serait refusé.
   *
   * Une édition qui ne touche pas au montant garde `debit = creditBack` : rien
   * ne bouge, mais l'écriture reste sous la révision — la date d'un retrait
   * change sa place dans la chronologie du plan.
   */
  private async updateUnderPolicy(
    id: string,
    patch: TransactionUpdatePatch,
    context: TransactionMutationContext | null,
    user: AuthenticatedUser,
  ): Promise<Transaction> {
    const goalId = context?.sourceSavingsGoalId;
    if (!context || !goalId) return this.repo.update(id, patch);

    return this.withdrawalPolicy.runAgainstBalance({
      goalId,
      debit: patch.amount ?? context.amount,
      creditBack: context.amount,
      user,
      write: (expectedRevision) =>
        this.repo.updateWithdrawal(id, patch, expectedRevision),
    });
  }
}
