import { TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  BudgetCreationFormState,
  type BudgetCreationFormData,
} from './budget-creation-form-state';
import { startOfMonth } from 'date-fns';

describe('BudgetCreationFormState', () => {
  let service: BudgetCreationFormState;
  let formBuilder: FormBuilder;
  let form: FormGroup;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BudgetCreationFormState, FormBuilder],
    });

    service = TestBed.inject(BudgetCreationFormState);
    formBuilder = TestBed.inject(FormBuilder);

    // Create a test form similar to the one used in the component
    form = formBuilder.group({
      monthYear: [new Date(), Validators.required],
      description: ['', [Validators.required, Validators.maxLength(100)]],
      templateId: ['', Validators.required],
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setMonthAndYear', () => {
    it('should set month and year correctly when form has existing value', () => {
      const existingDate = new Date(2024, 5, 15); // June 15, 2024
      const newDate = new Date(2025, 2, 10); // March 10, 2025

      form.get('monthYear')?.setValue(existingDate);

      service.setMonthAndYear(form, newDate);

      const resultDate = form.get('monthYear')?.value;
      expect(resultDate).toEqual(startOfMonth(new Date(2025, 2, 1))); // March 1, 2025
    });

    it('should set month and year correctly when form has no existing value', () => {
      const newDate = new Date(2025, 7, 20); // August 20, 2025

      form.get('monthYear')?.setValue(null);

      service.setMonthAndYear(form, newDate);

      const resultDate = form.get('monthYear')?.value;
      expect(resultDate).toEqual(startOfMonth(new Date(2025, 7, 1))); // August 1, 2025
    });

    it('should mark monthYear field as touched', () => {
      const newDate = new Date(2025, 0, 1); // January 1, 2025

      expect(form.get('monthYear')?.touched).toBe(false);

      service.setMonthAndYear(form, newDate);

      expect(form.get('monthYear')?.touched).toBe(true);
    });

    it('should handle edge case dates correctly', () => {
      // Test with December (month 11)
      const newDate = new Date(2025, 11, 31); // December 31, 2025

      service.setMonthAndYear(form, newDate);

      const resultDate = form.get('monthYear')?.value;
      expect(resultDate).toEqual(startOfMonth(new Date(2025, 11, 1))); // December 1, 2025
    });

    it('should preserve date-fns startOfMonth behavior', () => {
      const testDate = new Date(2025, 5, 15); // June 15, 2025
      const expectedDate = startOfMonth(testDate);

      service.setMonthAndYear(form, testDate);

      const resultDate = form.get('monthYear')?.value;
      expect(resultDate).toEqual(expectedDate);
      expect(resultDate.getDate()).toBe(1); // Should always be first day of month
      expect(resultDate.getHours()).toBe(0); // Should be start of day
      expect(resultDate.getMinutes()).toBe(0);
      expect(resultDate.getSeconds()).toBe(0);
      expect(resultDate.getMilliseconds()).toBe(0);
    });
  });

  describe('validateAndGetFormData', () => {
    it('should return form data when form is valid', () => {
      const testData = {
        monthYear: new Date(2025, 6, 1),
        description: 'Test budget description',
        templateId: 'test-template-id',
      };

      form.patchValue(testData);

      const result = service.validateAndGetFormData(form);

      expect(result).toEqual(testData);
    });

    it('should return null when form is invalid - missing description', () => {
      form.patchValue({
        monthYear: new Date(2025, 6, 1),
        description: '', // Invalid - required field empty
        templateId: 'test-template-id',
      });

      const result = service.validateAndGetFormData(form);

      expect(result).toBeNull();
    });

    it('should return null when form is invalid - missing monthYear', () => {
      form.patchValue({
        monthYear: null, // Invalid - required field empty
        description: 'Test description',
        templateId: 'test-template-id',
      });

      const result = service.validateAndGetFormData(form);

      expect(result).toBeNull();
    });

    it('should return null when form is invalid - missing templateId', () => {
      form.patchValue({
        monthYear: new Date(2025, 6, 1),
        description: 'Test description',
        templateId: '', // Invalid - required field empty
      });

      const result = service.validateAndGetFormData(form);

      expect(result).toBeNull();
    });

    it('should return null when form is invalid - description too long', () => {
      const longDescription = 'a'.repeat(101); // 101 characters, exceeds maxLength(100)

      form.patchValue({
        monthYear: new Date(2025, 6, 1),
        description: longDescription,
        templateId: 'test-template-id',
      });

      const result = service.validateAndGetFormData(form);

      expect(result).toBeNull();
    });

    it('should handle edge case of exactly max length description', () => {
      const maxLengthDescription = 'a'.repeat(100); // Exactly 100 characters

      form.patchValue({
        monthYear: new Date(2025, 6, 1),
        description: maxLengthDescription,
        templateId: 'test-template-id',
      });

      const result = service.validateAndGetFormData(form);

      expect(result).not.toBeNull();
      expect(result?.description).toBe(maxLengthDescription);
    });

    it('should return correctly typed BudgetCreationFormData', () => {
      const testData = {
        monthYear: new Date(2025, 6, 1),
        description: 'Test budget description',
        templateId: 'test-template-id',
      };

      form.patchValue(testData);

      const result = service.validateAndGetFormData(form);

      // Type assertions to ensure correct typing
      expect(result).toBeDefined();
      if (result) {
        expect(result.monthYear).toBeInstanceOf(Date);
        expect(typeof result.description).toBe('string');
        expect(typeof result.templateId).toBe('string');

        // Verify the interface structure
        const typedResult: BudgetCreationFormData = result;
        expect(typedResult.monthYear).toEqual(testData.monthYear);
        expect(typedResult.description).toEqual(testData.description);
        expect(typedResult.templateId).toEqual(testData.templateId);
      }
    });
  });

  describe('Integration behavior', () => {
    it('should work correctly with form state changes', () => {
      // Simulate the typical workflow
      const selectedDate = new Date(2025, 8, 15); // September 15, 2025

      // 1. Set month and year
      service.setMonthAndYear(form, selectedDate);

      // 2. Add description and template
      form.patchValue({
        description: 'Monthly budget for September',
        templateId: 'september-template-id',
      });

      // 3. Validate and get data
      const result = service.validateAndGetFormData(form);

      expect(result).toBeDefined();
      expect(result?.monthYear).toEqual(startOfMonth(new Date(2025, 8, 1)));
      expect(result?.description).toBe('Monthly budget for September');
      expect(result?.templateId).toBe('september-template-id');
      expect(form.get('monthYear')?.touched).toBe(true);
    });
  });
});
