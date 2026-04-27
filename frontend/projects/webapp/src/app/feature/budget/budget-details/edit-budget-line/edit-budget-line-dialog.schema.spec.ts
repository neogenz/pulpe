import { describe, expect, it } from 'vitest';
import {
  budgetLineUpdateFromFormSchema,
  type BudgetLineUpdateFormValue,
} from './edit-budget-line-dialog.schema';

const updateFormValue: BudgetLineUpdateFormValue = {
  name: 'Loyer',
  amount: 1200,
  kind: 'expense',
  recurrence: 'fixed',
  conversion: null,
};

describe('budgetLineUpdateFromFormSchema', () => {
  describe('transform', () => {
    it('should produce a partial BudgetLineUpdate with isManuallyAdjusted=true and no UI-only fields', () => {
      const result = budgetLineUpdateFromFormSchema.parse(updateFormValue);

      expect(result).toEqual({
        name: 'Loyer',
        amount: 1200,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: true,
      });
      expect('conversion' in result).toBe(false);
      expect('checkedAt' in result).toBe(false);
      expect('budgetId' in result).toBe(false);
    });

    it('should omit currency fields when conversion is null', () => {
      const result = budgetLineUpdateFromFormSchema.parse(updateFormValue);

      expect('originalAmount' in result).toBe(false);
      expect('originalCurrency' in result).toBe(false);
      expect('targetCurrency' in result).toBe(false);
      expect('exchangeRate' in result).toBe(false);
    });

    it('should populate currency fields when conversion is provided', () => {
      const result = budgetLineUpdateFromFormSchema.parse({
        ...updateFormValue,
        conversion: {
          originalAmount: 100,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 1.2,
        },
      });

      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('CHF');
      expect(result.exchangeRate).toBe(1.2);
      expect('conversion' in result).toBe(false);
    });

    it('should trim a name with surrounding whitespace', () => {
      const result = budgetLineUpdateFromFormSchema.parse({
        ...updateFormValue,
        name: '  Loyer  ',
      });

      expect(result.name).toBe('Loyer');
    });
  });

  describe('validation', () => {
    it('should reject a negative amount', () => {
      const result = budgetLineUpdateFromFormSchema.safeParse({
        ...updateFormValue,
        amount: -5,
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty name', () => {
      const result = budgetLineUpdateFromFormSchema.safeParse({
        ...updateFormValue,
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an invalid kind', () => {
      const result = budgetLineUpdateFromFormSchema.safeParse({
        ...updateFormValue,
        kind: 'bogus',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an invalid recurrence', () => {
      const result = budgetLineUpdateFromFormSchema.safeParse({
        ...updateFormValue,
        recurrence: 'quarterly',
      });

      expect(result.success).toBe(false);
    });
  });
});
