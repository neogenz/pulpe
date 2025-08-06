import { FormControl } from '@angular/forms';
import {
  duplicateNameValidator,
  getTemplateValidationErrorMessage,
  TEMPLATE_VALIDATION_ERRORS,
} from './template-validators';

describe('Template Validators', () => {
  describe('duplicateNameValidator', () => {
    const existingNames = ['template 1', 'template 2', 'budget basic'];

    it('should return null for unique name', () => {
      const validator = duplicateNameValidator(existingNames);
      const control = new FormControl('Unique Template');

      const result = validator(control);

      expect(result).toBeNull();
    });

    it('should return error for duplicate name (case insensitive)', () => {
      const validator = duplicateNameValidator(existingNames);
      const control = new FormControl('TEMPLATE 1'); // Case insensitive match

      const result = validator(control);

      expect(result).toEqual({
        [TEMPLATE_VALIDATION_ERRORS.DUPLICATE_NAME]: true,
      });
    });

    it('should return null for empty value', () => {
      const validator = duplicateNameValidator(existingNames);
      const control = new FormControl('');

      const result = validator(control);

      expect(result).toBeNull();
    });

    it('should return null when no existing names provided', () => {
      const validator = duplicateNameValidator();
      const control = new FormControl('Template 1');

      const result = validator(control);

      expect(result).toBeNull();
    });

    it('should return null with empty existing names array', () => {
      const validator = duplicateNameValidator([]);
      const control = new FormControl('Template 1');

      const result = validator(control);

      expect(result).toBeNull();
    });

    it('should handle whitespace-only names', () => {
      const validator = duplicateNameValidator(existingNames);
      const control = new FormControl('   ');

      const result = validator(control);

      expect(result).toBeNull();
    });

    it('should trim names before comparison', () => {
      const validator = duplicateNameValidator(existingNames);
      const control = new FormControl('  template 1  ');

      const result = validator(control);

      expect(result).toEqual({
        [TEMPLATE_VALIDATION_ERRORS.DUPLICATE_NAME]: true,
      });
    });
  });

  describe('getTemplateValidationErrorMessage', () => {
    it('should return null for no errors', () => {
      const message = getTemplateValidationErrorMessage(null);
      expect(message).toBeNull();
    });

    it('should prioritize required error', () => {
      const errors = {
        [TEMPLATE_VALIDATION_ERRORS.REQUIRED]: true,
        [TEMPLATE_VALIDATION_ERRORS.MAX_LENGTH]: { requiredLength: 100 },
      };

      const message = getTemplateValidationErrorMessage(errors);
      expect(message).toBe('Le nom est requis');
    });

    it('should handle duplicate name error', () => {
      const errors = { [TEMPLATE_VALIDATION_ERRORS.DUPLICATE_NAME]: true };

      const message = getTemplateValidationErrorMessage(errors);
      expect(message).toBe('Un modèle avec ce nom existe déjà');
    });

    it('should handle max length error with custom field name', () => {
      const errors = {
        [TEMPLATE_VALIDATION_ERRORS.MAX_LENGTH]: { requiredLength: 500 },
      };

      const message = getTemplateValidationErrorMessage(errors, 'description');
      expect(message).toBe(
        'Le description ne peut pas dépasser 500 caractères',
      );
    });

    it('should handle template limit error', () => {
      const errors = {
        [TEMPLATE_VALIDATION_ERRORS.TEMPLATE_LIMIT_REACHED]: { max: 5 },
      };

      const message = getTemplateValidationErrorMessage(errors);
      expect(message).toBe('Vous avez atteint la limite de 5 modèles');
    });

    it('should provide fallback for unknown errors', () => {
      const errors = { customError: true };

      const message = getTemplateValidationErrorMessage(errors);
      expect(message).toBe('Erreur de validation: customError');
    });
  });
});
