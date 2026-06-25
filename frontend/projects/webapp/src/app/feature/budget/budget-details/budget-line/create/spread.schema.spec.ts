import { describe, expect, it } from 'vitest';
import {
  budgetLineSpreadCreateFromFormSchema,
  type BudgetLineSpreadCreateFormValue,
} from './spread.schema';

const spreadFormValue: BudgetLineSpreadCreateFormValue = {
  name: 'Prime assurance',
  kind: 'expense',
  perMonthAmount: 100,
  months: [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ],
  conversion: null,
};

describe('budgetLineSpreadCreateFromFormSchema', () => {
  describe('transform', () => {
    it('should emit perMonthAmount and months without expanding tranches', () => {
      const result = budgetLineSpreadCreateFromFormSchema.parse(spreadFormValue);

      expect(result).toEqual({
        name: 'Prime assurance',
        kind: 'expense',
        perMonthAmount: 100,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
        ],
      });
      expect('tranches' in result).toBe(false);
      expect('conversion' in result).toBe(false);
    });

    it('should map conversion.originalAmount to a single perMonthOriginalAmount with flat FX fields', () => {
      const result = budgetLineSpreadCreateFromFormSchema.parse({
        ...spreadFormValue,
        conversion: {
          originalAmount: 50,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.95,
        },
      });

      expect(result.perMonthOriginalAmount).toBe(50);
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('CHF');
      expect(result.exchangeRate).toBe(0.95);
      expect('tranches' in result).toBe(false);
    });

    it('should omit all FX fields when conversion is null', () => {
      const result = budgetLineSpreadCreateFromFormSchema.parse(spreadFormValue);

      expect('originalCurrency' in result).toBe(false);
      expect('targetCurrency' in result).toBe(false);
      expect('exchangeRate' in result).toBe(false);
      expect('perMonthOriginalAmount' in result).toBe(false);
    });
  });

  describe('validation', () => {
    it('should reject an income kind', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...spreadFormValue,
        kind: 'income',
      });

      expect(result.success).toBe(false);
    });

    it('should reject a non-positive perMonthAmount', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...spreadFormValue,
        perMonthAmount: 0,
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty months array', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...spreadFormValue,
        months: [],
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty name', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...spreadFormValue,
        name: '',
      });

      expect(result.success).toBe(false);
    });
  });
});
