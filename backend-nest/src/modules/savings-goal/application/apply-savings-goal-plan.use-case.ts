import { Inject, Injectable } from '@nestjs/common';
import {
  getBudgetPeriodForDate,
  periodIndex,
  type SavingsGoalPlanApply,
} from 'pulpe-shared';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalPlanApplyResult } from '../domain/savings-goal.entity';

/**
 * Applies a simulated savings-goal plan (PUL-12, docs/SAVINGS_PLAN.md §6.1).
 *
 * The client simulates a redistribution locally (< 400 ms, no round-trip), then
 * commits it here in ONE atomic RPC. The server stays authoritative: it
 * re-derives the current payDay-aware cycle so anything strictly before it is
 * locked, and re-computes budget balances after the write.
 *
 * NO idempotency key (unlike the spread flow): this is an UPDATE-by-value, so a
 * retry re-writes the same amounts (fresh ciphertexts decrypting to the same
 * numbers) and re-sets the same flags → identical final state, idempotent
 * recalc. The advisory lock inside the RPC closes the double-tap race. The only
 * hazard is a recalc that fails after the RPC committed; a retry re-applies and
 * re-recalculates (heals), mirroring the spread replay-heal rationale.
 */
@Injectable()
export class ApplySavingsGoalPlanUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(ApplySavingsGoalPlanUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: SavingsGoalPlanApply,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalPlanApplyResult> {
    // findById throws SAVINGS_GOAL_NOT_FOUND for a missing/foreign goal (RLS).
    await this.repo.findById(id);

    const payDayOfMonth = await this.repo.findPayDayOfMonth();
    // The current cycle stays editable while unchecked; everything strictly
    // before it is locked. Same period helper the client simulates with.
    const minPeriodIndex = periodIndex(
      getBudgetPeriodForDate(new Date(), payDayOfMonth),
    );

    const result = await this.repo.applyPlan(
      id,
      dto.monthAdjustments,
      dto.templateAdjustments,
      minPeriodIndex,
    );

    // Invalidate ONCE, post-RPC, pre-recalc: the plan touched budget lines.
    await this.cacheService.invalidateForUser(user.id);

    // Recalculate only the touched budgets (rollover is derived at read; the
    // template leg touches no generated budget → no recalc).
    await this.recalculateAfterCommit(result.touchedBudgetIds, id, user.id);

    this.logger.info(
      {
        operation: 'savingsGoal.planApply',
        userId: user.id,
        savingsGoalId: id,
        updatedLineCount: result.updatedLines.length,
        templateLineCount: result.updatedTemplateLineIds.length,
      },
      'Savings goal plan applied',
    );

    return result;
  }

  /**
   * The RPC already committed; a recalc failure leaves balances stale but the
   * amounts written. Surface it as a critical partial failure — a retry of the
   * whole apply re-writes the same values and re-recalculates (idempotent heal).
   */
  private async recalculateAfterCommit(
    budgetIds: string[],
    savingsGoalId: string,
    userId: string,
  ): Promise<void> {
    try {
      await Promise.all(
        budgetIds.map((budgetId) =>
          this.budgetRecalculation.recalculate(budgetId),
        ),
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_APPLY_FAILED,
        undefined,
        {
          operation: 'savingsGoal.planApply.recalcAfterCommit',
          severity: 'critical',
          partialFailure: true,
          affectedBudgetIds: budgetIds,
          savingsGoalId,
          userId,
        },
        { cause },
      );
    }
  }
}
