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
import { accountIdForCreate } from '@common/utils/asset-link';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '@modules/user/domain/ports/user-repository.port';
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
  BudgetLineForAllocation,
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
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepositoryPort,
    @InjectInfoLogger(CreateTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: TransactionCreate,
    user: AuthenticatedUser,
  ): Promise<Transaction> {
    TransactionInvariants.validateCreate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);

    const allocatedLine = withRate.budgetLineId
      ? await this.resolveBudgetLineForAllocation(
          withRate.budgetLineId,
          withRate.budgetId,
          withRate.kind,
        )
      : null;

    const input: TransactionCreateInput = {
      id: withRate.id,
      budgetId: withRate.budgetId,
      budgetLineId: withRate.budgetLineId ?? null,
      // CA4: an allocated movement follows its prévision's account, never the
      // default one. CA44: neither does a reconciliation gap.
      accountId:
        allocatedLine || isUnmarkedReconciliationGap(withRate)
          ? null
          : await accountIdForCreate(withRate.accountId, null, () =>
              this.userRepo.findDefaultAccountId(),
            ),
      name: withRate.name,
      amount: withRate.amount,
      originalAmount: withRate.originalAmount ?? null,
      originalCurrency: withRate.originalCurrency ?? null,
      targetCurrency: withRate.targetCurrency ?? null,
      exchangeRate: withRate.exchangeRate ?? null,
      kind: withRate.kind,
      tagIds: withRate.tagIds,
      transactionDate: withRate.transactionDate || new Date().toISOString(),
      checkedAt:
        allocatedLine?.sourceSavingsGoalId != null
          ? new Date().toISOString()
          : (withRate.checkedAt ?? null),
      sourceSavingsGoalId: resolveSourceSavingsGoalId(withRate, allocatedLine),
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

  private async resolveBudgetLineForAllocation(
    budgetLineId: string,
    budgetId: string,
    transactionKind: TransactionKind,
  ): Promise<BudgetLineForAllocation> {
    const budgetLine =
      await this.repo.fetchBudgetLineForAllocation(budgetLineId);

    if (!budgetLine) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'resolveBudgetLineForAllocation',
          entityId: budgetLineId,
          entityType: 'budget_line',
        },
      );
    }

    if (budgetLine.budgetId !== budgetId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: 'Transaction budget must match budget line budget',
          lineBudgetId: budgetLine.budgetId,
        },
      );
    }

    TransactionInvariants.validateKindMatchesLine(
      budgetLine.kind,
      transactionKind,
    );

    // Le nom survit à la suppression de l'objectif, l'identifiant non. Sans
    // cette garde, réaliser une prévision orpheline la transformerait en revenu
    // ordinaire — l'argent apparaîtrait sans jamais sortir d'aucun pot.
    if (
      budgetLine.sourceSavingsGoalId === null &&
      budgetLine.sourceSavingsGoalName !== null
    ) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_TRANSACTION_INVALID,
        { reason: 'the source savings goal of this forecast no longer exists' },
      );
    }

    return budgetLine;
  }
}

/**
 * Deux chemins, une seule origine effective : un revenu LIBRE déclare la sienne
 * (le contrat client l'autorise là seulement), une transaction ALLOUÉE hérite
 * de celle de sa prévision. Le client n'envoie donc jamais deux fois la même
 * origine, et il ne peut pas non plus en inventer une sur une prévision qui
 * n'en porte pas.
 */
/**
 * The fixed name each app gives the gap « Comparer avec mes comptes » writes, in
 * every language: « Ajustement » up to iOS 1.14.1, « Écart avec mes comptes »
 * since.
 */
const RECONCILIATION_GAP_NAMES = new Set([
  'Écart avec mes comptes',
  'Gap with my accounts',
  'Abweichung zu meinen Konten',
  'Scarto con i miei conti',
  'Ajustement',
  'Adjustment',
  'Anpassung',
  'Aggiustamento',
]);

/**
 * CA44 for the apps installed before PUL-378 (iOS 1.14.x, Android): they send
 * the reconciliation gap without `accountId`, and the default account would
 * then absorb it. Among what those apps create, the gap is the free, already
 * checked movement carrying that fixed name. Current apps send `null` instead.
 */
function isUnmarkedReconciliationGap(
  dto: Pick<
    TransactionCreate,
    'accountId' | 'budgetLineId' | 'checkedAt' | 'name'
  >,
): boolean {
  return (
    dto.accountId === undefined &&
    !dto.budgetLineId &&
    dto.checkedAt != null &&
    RECONCILIATION_GAP_NAMES.has(dto.name.trim())
  );
}

function resolveSourceSavingsGoalId(
  dto: Pick<TransactionCreate, 'sourceSavingsGoalId'>,
  allocatedLine: BudgetLineForAllocation | null,
): string | null {
  if (allocatedLine) return allocatedLine.sourceSavingsGoalId;
  return dto.sourceSavingsGoalId ?? null;
}
