import type { BudgetSparse } from "pulpe-shared";

import { nextAvailableMonth } from "./next-available-month";

const NOW = new Date(2026, 7, 11);

function budget(month: number, year: number): BudgetSparse {
  return { id: `budget-${year}-${month}`, month, year };
}

describe("nextAvailableMonth", () => {
  // A user arriving mid-month with nothing has this month to create first.
  it("offers the current month when it has no budget", () => {
    expect(nextAvailableMonth([], NOW)).toEqual({ month: 8, year: 2026 });
  });

  it("skips the months already covered", () => {
    const budgets = [budget(8, 2026), budget(9, 2026)];

    expect(nextAvailableMonth(budgets, NOW)).toEqual({ month: 10, year: 2026 });
  });

  it("rolls into the next year", () => {
    const budgets = [8, 9, 10, 11, 12].map((month) => budget(month, 2026));

    expect(nextAvailableMonth(budgets, NOW)).toEqual({ month: 1, year: 2027 });
  });

  it("ignores budgets in the past", () => {
    const budgets = [budget(1, 2026), budget(7, 2026)];

    expect(nextAvailableMonth(budgets, NOW)).toEqual({ month: 8, year: 2026 });
  });

  it("returns nothing once the horizon is full", () => {
    const budgets = Array.from({ length: 40 }, (_, offset) => {
      const date = new Date(2026, 7 + offset, 1);
      return budget(date.getMonth() + 1, date.getFullYear());
    });

    expect(nextAvailableMonth(budgets, NOW)).toBeNull();
  });
});
