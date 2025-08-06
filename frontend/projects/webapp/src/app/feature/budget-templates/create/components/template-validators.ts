import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validation error keys for template forms
 */
export const TEMPLATE_VALIDATION_ERRORS = {
  REQUIRED: 'required',
  MAX_LENGTH: 'maxlength',
  DUPLICATE_NAME: 'duplicateName',
  TEMPLATE_LIMIT_REACHED: 'templateLimitReached',
} as const;

/**
 * Form input limits for template creation
 */
export const FORM_LIMITS = {
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 200,
} as const;

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
      return { [TEMPLATE_VALIDATION_ERRORS.DUPLICATE_NAME]: true };
    }

    return null;
  };
}

/**
 * Error message resolver for template validation errors
 */
export function getTemplateValidationErrorMessage(
  errors: ValidationErrors | null,
  fieldName = 'field',
): string | null {
  if (!errors) return null;

  // Priority order for error messages
  if (errors[TEMPLATE_VALIDATION_ERRORS.REQUIRED]) {
    return 'Le nom est requis';
  }

  if (errors[TEMPLATE_VALIDATION_ERRORS.DUPLICATE_NAME]) {
    return 'Un modèle avec ce nom existe déjà';
  }

  if (errors[TEMPLATE_VALIDATION_ERRORS.MAX_LENGTH]) {
    const maxLength =
      errors[TEMPLATE_VALIDATION_ERRORS.MAX_LENGTH].requiredLength;
    return `Le ${fieldName} ne peut pas dépasser ${maxLength} caractères`;
  }

  if (errors[TEMPLATE_VALIDATION_ERRORS.TEMPLATE_LIMIT_REACHED]) {
    const max = errors[TEMPLATE_VALIDATION_ERRORS.TEMPLATE_LIMIT_REACHED].max;
    return `Vous avez atteint la limite de ${max} modèles`;
  }

  // Fallback for any other validation errors
  const firstErrorKey = Object.keys(errors)[0];
  return `Erreur de validation: ${firstErrorKey}`;
}
