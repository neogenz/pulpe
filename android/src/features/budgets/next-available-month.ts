import type { BudgetSparse } from "pulpe-shared";

const MONTHS_PER_YEAR = 12;

/** Same three-year horizon as `AppConfiguration.maxBudgetYearsAhead`. */
const MAX_YEARS_AHEAD = 3;

export interface BudgetPeriod {
  month: number;
  year: number;
}

/**
 * The first month from today onwards that has no budget — what the "create the
 * next month" action would create. Null when the horizon is already full, which
 * is a legitimate state rather than an error: the user is simply ahead.
 *
 * It starts at the current month rather than the next one because a user
 * arriving mid-month with nothing to show has that month to create first.
 */
export function nextAvailableMonth(
  budgets: BudgetSparse[],
  now: Date,
): BudgetPeriod | null {
  const taken = new Set(
    budgets.map((budget) => periodKey(budget.month, budget.year)),
  );

  for (
    let offset = 0;
    offset < MAX_YEARS_AHEAD * MONTHS_PER_YEAR;
    offset += 1
  ) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const period = { month: date.getMonth() + 1, year: date.getFullYear() };
    if (!taken.has(periodKey(period.month, period.year))) return period;
  }

  return null;
}

/**
 * The period fields are optional on the sparse budget — a row missing either
 * one names no period, so it can never take one either.
 */
function periodKey(month?: number, year?: number): string {
  return `${year}-${month}`;
}
