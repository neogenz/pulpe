import { getBudgetPeriodDates, getBudgetPeriodForDate } from 'pulpe-shared';

export interface BudgetPeriodDateConstraints {
  isCurrentMonth: boolean;
  minDate: Date | undefined;
  maxDate: Date | undefined;
}

export function computeBudgetPeriodDateConstraints(
  budgetMonth: number,
  budgetYear: number,
  payDayOfMonth: number | null,
): BudgetPeriodDateConstraints {
  const currentPeriod = getBudgetPeriodForDate(new Date(), payDayOfMonth);
  const isCurrentMonth =
    budgetMonth === currentPeriod.month && budgetYear === currentPeriod.year;

  if (!isCurrentMonth) {
    return { isCurrentMonth, minDate: undefined, maxDate: undefined };
  }

  const { startDate, endDate } = getBudgetPeriodDates(
    budgetMonth,
    budgetYear,
    payDayOfMonth,
  );

  return { isCurrentMonth, minDate: startDate, maxDate: endDate };
}
