import { describe, expect, it } from 'vitest';
import {
  transactionCreateFromFormSchema,
  transactionUpdateFromFormSchema,
  type TransactionCreateFormValue,
  type TransactionUpdateFormValue,
} from './edit-transaction-form.schema';

const BUDGET_ID = '00000000-0000-4000-8000-000000000001';
const BUDGET_LINE_ID = '00000000-0000-4000-8000-0000000000b1';
const ISO_DATE = '2026-04-15T00:00:00+02:00';

const createFormValue: TransactionCreateFormValue = {
  name: 'Consultation',
  amount: 45,
  kind: 'expense',
  transactionDate: ISO_DATE,
  category: null,
  isChecked: false,
  conversion: null,
  budgetId: BUDGET_ID,
  budgetLineId: BUDGET_LINE_ID,
};

const updateFormValue: TransactionUpdateFormValue = {
  name: 'Consultation',
  amount: 45,
  kind: 'expense',
  transactionDate: ISO_DATE,
  category: null,
  conversion: null,
};

describe('transactionCreateFromFormSchema', () => {
  describe('transform', () => {
    it('should omit currency fields when conversion is null', () => {
      const result = transactionCreateFromFormSchema.parse(createFormValue);

      expect(result).toEqual({
        budgetId: BUDGET_ID,
        budgetLineId: BUDGET_LINE_ID,
        name: 'Consultation',
        amount: 45,
        kind: 'expense',
        transactionDate: ISO_DATE,
        category: null,
        checkedAt: null,
      });
    });

    it('should populate currency fields when conversion is provided', () => {
      const result = transactionCreateFromFormSchema.parse({
        ...createFormValue,
        conversion: {
          originalAmount: 50,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.95,
        },
      });

      expect(result.originalAmount).toBe(50);
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('CHF');
      expect(result.exchangeRate).toBe(0.95);
    });

    it('should set checkedAt to ISO string when isChecked is true', () => {
      const result = transactionCreateFromFormSchema.parse({
        ...createFormValue,
        isChecked: true,
      });

      expect(typeof result.checkedAt).toBe('string');
      expect(() => new Date(result.checkedAt!)).not.toThrow();
    });

    it('should set checkedAt to null when isChecked is false', () => {
      const result = transactionCreateFromFormSchema.parse({
        ...createFormValue,
        isChecked: false,
      });

      expect(result.checkedAt).toBeNull();
    });
  });

  describe('validation', () => {
    it('should reject negative amount', () => {
      const result = transactionCreateFromFormSchema.safeParse({
        ...createFormValue,
        amount: -5,
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-UUID budgetId', () => {
      const result = transactionCreateFromFormSchema.safeParse({
        ...createFormValue,
        budgetId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('transactionUpdateFromFormSchema', () => {
  it('should produce an update DTO without checkedAt or budgetId', () => {
    const result = transactionUpdateFromFormSchema.parse(updateFormValue);

    expect(result).toEqual({
      name: 'Consultation',
      amount: 45,
      kind: 'expense',
      transactionDate: ISO_DATE,
      category: null,
    });
    expect('checkedAt' in result).toBe(false);
    expect('budgetId' in result).toBe(false);
  });

  it('should populate currency fields when conversion is provided', () => {
    const result = transactionUpdateFromFormSchema.parse({
      ...updateFormValue,
      conversion: {
        originalAmount: 50,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.95,
      },
    });

    expect(result.exchangeRate).toBe(0.95);
  });
});
