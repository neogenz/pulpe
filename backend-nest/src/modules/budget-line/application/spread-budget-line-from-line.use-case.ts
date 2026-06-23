import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetLineSpreadFromLineCreate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
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
 * on success). The fan-out core recalculates every touched budget once; this
 * terminal use case owns the single cache invalidation.
 */
@Injectable()
export class SpreadBudgetLineFromLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(BUDGET_LINE_SPREAD_PORT)
    private readonly spread: BudgetLineSpreadPort,
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

    // fanOutStrict provisions budgets for the missing months before the strict
    // RPC. If it throws AFTER creating some, those budgets are committed but the
    // success-path invalidate is never reached → GET /budgets serves a 30s-stale
    // list. Invalidate on the failure path too (the rule: any mutation invalidates).
    let result: SpreadFanOutResult;
    try {
      result = await this.spread.fanOutStrict(
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
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      throw error;
    }

    await this.cacheService.invalidateForUser(user.id);

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
}
