import type {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { getBudgetPeriodDates } from 'pulpe-shared';

export interface BudgetPeriodDateConstraints {
  minDate: Date;
  maxDate: Date;
  defaultDate: Date;
}

export function computeBudgetPeriodDateConstraints(
  budgetMonth: number,
  budgetYear: number,
  payDayOfMonth: number | null,
): BudgetPeriodDateConstraints {
  const { startDate, endDate } = getBudgetPeriodDates(
    budgetMonth,
    budgetYear,
    payDayOfMonth,
  );

  const today = new Date();
  const defaultDate =
    today >= startDate && today <= endDate ? today : startDate;

  return { minDate: startDate, maxDate: endDate, defaultDate };
}

export function createDateRangeValidator(
  min: Date | undefined,
  max: Date | undefined,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || !(value instanceof Date) || isNaN(value.getTime()))
      return null;
    if (!min && !max) return null;

    const time = value.getTime();
    if (min && time < min.getTime()) return { dateOutOfRange: true };
    if (max && time > max.getTime()) return { dateOutOfRange: true };

    return null;
  };
}
