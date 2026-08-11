import type { BudgetSparse } from "pulpe-shared";

import { budgetYearSections } from "./budget-list-selectors";

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
