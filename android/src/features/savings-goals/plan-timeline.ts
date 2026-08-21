import type { SavingsGoalPlanMonth } from "pulpe-shared";

/** The current month plus three ahead — what fits before the plan reads as a list. */
export const OPEN_MONTHS_WINDOW = 3;

/**
 * A plan withdrawal already realised cannot be moved from here any more: the
 * money left through a budget, and that budget is where it is edited.
 */
const WITHDRAWAL_BALANCE_TOLERANCE = 0.005;

export interface PlanTimelinePresentation {
  visibleMonths: SavingsGoalPlanMonth[];
  hiddenCount: number;
  canToggle: boolean;
  /** Months from here on that no forecast funds — the plan's silent gap. */
  remainingUnlinkedMonthCount: number;
}

/**
 * The plan, windowed. A goal can span 96 months, and a screen that opens on 96
 * rows spends the reader's attention before they reach what it says.
 */
export function planTimeline(
  months: SavingsGoalPlanMonth[],
  isExpanded: boolean,
): PlanTimelinePresentation {
  const currentIndex = Math.max(
    months.findIndex((month) => month.state === "current"),
    0,
  );
  const collapsed = months.slice(
    currentIndex,
    Math.min(months.length, currentIndex + OPEN_MONTHS_WINDOW + 1),
  );
  const visibleMonths = isExpanded ? months : collapsed;

  return {
    visibleMonths,
    hiddenCount: Math.max(0, months.length - visibleMonths.length),
    canToggle: collapsed.length < months.length,
    remainingUnlinkedMonthCount: months
      .slice(currentIndex)
      .filter((month) => month.lines.length === 0).length,
  };
}

export type MonthAvailability = "linked" | "unfunded" | "no-budget";

/** Why a month shows no amount of its own — stated rather than left blank. */
export function monthAvailability(
  month: SavingsGoalPlanMonth,
): MonthAvailability {
  if (month.lines.length > 0) return "linked";
  return month.hasBudget === true ? "unfunded" : "no-budget";
}

/**
 * A month is locked either because its cycle has closed or because the plan
 * withdrawal it carries has already gone out.
 */
export function isMonthLocked(month: SavingsGoalPlanMonth): boolean {
  return (
    month.isLocked ||
    (month.planWithdrawalConsumedAmount ?? 0) > WITHDRAWAL_BALANCE_TOLERANCE
  );
}

export type MonthState = "checked" | "locked";

/** Same grammar as the rest of the app: "Pointé" first, lock second. */
export function monthState(month: SavingsGoalPlanMonth): MonthState | null {
  const isChecked =
    month.lines.length > 0 &&
    month.lines.every((line) => line.checkedAt !== null);
  if (isChecked) return "checked";
  return isMonthLocked(month) ? "locked" : null;
}
