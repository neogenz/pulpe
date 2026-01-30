import type {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
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

export function createDateRangeValidator(
  min: Date | undefined,
  max: Date | undefined,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || !(value instanceof Date)) return null;
    if (!min && !max) return null;

    const time = value.getTime();
    if (min && time < min.getTime()) return { dateOutOfRange: true };
    if (max && time > max.getTime()) return { dateOutOfRange: true };

    return null;
  };
}
