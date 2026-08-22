import type { SavingsGoalPlanMonth } from "pulpe-shared";

import {
  isMonthLocked,
  monthAvailability,
  monthState,
  planTimeline,
} from "./plan-timeline";

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

function series(length: number): SavingsGoalPlanMonth[] {
  return Array.from({ length }, (_, index) =>
    month({
      month: (index % 12) + 1,
      state: index === 0 ? "current" : "future",
    }),
  );
}

describe("planTimeline", () => {
  it("opens on the current month and three ahead", () => {
    const presentation = planTimeline(series(12), false);

    expect(presentation.visibleMonths).toHaveLength(4);
    expect(presentation.hiddenCount).toBe(8);
    expect(presentation.canToggle).toBe(true);
  });

  it("shows everything once expanded", () => {
    const presentation = planTimeline(series(12), true);

    expect(presentation.visibleMonths).toHaveLength(12);
    expect(presentation.hiddenCount).toBe(0);
  });

  it("offers no toggle when the whole plan already fits", () => {
    expect(planTimeline(series(3), false).canToggle).toBe(false);
  });

  it("starts at the first month when none is the current one", () => {
    const past = [month({ state: "past" }), month({ state: "past" })];

    expect(planTimeline(past, false).visibleMonths).toHaveLength(2);
  });

  it("counts the months from here on that no forecast funds", () => {
    const months = [
      month({ state: "current", lines: [line()] }),
      month(),
      month({ lines: [line()] }),
      month(),
    ];

    expect(planTimeline(months, false).remainingUnlinkedMonthCount).toBe(2);
  });
});

describe("monthAvailability", () => {
  it("says nothing when a forecast funds the month", () => {
    expect(monthAvailability(month({ lines: [line()] }))).toBe("linked");
  });

  it("separates a month with no forecast from a month with no budget", () => {
    expect(monthAvailability(month())).toBe("unfunded");
    expect(monthAvailability(month({ hasBudget: false }))).toBe("no-budget");
  });
});

describe("monthState", () => {
  it("reads as pointed once every line is checked", () => {
    const checked = month({
      lines: [line({ checkedAt: "2026-08-05T00:00:00.000Z" })],
    });

    expect(monthState(checked)).toBe("checked");
  });

  it("stays silent while one line is still unchecked", () => {
    const partial = month({
      lines: [line({ checkedAt: "2026-08-05T00:00:00.000Z" }), line()],
    });

    expect(monthState(partial)).toBeNull();
  });

  it("locks a month whose plan withdrawal has already gone out", () => {
    const realized = month({ planWithdrawalConsumedAmount: 500 });

    expect(isMonthLocked(realized)).toBe(true);
    expect(monthState(realized)).toBe("locked");
  });
});

function line(
  overrides: Partial<SavingsGoalPlanMonth["lines"][number]> = {},
): SavingsGoalPlanMonth["lines"][number] {
  return {
    budgetLineId: "6f2b1c4e-8a9d-4c3b-9e1f-2a3b4c5d6e7f",
    amount: 250,
    checkedAt: null,
    isManuallyAdjusted: false,
    ...overrides,
  };
}
