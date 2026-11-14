import {
  type SavingsGoalPaceStatus,
  type SavingsGoalPlanMonth,
  type SavingsGoalProgress,
} from "pulpe-shared";

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
 * The confirmed layer of the progress bar, read off the server's own percent so
 * the bar and the number can never disagree.
 */
export function confirmedFraction(
  progress: SavingsGoalProgress,
): number | null {
  if (progress.achievementPercent === null) return null;
  return progress.achievementPercent / 100;
}
