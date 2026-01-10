import { type Budget, formatBudgetPeriod } from 'pulpe-shared';
import { type BudgetPlaceholder } from '../budget-list-store';
import { format } from 'date-fns';
import { frCH } from 'date-fns/locale';
import {
  type CalendarMonth,
  type CalendarYear,
} from '@ui/calendar/calendar-types';
import { createEmptyCalendarMonth } from '@ui/calendar/calendar-types';

export function mapToCalendarYear(
  year: number,
  budgets: (Budget | BudgetPlaceholder)[],
  payDayOfMonth?: number | null,
): CalendarYear {
  return {
    year,
    months: budgets.map((budget) => mapToCalendarMonth(budget, payDayOfMonth)),
  };
}

function formatCalendarMonthDisplayName(month: number, year: number): string {
  return format(new Date(year, month - 1), 'MMMM yyyy', { locale: frCH });
}

function mapToCalendarMonth(
  budget: Budget | BudgetPlaceholder,
  payDayOfMonth?: number | null,
): CalendarMonth {
  const isPlannedBudget = (
    budget: Budget | BudgetPlaceholder,
  ): budget is Budget => {
    return (
      budget != null &&
      typeof budget === 'object' &&
      'id' in budget &&
      typeof budget.id === 'string' &&
      budget.id.trim().length > 0
    );
  };

  const period = formatPeriodIfCustomPayDay(
    budget.month,
    budget.year,
    payDayOfMonth,
  );

  if (isPlannedBudget(budget)) {
    return {
      id: budget.id,
      month: budget.month,
      year: budget.year,
      hasContent: true,
      // Display value prioritizes remaining amount, fallback to endingBalance
      value: budget.remaining ?? budget.endingBalance ?? undefined,
      displayName: formatCalendarMonthDisplayName(budget.month, budget.year),
      period,
    };
  }
  const emptyMonth = createEmptyCalendarMonth(
    budget.month,
    budget.year,
    formatCalendarMonthDisplayName(budget.month, budget.year),
  );
  return { ...emptyMonth, period };
}

function formatPeriodIfCustomPayDay(
  month: number,
  year: number,
  payDayOfMonth?: number | null,
): string | undefined {
  if (!payDayOfMonth || payDayOfMonth === 1) {
    return undefined;
  }
  return formatBudgetPeriod(month, year, payDayOfMonth);
}
