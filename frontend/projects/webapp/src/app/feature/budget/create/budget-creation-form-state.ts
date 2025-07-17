import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { setMonth, setYear, startOfMonth } from 'date-fns';

export interface BudgetCreationFormData {
  monthYear: Date;
  description: string;
}

@Injectable()
export class BudgetCreationFormState {
  /**
   * Handles month/year selection from datepicker
   * Uses date-fns to properly set the selected month and year
   */
  setMonthAndYear(form: FormGroup, normalizedMonthAndYear: Date): void {
    const currentValue = form.get('monthYear')?.value || new Date();
    const newDate = startOfMonth(
      setYear(
        setMonth(currentValue, normalizedMonthAndYear.getMonth()),
        normalizedMonthAndYear.getFullYear(),
      ),
    );

    form.get('monthYear')?.setValue(newDate);
    form.get('monthYear')?.markAsTouched();
  }

  /**
   * Validates the form and returns form data if valid
   */
  validateAndGetFormData(form: FormGroup): BudgetCreationFormData | null {
    if (form.valid) {
      return form.value;
    }
    return null;
  }
}
