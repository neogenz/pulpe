import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type TransactionCreate, type TransactionKind } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
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
  TransactionCreateInput,
} from '../domain/transaction.entity';

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @Inject(SAVINGS_GOAL_WITHDRAWAL_POLICY)
    private readonly withdrawalPolicy: SavingsGoalWithdrawalPolicyPort,
    @InjectInfoLogger(CreateTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: TransactionCreate,
    user: AuthenticatedUser,
  ): Promise<Transaction> {
    TransactionInvariants.validateCreate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);

    if (withRate.budgetLineId) {
      await this.validateBudgetLineAllocation(
        withRate.budgetLineId,
        withRate.budgetId,
        withRate.kind,
      );
    }

    const input: TransactionCreateInput = {
      id: withRate.id,
      budgetId: withRate.budgetId,
      budgetLineId: withRate.budgetLineId ?? null,
      name: withRate.name,
      amount: withRate.amount,
      originalAmount: withRate.originalAmount ?? null,
      originalCurrency: withRate.originalCurrency ?? null,
      targetCurrency: withRate.targetCurrency ?? null,
      exchangeRate: withRate.exchangeRate ?? null,
      kind: withRate.kind,
      tagIds: withRate.tagIds,
      transactionDate: withRate.transactionDate || new Date().toISOString(),
      checkedAt: withRate.checkedAt ?? null,
      sourceSavingsGoalId: withRate.sourceSavingsGoalId ?? null,
    };

    const entity = await this.insertUnderPolicy(input, user);

    // Cache invalidation BEFORE recalc — if recalc fails, the stale list
    // cache (missing the new transaction) won't survive the failed write.
    await this.cacheService.invalidateForUser(user.id);

    try {
      await this.budgetRecalculation.recalculate(entity.budgetId);
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        {
          operation: 'transaction.create.recalcAfterInsert',
          severity: 'critical',
          partialFailure: true,
          transactionId: entity.id,
          budgetId: entity.budgetId,
          userId: user.id,
        },
        { cause },
      );
    }

    this.logger.info(
      {
        transactionId: entity.id,
        userId: user.id,
        operation: 'transaction.create',
      },
      'Transaction created',
    );

    return entity;
  }

  /**
   * Un revenu venu d'un objectif est d'abord une sortie de stock : il ne
   * s'écrit qu'après vérification du solde, et sous la révision qui certifie
   * cette vérification. Le montant contrôlé est celui qui touche le compte
   * (`amount`, déjà converti), pas `originalAmount` — c'est bien celui-là qui
   * quitte le pot (RG-009).
   */
  private async insertUnderPolicy(
    input: TransactionCreateInput,
    user: AuthenticatedUser,
  ): Promise<Transaction> {
    const goalId = input.sourceSavingsGoalId;
    if (!goalId) return this.repo.insert(input);

    return this.withdrawalPolicy.runAgainstBalance({
      goalId,
      debit: input.amount,
      user,
      write: (expectedRevision) =>
        this.repo.insertWithdrawal(
          { ...input, sourceSavingsGoalId: goalId },
          expectedRevision,
        ),
    });
  }

  private async validateBudgetLineAllocation(
    budgetLineId: string,
    budgetId: string,
    transactionKind: TransactionKind,
  ): Promise<void> {
    const budgetLine =
      await this.repo.fetchBudgetLineForAllocation(budgetLineId);

    if (!budgetLine) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'validateBudgetLineAllocation',
          entityId: budgetLineId,
          entityType: 'budget_line',
        },
      );
    }

    if (budgetLine.budgetId !== budgetId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: 'Transaction budget must match budget line budget' },
      );
    }

    if (budgetLine.kind !== transactionKind) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: `Transaction kind must match budget line kind (expected: ${budgetLine.kind}, got: ${transactionKind})`,
        },
      );
    }
  }
}
