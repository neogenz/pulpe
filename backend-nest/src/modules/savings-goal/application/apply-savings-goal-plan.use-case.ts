import { Inject, Injectable } from '@nestjs/common';
import {
  allocateMonthAmountToLines,
  getBudgetPeriodForDate,
  MAX_SAVINGS_GOAL_PLAN_PERIODS,
  parseIsoDateLocal,
  periodIndex,
  type BudgetPeriod,
  type LinkedSavingLine,
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
  BUDGET_PROVISIONING_PORT,
  type BudgetProvisioningPort,
} from '@modules/budget/domain/ports/budget-provisioning.port';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '@modules/budget-template/domain/ports/budget-template-repository.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoalPlanApplyResult } from '../domain/savings-goal.entity';

/**
 * Applies a simulated savings-goal plan (PUL-12, docs/SAVINGS.md §10.4).
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
    @Inject(BUDGET_PROVISIONING_PORT)
    private readonly provisioning: BudgetProvisioningPort,
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: BudgetTemplateRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(ApplySavingsGoalPlanUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: SavingsGoalPlanApply,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalPlanApplyResult> {
    const goal = await this.repo.findById(id);
    const payDayOfMonth = await this.repo.findPayDayOfMonth();
    // The current cycle stays editable while unchecked; everything strictly
    // before it is locked. Same period helper the client simulates with.
    const minPeriodIndex = periodIndex(
      getBudgetPeriodForDate(new Date(), payDayOfMonth),
    );
    const targetPeriodIndex = periodIndex(
      getBudgetPeriodForDate(parseIsoDateLocal(goal.targetDate), payDayOfMonth),
    );
    const missing = dto.missingMonthAdjustments ?? [];
    const linkedBefore = await this.repo.findLinkedContributions(id);
    this.validateDirectAdjustments(
      dto.monthAdjustments,
      missing,
      linkedBefore.lines,
      minPeriodIndex,
      id,
      user.id,
    );

    let provisionedMonthCount = 0;
    if (missing.length > 0) {
      provisionedMonthCount = await this.provisionMissingPeriods(
        id,
        missing,
        linkedBefore.lines,
        minPeriodIndex,
        targetPeriodIndex,
        user,
      );
    }

    let result: SavingsGoalPlanApplyResult;
    try {
      const linkedLines =
        missing.length > 0
          ? (await this.repo.findLinkedContributions(id)).lines
          : linkedBefore.lines;
      const lineAdjustments = [
        ...dto.monthAdjustments,
        ...this.allocateMissingMonths(missing, linkedLines, id, user.id),
      ];
      result = await this.repo.applyPlan(id, lineAdjustments, minPeriodIndex);
    } catch (error) {
      if (missing.length > 0) {
        await this.cacheService.invalidateForUser(user.id);
      }
      throw error;
    }

    // Invalidate ONCE, post-RPC, pre-recalc: the plan touched budget lines.
    await this.cacheService.invalidateForUser(user.id);

    // Recalculate only the touched budgets (rollover is derived at read).
    await this.recalculateAfterCommit(result.touchedBudgetIds, id, user.id);

    this.logger.info(
      {
        operation: 'savingsGoal.planApply',
        userId: user.id,
        savingsGoalId: id,
        updatedLineCount: result.updatedLines.length,
        provisionedMonthCount,
      },
      'Savings goal plan applied',
    );

    return result;
  }

  private validateDirectAdjustments(
    direct: SavingsGoalPlanApply['monthAdjustments'],
    missing: NonNullable<SavingsGoalPlanApply['missingMonthAdjustments']>,
    lines: LinkedSavingLine[],
    minPeriodIndex: number,
    goalId: string,
    userId: string,
  ): void {
    const linesById = new Map(lines.map((line) => [line.id, line]));
    const missingPeriods = new Set(missing.map(this.periodKey));
    for (const adjustment of direct) {
      const line = linesById.get(adjustment.budgetLineId);
      if (!line || missingPeriods.has(this.periodKey(line))) {
        this.throwLineInvalid(goalId, userId);
      }
      if (line.checkedAt != null || periodIndex(line) < minPeriodIndex) {
        this.throwConflict(goalId, userId);
      }
    }
  }

  private async provisionMissingPeriods(
    goalId: string,
    missing: NonNullable<SavingsGoalPlanApply['missingMonthAdjustments']>,
    linkedLines: LinkedSavingLine[],
    minPeriodIndex: number,
    targetPeriodIndex: number,
    user: AuthenticatedUser,
  ): Promise<number> {
    const periods = missing.map(({ month, year }) => ({ month, year }));
    const materialized = await this.repo.findMaterializedPeriods();
    const periodsToProvision = this.findPeriodsToProvision(
      periods,
      materialized,
      linkedLines,
      minPeriodIndex,
      targetPeriodIndex,
      goalId,
      user.id,
    );
    if (periodsToProvision.length === 0) return 0;

    const templateId = await this.templateRepo.findDefaultTemplateId(user.id);
    if (!templateId) this.throwMonthUnprovisionable(goalId, user.id);
    const templateLines =
      await this.templateRepo.findLinesByTemplateId(templateId);
    if (
      !templateLines.some(
        (line) => line.kind === 'saving' && line.savingsGoalId === goalId,
      )
    ) {
      this.throwMonthUnprovisionable(goalId, user.id);
    }

    try {
      const ensured = await this.provisioning.ensureBudgetsForPeriods(
        periodsToProvision,
        templateId,
        user.id,
      );
      if (ensured.skippedMonths.length > 0) {
        this.throwMonthUnprovisionable(goalId, user.id);
      }
      return ensured.createdBudgets.length;
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      throw error;
    }
  }

  private findPeriodsToProvision(
    periods: BudgetPeriod[],
    materialized: BudgetPeriod[],
    linkedLines: LinkedSavingLine[],
    minPeriodIndex: number,
    targetPeriodIndex: number,
    goalId: string,
    userId: string,
  ): BudgetPeriod[] {
    const materializedKeys = new Set(materialized.map(this.periodKey));
    const linkedPeriodKeys = new Set(linkedLines.map(this.periodKey));
    if (
      periods.some(
        (period) =>
          periodIndex(period) < minPeriodIndex ||
          periodIndex(period) > targetPeriodIndex ||
          periodIndex(period) >= minPeriodIndex + MAX_SAVINGS_GOAL_PLAN_PERIODS,
      )
    ) {
      this.throwLineInvalid(goalId, userId);
    }

    return periods.filter((period) => {
      const key = this.periodKey(period);
      if (!materializedKeys.has(key)) return true;
      if (!linkedPeriodKeys.has(key)) this.throwLineInvalid(goalId, userId);
      return false;
    });
  }

  private allocateMissingMonths(
    missing: NonNullable<SavingsGoalPlanApply['missingMonthAdjustments']>,
    lines: LinkedSavingLine[],
    goalId: string,
    userId: string,
  ): SavingsGoalPlanApply['monthAdjustments'] {
    return missing.flatMap((adjustment) => {
      const monthLines = lines.filter(
        (line) => this.periodKey(line) === this.periodKey(adjustment),
      );
      if (monthLines.length === 0) {
        this.throwMonthUnprovisionable(goalId, userId);
      }
      return allocateMonthAmountToLines(
        monthLines.map((line) => ({
          budgetLineId: line.id,
          amount: line.amount,
          checkedAt: line.checkedAt ?? null,
        })),
        adjustment.amount,
      );
    });
  }

  private readonly periodKey = (period: BudgetPeriod): string =>
    `${period.month}/${period.year}`;

  private throwLineInvalid(goalId: string, userId: string): never {
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_LINE_INVALID,
      undefined,
      {
        operation: 'savingsGoal.planApply',
        userId,
        goalId,
        entityId: goalId,
      },
    );
  }

  private throwConflict(goalId: string, userId: string): never {
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_CONFLICT,
      undefined,
      {
        operation: 'savingsGoal.planApply',
        userId,
        goalId,
        entityId: goalId,
      },
    );
  }

  private throwMonthUnprovisionable(goalId: string, userId: string): never {
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_MONTH_UNPROVISIONABLE,
      undefined,
      {
        operation: 'savingsGoal.planApply',
        userId,
        goalId,
        entityId: goalId,
      },
    );
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
