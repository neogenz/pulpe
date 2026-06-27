import { describe, expect, it } from 'vitest';
import {
  budgetLineSpreadCreateFromFormSchema,
  type BudgetLineSpreadCreateFormValue,
} from './spread.schema';

const months = [
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
];

const SPREAD_GROUP_ID = '11111111-1111-4111-8111-111111111111';

const totalFormValue: BudgetLineSpreadCreateFormValue = {
  name: 'Prime assurance',
  kind: 'expense',
  mode: 'total',
  amount: 200,
  months,
  conversion: null,
  spreadGroupId: SPREAD_GROUP_ID,
};

const perMonthFormValue: BudgetLineSpreadCreateFormValue = {
  name: 'Prime assurance',
  kind: 'expense',
  mode: 'perMonth',
  amount: 100,
  months,
  conversion: null,
  spreadGroupId: SPREAD_GROUP_ID,
};

describe('budgetLineSpreadCreateFromFormSchema', () => {
  describe('transform — total mode', () => {
    it('should emit totalAmount and months without expanding tranches', () => {
      const result = budgetLineSpreadCreateFromFormSchema.parse(totalFormValue);

      expect(result).toEqual({
        name: 'Prime assurance',
        kind: 'expense',
        mode: 'total',
        totalAmount: 200,
        months,
        spreadGroupId: SPREAD_GROUP_ID,
      });
      expect('perMonthAmount' in result).toBe(false);
      expect('tranches' in result).toBe(false);
      expect('conversion' in result).toBe(false);
    });

    it('should map conversion.originalAmount to totalOriginalAmount with flat FX fields', () => {
      const result = budgetLineSpreadCreateFromFormSchema.parse({
        ...totalFormValue,
        conversion: {
          originalAmount: 180,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.95,
        },
      });

      expect(result.mode).toBe('total');
      expect(result.totalAmount).toBe(200);
      expect(result.totalOriginalAmount).toBe(180);
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('CHF');
      expect(result.exchangeRate).toBe(0.95);
      expect('perMonthOriginalAmount' in result).toBe(false);
    });

    it('should omit all FX fields when conversion is null', () => {
      const result = budgetLineSpreadCreateFromFormSchema.parse(totalFormValue);

      expect('originalCurrency' in result).toBe(false);
      expect('targetCurrency' in result).toBe(false);
      expect('exchangeRate' in result).toBe(false);
      expect('totalOriginalAmount' in result).toBe(false);
    });
  });

  describe('transform — perMonth mode', () => {
    it('should emit perMonthAmount and months without expanding tranches', () => {
      const result =
        budgetLineSpreadCreateFromFormSchema.parse(perMonthFormValue);

      expect(result).toEqual({
        name: 'Prime assurance',
        kind: 'expense',
        mode: 'perMonth',
        perMonthAmount: 100,
        months,
        spreadGroupId: SPREAD_GROUP_ID,
      });
      expect('totalAmount' in result).toBe(false);
      expect('tranches' in result).toBe(false);
      expect('conversion' in result).toBe(false);
    });

    it('should map conversion.originalAmount to perMonthOriginalAmount with flat FX fields', () => {
      const result = budgetLineSpreadCreateFromFormSchema.parse({
        ...perMonthFormValue,
        conversion: {
          originalAmount: 50,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.95,
        },
      });

      expect(result.mode).toBe('perMonth');
      expect(result.perMonthAmount).toBe(100);
      expect(result.perMonthOriginalAmount).toBe(50);
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('CHF');
      expect(result.exchangeRate).toBe(0.95);
      expect('totalOriginalAmount' in result).toBe(false);
    });
  });

  describe('validation', () => {
    it('should reject an income kind', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...totalFormValue,
        kind: 'income',
      });

      expect(result.success).toBe(false);
    });

    it('should reject a non-positive amount', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...totalFormValue,
        amount: 0,
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty months array', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...totalFormValue,
        months: [],
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty name', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...totalFormValue,
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an unknown mode', () => {
      const result = budgetLineSpreadCreateFromFormSchema.safeParse({
        ...totalFormValue,
        mode: 'split',
      });

      expect(result.success).toBe(false);
    });
  });
});
