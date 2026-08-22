import {
  allocateMonthAmountToLines,
  currentPlanMovement,
  isContributivePlanMonth,
  isOpenPlanMonth,
  redistributeRemainingEffort,
  type SavingsGoalPlanApply,
  type SavingsGoalProgress,
  type SavingsPlanAdjustment,
  type SavingsPlanSimulatedMonth,
  type SavingsPlanSimulationResult,
  type SavingsPlanTimelineMonth,
  simulateSavingsPlan,
} from "pulpe-shared";

/** `year * 12 + month` — the key `simulateSavingsPlan` adjustments are matched on. */
export function monthKey(period: { month: number; year: number }): number {
  return period.year * 12 + period.month;
}

/**
 * A month whose withdrawal the plan already drives.
 *
 * Editing one means replacing that withdrawal, which the wire expresses through
 * `planWithdrawalAdjustments` and a destination the user has to pick. Android
 * has no entry point for a negative movement, so these months are pinned at
 * what they already say and left out of every edit — the simulation then
 * matches what applying would write.
 */
export function hasManagedWithdrawal(month: SavingsPlanTimelineMonth): boolean {
  return (
    (month.planOnlyWithdrawalAmount ?? 0) +
      (month.planLinkedWithdrawalAmount ?? 0) >
    0
  );
}

export function isEditablePlanMonth(month: SavingsPlanTimelineMonth): boolean {
  return isContributivePlanMonth(month) && !hasManagedWithdrawal(month);
}

/** Baseline movements of the months an edit must never move. */
export function pinnedAdjustments(
  timeline: SavingsPlanTimelineMonth[],
): SavingsPlanAdjustment[] {
  return timeline
    .filter(
      (month) => isContributivePlanMonth(month) && !isEditablePlanMonth(month),
    )
    .map((month) => ({
      month: month.month,
      year: month.year,
      amount: currentPlanMovement(month),
    }));
}

export type PlanOverrides = Readonly<Record<number, number>>;

export function simulatePlan(
  timeline: SavingsPlanTimelineMonth[],
  progress: SavingsGoalProgress,
  overrides: PlanOverrides,
): SavingsPlanSimulationResult {
  const edits: SavingsPlanAdjustment[] = timeline
    .filter((month) => overrides[monthKey(month)] !== undefined)
    .map((month) => ({
      month: month.month,
      year: month.year,
      amount: overrides[monthKey(month)],
    }));

  return simulateSavingsPlan({
    timeline,
    targetAmount: progress.targetAmount,
    adjustments: [...pinnedAdjustments(timeline), ...edits],
    initialAmount: progress.initialAmount,
  });
}

/**
 * « Réajuster la suite » — spreads what is left to save over the editable
 * months, cent-exact. Months carrying a withdrawal keep their movement.
 */
export function redistributedOverrides(
  timeline: SavingsPlanTimelineMonth[],
  progress: SavingsGoalProgress,
): PlanOverrides | null {
  const result = redistributeRemainingEffort({
    timeline,
    targetAmount: progress.targetAmount,
    pinnedAdjustments: pinnedAdjustments(timeline),
    initialAmount: progress.initialAmount,
  });
  if (!result.isDistributable) return null;

  return Object.fromEntries(
    result.adjustments.map((adjustment) => [
      monthKey(adjustment),
      adjustment.amount,
    ]),
  );
}

/**
 * The months a plan would actually write. A creation left at zero describes
 * nothing to create, so it is dropped rather than carried to the server.
 */
export function planChanges(
  result: SavingsPlanSimulationResult,
): SavingsPlanSimulatedMonth[] {
  return result.months.filter(
    (month) =>
      isEditablePlanMonth(month) &&
      month.isAdjusted &&
      !(month.isProvisionable === true && month.simulatedAmount === 0),
  );
}

/**
 * Turns the edited months into the two legs the plan endpoint accepts: the
 * amount of a materialised month is spread over its unchecked lines, and a
 * month with no budget yet is asked for as a period.
 *
 * Returns null when there is nothing to write — an empty plan is refused by
 * the schema, so it must never be sent.
 */
export function buildPlanApply(
  changes: SavingsPlanSimulatedMonth[],
): SavingsGoalPlanApply | null {
  const monthAdjustments = changes
    .filter((month) => isOpenPlanMonth(month))
    .flatMap((month) =>
      allocateMonthAmountToLines(
        month.lines.map((line) => ({
          budgetLineId: line.budgetLineId,
          amount: line.amount,
          checkedAt: line.checkedAt,
        })),
        month.simulatedAmount,
      ),
    );

  const missingMonthAdjustments = changes
    .filter(
      (month) => month.isProvisionable === true && month.simulatedAmount > 0,
    )
    .map((month) => ({
      month: month.month,
      year: month.year,
      amount: month.simulatedAmount,
    }));

  if (monthAdjustments.length === 0 && missingMonthAdjustments.length === 0) {
    return null;
  }
  return { monthAdjustments, missingMonthAdjustments };
}

export function planVerdict(
  result: SavingsPlanSimulationResult,
):
  | { kind: "total"; amount: number }
  | { kind: "missing"; amount: number }
  | { kind: "attained"; month: number; year: number } {
  if (result.gapToTarget === null) {
    return { kind: "total", amount: result.simulatedFinal };
  }
  if (result.attainedPeriod === null) {
    return { kind: "missing", amount: Math.max(0, result.gapToTarget) };
  }
  return { kind: "attained", ...result.attainedPeriod };
}
