import type { BudgetSparse } from "pulpe-shared";

import { availableMonths, hasAvailableMonth } from "./available-months";

const NOW = new Date(2026, 7, 11);

function budget(month: number, year: number): BudgetSparse {
  return { id: `budget-${year}-${month}`, month, year };
}

describe("availableMonths", () => {
  // A user arriving mid-month with nothing has this month to create first.
  it("offers the current month when it has no budget", () => {
    expect(availableMonths([], NOW, 1)).toEqual([{ month: 8, year: 2026 }]);
  });

  it("skips the months already covered", () => {
    const budgets = [budget(8, 2026), budget(9, 2026)];

    expect(availableMonths(budgets, NOW, 1)).toEqual([
      { month: 10, year: 2026 },
    ]);
  });

  it("offers as many free months as asked for, soonest first", () => {
    const budgets = [budget(9, 2026)];

    expect(availableMonths(budgets, NOW, 3)).toEqual([
      { month: 8, year: 2026 },
      { month: 10, year: 2026 },
      { month: 11, year: 2026 },
    ]);
  });

  it("rolls into the next year", () => {
    const budgets = [8, 9, 10, 11, 12].map((month) => budget(month, 2026));

    expect(availableMonths(budgets, NOW, 1)).toEqual([
      { month: 1, year: 2027 },
    ]);
  });

  it("ignores budgets in the past", () => {
    const budgets = [budget(1, 2026), budget(7, 2026)];

    expect(availableMonths(budgets, NOW, 1)).toEqual([
      { month: 8, year: 2026 },
    ]);
  });

  it("returns nothing once the horizon is full", () => {
    const budgets = Array.from({ length: 40 }, (_, offset) => {
      const date = new Date(2026, 7 + offset, 1);
      return budget(date.getMonth() + 1, date.getFullYear());
    });

    expect(availableMonths(budgets, NOW, 3)).toEqual([]);
    expect(hasAvailableMonth(budgets, NOW)).toBe(false);
  });
});

describe("hasAvailableMonth", () => {
  it("is true while something is left to create", () => {
    expect(hasAvailableMonth([budget(8, 2026)], NOW)).toBe(true);
  });
});
