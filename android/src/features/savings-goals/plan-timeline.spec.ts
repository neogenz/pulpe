import type { SavingsGoalPlanMonth } from "pulpe-shared";

import { isMonthLocked } from "./plan-timeline";

function month(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 8,
    year: 2026,
    state: "future",
    isLocked: false,
    hasBudget: true,
    plannedAmount: 250,
    confirmedAmount: 0,
    plannedCumulative: 250,
    confirmedCumulative: 0,
    lines: [],
    ...overrides,
  };
}

describe("isMonthLocked", () => {
  it("locks a month whose plan withdrawal has already gone out", () => {
    expect(isMonthLocked(month({ planWithdrawalConsumedAmount: 500 }))).toBe(
      true,
    );
  });

  it("leaves an open month unlocked", () => {
    expect(isMonthLocked(month())).toBe(false);
  });
});
