import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLineSpreadFromLineCreate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import {
  BUDGET_LINE_SPREAD_PORT,
  type BudgetLineSpreadPort,
  type SpreadFanOutResult,
} from '../domain/ports/budget-line-spread.port';
import { BudgetLineInvariants } from '../domain/budget-line.invariants';
import { buildSpreadFromExistingPlan } from '../domain/spread-from-existing.formulas';

/**
 * PUL-17 v1.1 — TOTAL-PRESERVING spread of an EXISTING prévision
 * (`POST /budget-lines/:id/spread`). Redistributes the source's total `T` into
 * N `one_off` tranches of `T/N` (Σ === T) across the chosen months (M0 included),
 * then DELETES the source. Distinct from the additive create flow, which keeps
 * the per-month amount the user typed.
 *
 * Atomicity (PUL-17 v1.1 Defect 2): the source deletion is folded INTO the
 * strict fan-out RPC — insert(N tranches) + delete(source) are one all-or-nothing
 * transaction. A failure leaves the source intact with nothing created (no
 * double-count, no money loss), and a retry can't duplicate (the source is gone
 * on success). After the RPC, the cache is invalidated BEFORE the M0 recalc, then
 * M0 is recalculated (its weight dropped T → T/N) inside a guard that surfaces a
 * `partialFailure` BusinessException if the recalc throws (the persisted M0
 * ending_balance is then observably inconsistent — mirrors RemoveBudgetLine).
 */
@Injectable()
export class SpreadBudgetLineFromLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(BUDGET_LINE_SPREAD_PORT)
    private readonly spread: BudgetLineSpreadPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(SpreadBudgetLineFromLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: BudgetLineSpreadFromLineCreate,
    user: AuthenticatedUser,
  ): Promise<SpreadFanOutResult> {
    await this.repo.validateAccess(id, user.id);
    const source = await this.repo.findSpreadSource(id);
    BudgetLineInvariants.validateSpreadFromLineSource(source);

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
      { type: 'budget_line', id: source.id },
    );

    await this.invalidateThenRecalcM0(source.id, source.budgetId, user);

    this.logger.info(
      {
        userId: user.id,
        spreadGroupId: result.spreadGroupId,
        sourceBudgetLineId: source.id,
        linesCreated: result.lines.length,
        operation: 'budgetLine.spreadFromLine',
      },
      'Budget line spread from existing prévision',
    );

    return result;
  }

  /**
   * Invalidate the cache BEFORE the M0 recalc (so a recalc failure can't lock in
   * the about-to-be-stale ending_balance as the cached read), then recalc M0
   * inside a guard surfacing a `partialFailure` BusinessException — the fan-out
   * (incl. the atomic source delete) already committed, so a recalc throw leaves
   * the persisted M0 balance observably inconsistent (mirrors RemoveBudgetLine).
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
        ERROR_DEFINITIONS.BUDGET_LINE_DELETE_FAILED,
        { id: sourceId },
        {
          operation: 'budgetLine.spreadFromLine.recalcAfterFanOut',
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
