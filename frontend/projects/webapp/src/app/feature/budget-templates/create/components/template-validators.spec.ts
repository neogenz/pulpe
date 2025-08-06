import { FormControl } from '@angular/forms';
import {
  duplicateNameValidator,
  getTemplateNameErrorMessage,
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
        duplicateName: true,
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
        duplicateName: true,
      });
    });
  });

  describe('getTemplateNameErrorMessage', () => {
    it('should return null for no errors', () => {
      const message = getTemplateNameErrorMessage(null);
      expect(message).toBeNull();
    });

    it('should prioritize required error', () => {
      const errors = {
        required: true,
        duplicateName: true,
      };

      const message = getTemplateNameErrorMessage(errors);
      expect(message).toBe('Le nom est requis');
    });

    it('should handle duplicate name error', () => {
      const errors = { duplicateName: true };

      const message = getTemplateNameErrorMessage(errors);
      expect(message).toBe('Un modèle avec ce nom existe déjà');
    });

    it('should return null for unknown errors', () => {
      const errors = { customError: true };

      const message = getTemplateNameErrorMessage(errors);
      expect(message).toBeNull();
    });
  });
});
