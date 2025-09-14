import { type Budget } from '@pulpe/shared';
import { type BudgetPlaceholder } from '../budget-state';
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
): CalendarYear {
  return {
    year,
    months: budgets.map((budget) => mapToCalendarMonth(budget)),
  };
}

function formatCalendarMonthDisplayName(month: number, year: number): string {
  return format(new Date(year, month - 1), 'MMMM yyyy', { locale: frCH });
}

function mapToCalendarMonth(budget: Budget | BudgetPlaceholder): CalendarMonth {
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
  if (isPlannedBudget(budget)) {
    return {
      id: budget.id,
      month: budget.month,
      year: budget.year,
      hasContent: true,
      value: budget.endingBalance ?? undefined,
      displayName: formatCalendarMonthDisplayName(budget.month, budget.year),
    };
  }
  return createEmptyCalendarMonth(
    budget.month,
    budget.year,
    formatCalendarMonthDisplayName(budget.month, budget.year),
  );
}
