import { getBudgetPeriodForDate, type BudgetSparse } from "pulpe-shared";

const MONTHS_PER_YEAR = 12;

/** Same three-year horizon as `AppConfiguration.maxBudgetYearsAhead`. */
const MAX_YEARS_AHEAD = 3;

export interface BudgetPeriod {
  month: number;
  year: number;
}

/**
 * The budget periods from today onwards that have no budget yet, soonest
 * first, capped at `limit`. An empty result is a legitimate state rather than
 * an error: the user is simply ahead of the horizon.
 *
 * It starts at the active pay-day period rather than the next one because a
 * user arriving mid-period with nothing to show has that period to create
 * first.
 */
export function availableMonths(
  budgets: BudgetSparse[],
  now: Date,
  limit: number,
  payDayOfMonth?: number | null,
): BudgetPeriod[] {
  const taken = new Set(
    budgets.map((budget) => periodKey(budget.month, budget.year)),
  );
  const free: BudgetPeriod[] = [];
  const currentPeriod = getBudgetPeriodForDate(now, payDayOfMonth);

  for (
    let offset = 0;
    offset < MAX_YEARS_AHEAD * MONTHS_PER_YEAR && free.length < limit;
    offset += 1
  ) {
    const date = new Date(
      currentPeriod.year,
      currentPeriod.month - 1 + offset,
      1,
    );
    const period = { month: date.getMonth() + 1, year: date.getFullYear() };
    if (!taken.has(periodKey(period.month, period.year))) free.push(period);
  }

  return free;
}

/** Whether there is anything left to create — what gates the dashboard's CTA. */
export function hasAvailableMonth(
  budgets: BudgetSparse[],
  now: Date,
  payDayOfMonth?: number | null,
): boolean {
  return availableMonths(budgets, now, 1, payDayOfMonth).length > 0;
}

/**
 * The period fields are optional on the sparse budget — a row missing either
 * one names no period, so it can never take one either.
 */
function periodKey(month?: number, year?: number): string {
  return `${year}-${month}`;
}
