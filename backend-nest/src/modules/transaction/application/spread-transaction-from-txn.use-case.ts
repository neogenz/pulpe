import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TransactionSpreadFromTxnCreate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_LINE_SPREAD_PORT,
  type BudgetLineSpreadPort,
  type SpreadFanOutResult,
} from '@modules/budget-line/domain/ports/budget-line-spread.port';
import { buildSpreadFromExistingPlan } from '@modules/budget-line/domain/spread-from-existing.formulas';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionInvariants } from '../domain/transaction.invariants';

/**
 * PUL-17 v1.1 — TOTAL-PRESERVING spread of an existing FREE réel
 * (`POST /transactions/:id/spread`). Redistributes the réel's total `T` into N
 * `one_off` budget-line tranches of `T/N` (Σ === T) across the chosen months
 * (M0 included), then DELETES the réel — the actual is replaced by the
 * amortization plan (product-validated full redistribution).
 *
 * Cross-module: the budget-line fan-out is driven through `BUDGET_LINE_SPREAD_PORT`
 * (symbol + interface only — no concrete import), so this transaction-module use
 * case never depends on a budget-line use case (ADR-0002).
 *
 * Atomicity (PUL-17 v1.1 Defect 2): the réel deletion is folded INTO the strict
 * fan-out RPC — insert(N tranches) + delete(réel) are one all-or-nothing
 * transaction. Critical for a RÉEL: delete-then-fanout is NOT a safe fallback (a
 * fan-out failure after delete would LOSE the actual). A failure now leaves the
 * réel intact with nothing created; a retry can't duplicate (the réel is gone on
 * success). After the RPC, the cache is invalidated BEFORE the M0 recalc, then M0
 * is recalculated inside a guard that surfaces a `partialFailure` BusinessException
 * if the recalc throws (mirrors RemoveTransaction).
 */
@Injectable()
export class SpreadTransactionFromTxnUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @Inject(BUDGET_LINE_SPREAD_PORT)
    private readonly spread: BudgetLineSpreadPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(SpreadTransactionFromTxnUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: TransactionSpreadFromTxnCreate,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult> {
    const source = await this.repo.findSpreadSource(id);
    // Defense-in-depth IDOR guard mirroring the budget-line path's validateAccess:
    // RLS already scopes the query, but an explicit ownership check ensures a
    // bypass (accidental service_role, future RLS-less test) can't fan another
    // user's decrypted amount into the caller's budgets. NOT_FOUND avoids
    // resource enumeration. The user_id rides on findSpreadSource's existing join
    // — no extra query.
    if (source.userId !== user.id) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'transaction.spreadFromTxn.ownership',
          entityId: id,
          userId: user.id,
        },
      );
    }
    TransactionInvariants.validateSpreadFromTransactionSource(source);

    const plan = buildSpreadFromExistingPlan(source, dto.periods);

    const result = await this.spread.fanOutStrict(
      {
        name: source.name,
        kind: source.kind,
        tranches: plan.tranches,
        originalCurrency: plan.originalCurrency,
        targetCurrency: plan.targetCurrency,
        exchangeRate: plan.exchangeRate,
      },
      user,
      { type: 'transaction', id: source.id },
    );

    await this.invalidateThenRecalcM0(source.id, source.budgetId, user);

    this.logger.info(
      {
        userId: user.id,
        spreadGroupId: result.spreadGroupId,
        sourceTransactionId: source.id,
        linesCreated: result.lines.length,
        operation: 'transaction.spreadFromTxn',
      },
      'Free transaction spread into budget lines',
    );

    return result;
  }

  /**
   * Invalidate the cache BEFORE the M0 recalc (so a recalc failure can't lock in
   * the about-to-be-stale ending_balance as the cached read), then recalc M0
   * inside a guard surfacing a `partialFailure` BusinessException — the fan-out
   * (incl. the atomic réel delete) already committed, so a recalc throw leaves
   * the persisted M0 balance observably inconsistent (mirrors RemoveTransaction).
   */
  private async invalidateThenRecalcM0(
    sourceId: string,
    budgetId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.cacheService.invalidateForUser(user.id);

    try {
      await this.budgetRecalculation.recalculate(budgetId);
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_DELETE_FAILED,
        { id: sourceId },
        {
          operation: 'transaction.spreadFromTxn.recalcAfterFanOut',
          severity: 'critical',
          partialFailure: true,
          budgetId,
          userId: user.id,
        },
        { cause },
      );
    }
  }
}
