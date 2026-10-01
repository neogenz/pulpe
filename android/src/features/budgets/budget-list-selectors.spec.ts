import type { BudgetSparse } from "pulpe-shared";

import {
  type BudgetYearSection,
  budgetsInPeriodOrder,
  budgetsOfYear,
  budgetYears,
  budgetYearSections,
  currentBudgetLocation,
  initialBudgetYear,
  nextMissingMonth,
  yearRecap,
} from "./budget-list-selectors";

function budget(month: number, year: number): BudgetSparse {
  return { id: `budget-${year}-${month}`, month, year };
}

describe("budgetYearSections", () => {
  it("puts the most recent year first", () => {
    const sections = budgetYearSections([
      budget(3, 2025),
      budget(1, 2027),
      budget(8, 2026),
    ]);

    expect(sections.map((section) => section.year)).toEqual([2027, 2026, 2025]);
  });

  it("puts the most recent month first inside a year", () => {
    const [section] = budgetYearSections([
      budget(2, 2026),
      budget(11, 2026),
      budget(7, 2026),
    ]);

    expect(section?.budgets.map((row) => row.month)).toEqual([11, 7, 2]);
  });

  // The sparse fieldset makes both fields optional; a row naming no month
  // cannot be opened to anything meaningful.
  it("drops a budget that names no period", () => {
    const sections = budgetYearSections([
      { id: "orphan" },
      { id: "half", month: 4 },
      budget(8, 2026),
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.budgets.map((row) => row.id)).toEqual([
      "budget-2026-8",
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(budgetYearSections([])).toEqual([]);
  });
});

describe("currentBudgetLocation", () => {
  /**
   * The list as the virtualiser lays it out: a year header takes a row, then
   * each card takes one. Deriving the expectation from the real order is the
   * point — a hand-written index would keep agreeing with itself after
   * `budgetYearSections` changed its mind about the order.
   */
  function renderedRows(sections: BudgetYearSection[]): string[] {
    return sections.flatMap((section) => [
      `year-${section.year}`,
      ...section.budgets.map((row) => row.id ?? ""),
    ]);
  }

  it("finds the month being lived in under the months planned above it", () => {
    const sections = budgetYearSections([
      budget(8, 2026),
      budget(9, 2026),
      budget(10, 2026),
      budget(11, 2026),
      budget(7, 2026),
    ]);

    const location = currentBudgetLocation(sections, { year: 2026, month: 8 });

    expect(location).not.toBeNull();
    expect(location?.sectionIndex).toBe(0);
    expect(location?.itemIndex).toBe(3);
    expect(location?.rowsAbove).toBe(
      renderedRows(sections).indexOf("budget-2026-8"),
    );
  });

  it("counts the years above it, headers included", () => {
    const sections = budgetYearSections([
      budget(1, 2027),
      budget(2, 2027),
      budget(8, 2026),
      budget(12, 2026),
    ]);

    const location = currentBudgetLocation(sections, { year: 2026, month: 8 });

    expect(location?.sectionIndex).toBe(1);
    expect(location?.itemIndex).toBe(1);
    expect(location?.rowsAbove).toBe(
      renderedRows(sections).indexOf("budget-2026-8"),
    );
  });

  // Nothing to move to: the list already opens on it.
  it("says nothing when the month being lived in is the first row", () => {
    const sections = budgetYearSections([budget(8, 2026), budget(7, 2026)]);

    expect(
      currentBudgetLocation(sections, { year: 2026, month: 8 }),
    ).toBeNull();
  });

  it("says nothing when the month being lived in has no budget", () => {
    const sections = budgetYearSections([budget(11, 2026), budget(7, 2026)]);

    expect(
      currentBudgetLocation(sections, { year: 2026, month: 8 }),
    ).toBeNull();
  });

  it("says nothing for an empty list", () => {
    expect(currentBudgetLocation([], { year: 2026, month: 8 })).toBeNull();
  });
});

describe("budgetsInPeriodOrder", () => {
  it("runs oldest first, across years", () => {
    const ordered = budgetsInPeriodOrder([
      budget(1, 2027),
      budget(11, 2026),
      budget(2, 2026),
    ]);

    expect(ordered.map((row) => row.id)).toEqual([
      "budget-2026-2",
      "budget-2026-11",
      "budget-2027-1",
    ]);
  });

  it("drops a budget that names no period", () => {
    expect(
      budgetsInPeriodOrder([{ id: "orphan" }, budget(8, 2026)]).map(
        (row) => row.id,
      ),
    ).toEqual(["budget-2026-8"]);
  });
});

describe("the year view", () => {
  const current = { year: 2026, month: 10 };
  const yearBudget = (
    year: number,
    month: number,
    remaining = 0,
  ): BudgetSparse => ({ id: `${year}-${month}`, year, month, remaining });

  it("lists every budgeted year once, oldest first", () => {
    expect(
      budgetYears([
        yearBudget(2027, 1),
        yearBudget(2026, 10),
        yearBudget(2026, 3),
      ]),
    ).toEqual([2026, 2027]);
  });

  it("opens on the year being lived in, or the latest one planned", () => {
    expect(initialBudgetYear([2025, 2026, 2027], current)).toBe(2026);
    expect(initialBudgetYear([2027, 2028], current)).toBe(2028);
    expect(initialBudgetYear([], current)).toBe(2026);
  });

  it("reads a year January first and closes it on its last month", () => {
    const year = budgetsOfYear(
      [
        yearBudget(2026, 11, 300),
        yearBudget(2025, 12),
        yearBudget(2026, 2, 100),
      ],
      2026,
    );

    expect(year.map((row) => row.month)).toEqual([2, 11]);
    expect(yearRecap(year)).toEqual({ closingBalance: 300, budgetedMonths: 2 });
  });

  it("offers the first month still missing from today on", () => {
    const year = [yearBudget(2026, 10), yearBudget(2026, 11)];

    expect(nextMissingMonth(year, 2026, current)).toBe(12);
    expect(nextMissingMonth([], 2027, current)).toBe(1);
    expect(nextMissingMonth([], 2025, current)).toBeNull();
    expect(
      nextMissingMonth(
        [10, 11, 12].map((month) => yearBudget(2026, month)),
        2026,
        current,
      ),
    ).toBeNull();
  });
});
