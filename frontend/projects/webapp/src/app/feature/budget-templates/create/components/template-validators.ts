import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validator that checks for duplicate template names
 * Uses existing names array to verify name uniqueness (case-insensitive)
 */
export function duplicateNameValidator(existingNames?: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;

    // Don't validate if empty (handled by required validator)
    if (!value || !value.trim()) {
      return null;
    }

    const trimmedName = value.trim().toLowerCase();
    const trimmedExistingNames = (existingNames ?? []).map((name) =>
      name.trim().toLowerCase(),
    );

    if (trimmedExistingNames.includes(trimmedName)) {
      return { duplicateName: true };
    }

    return null;
  };
}

/**
 * Error message resolver for template validation errors
 */
export function getTemplateNameErrorMessage(
  errors: ValidationErrors | null,
): string | null {
  if (!errors) return null;

  // Prioritize required error
  if (errors['required']) {
    return 'Le nom est requis';
  }

  if (errors['duplicateName']) {
    return 'Un modèle avec ce nom existe déjà';
  }

  // Return null for unknown errors instead of fallback message
  return null;
}
