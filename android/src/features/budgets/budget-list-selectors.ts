import type { BudgetSparse } from "pulpe-shared";

export interface BudgetYearSection {
  year: number;
  budgets: BudgetSparse[];
}

/**
 * The list as it reads: newest year first, newest month first inside it, and
 * the year the user is living in at the top whatever the calendar says — a
 * future budget belongs above the past, not after it.
 *
 * Budgets with no period are dropped rather than bucketed under a placeholder
 * year: the sparse fieldset makes both fields optional, and a row that names no
 * month cannot be opened to anything meaningful.
 */
export function budgetYearSections(
  budgets: BudgetSparse[],
): BudgetYearSection[] {
  const byYear = new Map<number, BudgetSparse[]>();

  for (const budget of budgets) {
    if (budget.month === undefined || budget.year === undefined) continue;
    const rows = byYear.get(budget.year);
    if (rows === undefined) {
      byYear.set(budget.year, [budget]);
      continue;
    }
    rows.push(budget);
  }

  return [...byYear.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, rows]) => ({
      year,
      budgets: [...rows].sort((a, b) => (b.month ?? 0) - (a.month ?? 0)),
    }));
}
