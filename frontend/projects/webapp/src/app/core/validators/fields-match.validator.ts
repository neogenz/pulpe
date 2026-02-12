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

    const field2Control = control.get(field2);

    if (value1 !== value2) {
      const existingErrors = field2Control?.errors ?? {};
      field2Control?.setErrors({ ...existingErrors, [errorKey]: true });
      return { [errorKey]: true };
    }

    if (field2Control?.hasError(errorKey)) {
      const errors = { ...field2Control.errors };
      delete errors[errorKey];
      field2Control.setErrors(Object.keys(errors).length > 0 ? errors : null);
    }

    return null;
  };
}
