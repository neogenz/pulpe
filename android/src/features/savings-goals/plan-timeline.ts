import type { SavingsGoalPlanMonth } from "pulpe-shared";

/** A plan withdrawal below this is rounding noise, not money that left. */
const WITHDRAWAL_BALANCE_TOLERANCE = 0.005;

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
