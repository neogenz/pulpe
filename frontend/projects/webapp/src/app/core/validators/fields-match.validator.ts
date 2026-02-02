import {
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

export function createFieldsMatchValidator(
  field1: string,
  field2: string,
  errorKey: string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value1 = control.get(field1)?.value;
    const value2 = control.get(field2)?.value;

    if (typeof value1 !== 'string' || typeof value2 !== 'string') return null;
    if (!value1 || !value2) return null;

    if (value1 !== value2) {
      control.get(field2)?.setErrors({ [errorKey]: true });
      return { [errorKey]: true };
    }

    return null;
  };
}
