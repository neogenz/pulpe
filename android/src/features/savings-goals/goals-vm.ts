import {
  PACE_TOLERANCE_PERCENT,
  type SavingsGoalPaceStatus,
  type SavingsGoalPlanMonth,
  type SavingsGoalProgress,
} from "pulpe-shared";

export const PACE_LABELS: Record<SavingsGoalPaceStatus, string> = {
  behind: "Un peu en retrait",
  on_track: "Sur la bonne voie",
  ahead: "En avance",
};

export const PACE_ICONS: Record<SavingsGoalPaceStatus, string> = {
  behind: "timer-sand",
  on_track: "check-circle-outline",
  ahead: "star-four-points-outline",
};

/**
 * No pace verdict before the first plan month has closed: a fresh goal has
 * nothing to be judged on yet. Closed = server-locked, the same signal the
 * timeline dims rows on.
 */
export function hasClosedPlanMonth(months: SavingsGoalPlanMonth[]): boolean {
  return months.some(
    (month) => month.isContributionEligible === true && month.isLocked,
  );
}

/**
 * The day-one "ton plan est prêt" beat: what the current month asks for.
 * `null` — beat hidden — when the timeline has no funded current month.
 */
export function currentMonthPlannedAmount(
  months: SavingsGoalPlanMonth[],
): number | null {
  const current = months.find((month) => month.state === "current");
  if (current === undefined || current.plannedAmount <= 0) return null;
  return current.plannedAmount;
}

/**
 * "Required ≈ planned" band for the deadline stat, on the same ±5 % the server
 * judges the pace with — so the stat never contradicts the verdict above it.
 */
export function requiredMatchesPlannedPace(
  planned: number,
  required: number,
): boolean {
  if (planned <= 0) return required <= 0;
  return (
    Math.abs(required - planned) <= (planned * PACE_TOLERANCE_PERCENT) / 100
  );
}

/**
 * The confirmed layer of the progress bar, read off the server's own percent so
 * the bar and the number can never disagree.
 */
export function confirmedFraction(
  progress: SavingsGoalProgress,
): number | null {
  if (progress.achievementPercent === null) return null;
  return progress.achievementPercent / 100;
}

/** The paler layer behind it: the whole known plan against the target. */
export function plannedFraction(progress: SavingsGoalProgress): number | null {
  if (progress.targetAmount === null) return null;
  if (progress.targetAmount <= 0) return 0;
  return clampFraction(progress.plannedProjection / progress.targetAmount);
}

function clampFraction(ratio: number): number {
  return Math.min(Math.max(ratio, 0), 1);
}
