import type { BudgetLine, BudgetSparse } from "pulpe-shared";

import {
  hasBudgetForPeriod,
  isPostponeEligible,
  postponeTargetPeriod,
} from "./postpone-gate";

function line(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: "line-1",
    budgetId: "budget-1",
    templateLineId: null,
    savingsGoalId: null,
    name: "Assurance",
    amount: 120,
    kind: "expense",
    recurrence: "one_off",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isPostponeEligible", () => {
  it("offers the move on an untouched one-off", () => {
    expect(isPostponeEligible(line(), 0)).toBe(true);
  });

  it("refuses a forecast already pointed", () => {
    expect(
      isPostponeEligible(line({ checkedAt: "2026-08-09T10:00:00.000Z" }), 0),
    ).toBe(false);
  });

  // A recurring forecast is reissued every month: moving one is meaningless.
  it("refuses a recurring forecast", () => {
    expect(isPostponeEligible(line({ recurrence: "fixed" }), 0)).toBe(false);
  });

  // The rollover row is a display line, not something the server can move.
  it("refuses the carry-over line", () => {
    expect(isPostponeEligible(line({ isRollover: true }), 0)).toBe(false);
  });

  // Moving one occurrence would leave its siblings behind.
  it("refuses an occurrence of a spread", () => {
    expect(
      isPostponeEligible(
        line({ spreadGroupId: "3f1c1c6e-1f4e-4c0a-9f2e-2b7c8d9e0a11" }),
        0,
      ),
    ).toBe(false);
  });

  // The withdrawal pair spans two months by construction.
  it("refuses a half of a savings withdrawal", () => {
    expect(
      isPostponeEligible(
        line({
          savingsWithdrawalGroupId: "9d8e7f6a-5b4c-4d3e-8f9a-0b1c2d3e4f5a",
        }),
        0,
      ),
    ).toBe(false);
  });

  it("refuses a forecast money was already booked against", () => {
    expect(isPostponeEligible(line(), 1)).toBe(false);
  });
});

describe("postponeTargetPeriod", () => {
  it("takes the next month", () => {
    expect(postponeTargetPeriod({ year: 2026, month: 8 })).toEqual({
      year: 2026,
      month: 9,
    });
  });

  it("rolls over the year in December", () => {
    expect(postponeTargetPeriod({ year: 2026, month: 12 })).toEqual({
      year: 2027,
      month: 1,
    });
  });
});

describe("hasBudgetForPeriod", () => {
  const budgets: BudgetSparse[] = [
    { id: "budget-8", year: 2026, month: 8 },
    { id: "budget-9", year: 2026, month: 9 },
  ];

  it("finds the month that exists", () => {
    expect(hasBudgetForPeriod(budgets, { year: 2026, month: 9 })).toBe(true);
  });

  it("reports the month that was never created", () => {
    expect(hasBudgetForPeriod(budgets, { year: 2026, month: 10 })).toBe(false);
  });

  // Same month number, other year — the list is not searched by month alone.
  it("does not match across years", () => {
    expect(hasBudgetForPeriod(budgets, { year: 2027, month: 9 })).toBe(false);
  });
});
