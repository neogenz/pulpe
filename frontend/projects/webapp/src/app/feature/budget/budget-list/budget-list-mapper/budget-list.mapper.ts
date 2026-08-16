import { type Budget, formatBudgetPeriod } from 'pulpe-shared';

export interface BudgetPlaceholder {
  month: number;
  year: number;
}
import {
  type CalendarMonth,
  type CalendarYear,
} from '@ui/calendar/calendar-types';
import { createEmptyCalendarMonth } from '@ui/calendar/calendar-types';

const YEARS_TO_DISPLAY = 8;

export function resolveSelectedYearIndex(
  selectedYear: number | null,
  calendarYears: CalendarYear[],
): number {
  if (!selectedYear || calendarYears.length === 0) return 0;
  const idx = calendarYears.findIndex((y) => y.year === selectedYear);
  return Math.max(0, idx);
}

export function buildCalendarYears(
  budgetsGroupedByYears: Map<number, (Budget | BudgetPlaceholder)[]>,
  payDayOfMonth: number | null,
  currentYear: number,
  locale: string,
): CalendarYear[] {
  const existingYears = Array.from(budgetsGroupedByYears.keys());
  const calculatedYears = Array.from(
    { length: YEARS_TO_DISPLAY },
    (_, i) => currentYear + i,
  );

  const years = Array.from(
    new Set([...existingYears, ...calculatedYears]),
  ).toSorted((a, b) => a - b);

  return years.map((year) => {
    const existingBudgets = budgetsGroupedByYears.get(year);

    if (existingBudgets) {
      return mapToCalendarYear(year, existingBudgets, locale, payDayOfMonth);
    } else {
      const emptyMonths = Array.from({ length: 12 }, (_, monthIndex) => ({
        month: monthIndex + 1,
        year,
      }));
      return mapToCalendarYear(year, emptyMonths, locale, payDayOfMonth);
    }
  });
}

export function mapToCalendarYear(
  year: number,
  budgets: (Budget | BudgetPlaceholder)[],
  locale: string,
  payDayOfMonth?: number | null,
): CalendarYear {
  return {
    year,
    months: budgets.map((budget) =>
      mapToCalendarMonth(budget, locale, payDayOfMonth),
    ),
  };
}

/**
 * Le nom du mois suit la langue de l'interface. Une locale figée ici afficherait
 * un calendrier français dans une application allemande, sans que rien n'échoue.
 */
function formatCalendarMonthDisplayName(
  month: number,
  year: number,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1));
}

function mapToCalendarMonth(
  budget: Budget | BudgetPlaceholder,
  locale: string,
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
    locale,
    payDayOfMonth,
  );

  if (isPlannedBudget(budget)) {
    const value = budget.remaining ?? budget.endingBalance ?? undefined;
    return {
      id: budget.id,
      month: budget.month,
      year: budget.year,
      hasContent: true,
      value,
      displayName: formatCalendarMonthDisplayName(
        budget.month,
        budget.year,
        locale,
      ),
      period,
      status: getStatusFromValue(value),
    };
  }
  const emptyMonth = createEmptyCalendarMonth(
    budget.month,
    budget.year,
    formatCalendarMonthDisplayName(budget.month, budget.year, locale),
  );
  return { ...emptyMonth, period };
}

function formatPeriodIfCustomPayDay(
  month: number,
  year: number,
  locale: string,
  payDayOfMonth?: number | null,
): string | undefined {
  if (!payDayOfMonth || payDayOfMonth === 1) {
    return undefined;
  }
  return formatBudgetPeriod(month, year, payDayOfMonth, locale);
}

function getStatusFromValue(
  value: number | undefined,
): CalendarMonth['status'] {
  if (value === undefined) return 'neutral';
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}
