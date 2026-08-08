import { Inject, Injectable } from '@nestjs/common';
import {
  allocateMonthAmountToLines,
  buildSavingsGoalTimeline,
  getBudgetPeriodForDate,
  MAX_SAVINGS_GOAL_PLAN_PERIODS,
  parseIsoDateLocal,
  periodIndex,
  WITHDRAWAL_BALANCE_TOLERANCE,
  type BudgetPeriod,
  type LinkedSavingLine,
  type LinkedPlannedWithdrawal,
  type LinkedSavingTransaction,
  type LinkedSavingWithdrawal,
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
  BUDGET_LINE_SPREAD_PORT,
  type BudgetLineSpreadPort,
} from '@modules/budget-line/domain/ports/budget-line-spread.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalPlanApplyResult,
} from '../domain/savings-goal.entity';

type PlanWithdrawalAdjustments = NonNullable<
  SavingsGoalPlanApply['planWithdrawalAdjustments']
>;

interface PlanWithdrawalBalanceInput {
  goal: SavingsGoal;
  lines: LinkedSavingLine[];
  transactions: LinkedSavingTransaction[];
  withdrawals: LinkedSavingWithdrawal[];
  plannedWithdrawals: LinkedPlannedWithdrawal[];
  existingPlanWithdrawals: LinkedPlannedWithdrawal[];
  adjustments: PlanWithdrawalAdjustments;
  payDayOfMonth: number | null;
  userId: string;
}

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
    @Inject(BUDGET_LINE_SPREAD_PORT)
    private readonly spread: BudgetLineSpreadPort,
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
    // Same live `user_metadata` the guard already read for this request
    // (PUL-315) — re-asking GoTrue here would just be a second round trip.
    const payDayOfMonth = user.payDayOfMonth ?? null;
    // The current cycle stays editable while unchecked; everything strictly
    // before it is locked. Same period helper the client simulates with.
    const currentPeriodIndex = periodIndex(
      getBudgetPeriodForDate(new Date(), payDayOfMonth),
    );
    const createdPeriodIndex = periodIndex(
      getBudgetPeriodForDate(new Date(goal.createdAt), payDayOfMonth),
    );
    const startPeriodIndex =
      goal.startDate == null
        ? createdPeriodIndex
        : periodIndex(
            getBudgetPeriodForDate(
              parseIsoDateLocal(goal.startDate),
              payDayOfMonth,
            ),
          );
    const minPeriodIndex = Math.max(
      currentPeriodIndex,
      createdPeriodIndex,
      startPeriodIndex,
    );
    const targetPeriodIndex =
      goal.targetDate == null
        ? null
        : periodIndex(
            getBudgetPeriodForDate(
              parseIsoDateLocal(goal.targetDate),
              payDayOfMonth,
            ),
          );
    // A zero-amount gap describes nothing to create, so it is dropped before
    // any check rather than rejected: a client published before PUL-316 emits
    // one whenever the target is already met, and failing here would discard
    // the valid adjustments travelling in the same payload.
    const missing = (dto.missingMonthAdjustments ?? []).filter(
      (adjustment) => adjustment.amount > 0,
    );
    const planWithdrawals = dto.planWithdrawalAdjustments ?? [];
    const linkedBefore = await this.repo.findLinkedContributions(id);
    this.validateDirectAdjustments(
      dto.monthAdjustments,
      missing,
      linkedBefore.lines,
      minPeriodIndex,
      id,
      user.id,
    );
    if (missing.length > 0 && targetPeriodIndex == null) {
      this.throwLineInvalid(id, user.id);
    }
    this.validatePlanWithdrawalPeriods(
      planWithdrawals,
      { minPeriodIndex, targetPeriodIndex },
      id,
      user.id,
    );
    if (planWithdrawals.length > 0) {
      const [withdrawals, plannedWithdrawals, existingPlanWithdrawals] =
        await Promise.all([
          this.repo.findLinkedWithdrawals(id),
          this.repo.findPlannedWithdrawals(id),
          this.repo.findPlanWithdrawals(id),
        ]);
      this.assertPlanWithdrawalBalance({
        goal,
        lines: linkedBefore.lines,
        transactions: linkedBefore.transactions,
        withdrawals,
        plannedWithdrawals,
        existingPlanWithdrawals,
        adjustments: planWithdrawals,
        payDayOfMonth,
        userId: user.id,
      });
    }

    let provisionedMonthCount = 0;
    if (missing.length > 0) {
      provisionedMonthCount = await this.provisionMissingPeriods(
        goal,
        missing,
        linkedBefore.lines,
        { minPeriodIndex, targetPeriodIndex },
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
      result = await this.repo.applyPlan(
        id,
        lineAdjustments,
        minPeriodIndex,
        planWithdrawals,
      );
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

  /**
   * PUL-316 — le mois manquant reçoit sa prévision liée DIRECTEMENT, sans passer
   * par le Mois Type. Un objectif daté n'y pose plus de récurrence : exiger une
   * ligne modèle à recopier rendrait le comblement de trou impossible. Le
   * lissage provisionne le budget absent puis y insère la prévision liée —
   * exactement le geste d'un ajout manuel dans le budget du mois.
   */
  private async provisionMissingPeriods(
    goal: SavingsGoal,
    missing: NonNullable<SavingsGoalPlanApply['missingMonthAdjustments']>,
    linkedLines: LinkedSavingLine[],
    bounds: { minPeriodIndex: number; targetPeriodIndex: number | null },
    user: AuthenticatedUser,
  ): Promise<number> {
    const periodsToProvision = this.findPeriodsToProvision(
      missing.map(({ month, year }) => ({ month, year })),
      linkedLines,
      bounds,
      { goalId: goal.id, userId: user.id },
    );
    if (periodsToProvision.length === 0) return 0;

    // Filter `missing` itself rather than looking amounts up by period: the
    // amount then travels with its own period, so no key can go unmatched and
    // no zero-amount fallback can ever reach a budget.
    const provisionKeys = new Set(periodsToProvision.map(this.periodKey));

    try {
      // No `spreadGroupId` on purpose: this flow is retry-safe by re-reading,
      // not by replay. A retry re-derives `periodsToProvision` from freshly
      // fetched linked lines, so a period the failed attempt already filled is
      // simply no longer missing.
      const result = await this.spread.fanOut(
        {
          name: goal.name,
          kind: 'saving',
          savingsGoalId: goal.id,
          tranches: missing
            .filter((adjustment) =>
              provisionKeys.has(this.periodKey(adjustment)),
            )
            .map(({ year, month, amount }) => ({ year, month, amount })),
        },
        user,
      );
      if (result.skippedMonths.length > 0) {
        this.throwMonthUnprovisionable(goal.id, user.id);
      }
      return result.createdBudgets.length;
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      throw error;
    }
  }

  private findPeriodsToProvision(
    periods: BudgetPeriod[],
    linkedLines: LinkedSavingLine[],
    bounds: { minPeriodIndex: number; targetPeriodIndex: number | null },
    owner: { goalId: string; userId: string },
  ): BudgetPeriod[] {
    const linkedPeriodKeys = new Set(linkedLines.map(this.periodKey));
    if (
      periods.some(
        (period) =>
          periodIndex(period) < bounds.minPeriodIndex ||
          (bounds.targetPeriodIndex != null &&
            (periodIndex(period) > bounds.targetPeriodIndex ||
              periodIndex(period) >=
                bounds.minPeriodIndex + MAX_SAVINGS_GOAL_PLAN_PERIODS)),
      )
    ) {
      this.throwLineInvalid(owner.goalId, owner.userId);
    }

    return periods.filter(
      (period) => !linkedPeriodKeys.has(this.periodKey(period)),
    );
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

  private validatePlanWithdrawalPeriods(
    adjustments: PlanWithdrawalAdjustments,
    bounds: { minPeriodIndex: number; targetPeriodIndex: number | null },
    goalId: string,
    userId: string,
  ): void {
    if (
      adjustments.some((adjustment) => {
        const index = periodIndex(adjustment);
        return (
          adjustment.amount > 0 ||
          index < bounds.minPeriodIndex ||
          index >= bounds.minPeriodIndex + MAX_SAVINGS_GOAL_PLAN_PERIODS ||
          (bounds.targetPeriodIndex != null && index > bounds.targetPeriodIndex)
        );
      })
    ) {
      this.throwLineInvalid(goalId, userId);
    }
  }

  private assertPlanWithdrawalBalance(input: PlanWithdrawalBalanceInput): void {
    const independentPlanned = input.plannedWithdrawals.filter(
      (withdrawal) => withdrawal.origin !== 'plan_linked',
    );
    const existingManaged = [
      ...input.existingPlanWithdrawals,
      ...input.plannedWithdrawals.filter(
        (withdrawal) => withdrawal.origin === 'plan_linked',
      ),
    ];
    const resultingManaged = this.mergePlanWithdrawals(
      existingManaged,
      input.adjustments,
    );
    const before = this.minimumProjectedBalance(input, [
      ...independentPlanned,
      ...existingManaged,
    ]);
    const after = this.minimumProjectedBalance(input, [
      ...independentPlanned,
      ...resultingManaged,
    ]);

    if (
      after < -WITHDRAWAL_BALANCE_TOLERANCE &&
      after < before - WITHDRAWAL_BALANCE_TOLERANCE
    ) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE,
        undefined,
        {
          operation: 'savingsGoal.planApply.assertWithdrawalBalance',
          entityId: input.goal.id,
          userId: input.userId,
        },
      );
    }
  }

  private mergePlanWithdrawals(
    existing: LinkedPlannedWithdrawal[],
    adjustments: PlanWithdrawalAdjustments,
  ): LinkedPlannedWithdrawal[] {
    const resultingByPeriod = new Map(
      existing.map((withdrawal) => [this.periodKey(withdrawal), withdrawal]),
    );
    for (const adjustment of adjustments) {
      const key = this.periodKey(adjustment);
      if (adjustment.amount === 0) {
        resultingByPeriod.delete(key);
      } else {
        resultingByPeriod.set(key, {
          id: resultingByPeriod.get(key)?.id ?? `plan:${key}`,
          amount: -adjustment.amount,
          month: adjustment.month,
          year: adjustment.year,
          origin:
            adjustment.destination === 'linked_income' ? 'plan_linked' : 'plan',
        });
      }
    }
    return [...resultingByPeriod.values()];
  }

  private minimumProjectedBalance(
    input: PlanWithdrawalBalanceInput,
    plannedWithdrawals: LinkedPlannedWithdrawal[],
  ): number {
    const timeline = buildSavingsGoalTimeline({
      targetAmount: input.goal.targetAmount,
      status: input.goal.status,
      createdAt: input.goal.createdAt,
      startDate: input.goal.startDate,
      targetDate: input.goal.targetDate,
      payDayOfMonth: input.payDayOfMonth,
      initialAmount: input.goal.initialAmount ?? 0,
      lines: input.lines,
      transactions: input.transactions,
      withdrawals: input.withdrawals,
      plannedWithdrawals,
    });
    return Math.min(
      ...timeline.map(
        (month) => month.projectedCumulative ?? Number.POSITIVE_INFINITY,
      ),
    );
  }

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
