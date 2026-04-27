import { describe, expect, it, vi } from 'vitest';
import {
  budgetLineCreateFromFormSchema,
  type BudgetLineCreateFormValue,
} from './add-budget-line-dialog.schema';

const BUDGET_ID = '00000000-0000-4000-8000-000000000001';

const createFormValue: BudgetLineCreateFormValue = {
  name: 'Loyer',
  amount: 1200,
  kind: 'expense',
  recurrence: 'fixed',
  isChecked: false,
  conversion: null,
  budgetId: BUDGET_ID,
};

describe('budgetLineCreateFromFormSchema', () => {
  describe('transform', () => {
    it('should produce a BudgetLineCreate DTO with isManuallyAdjusted=true and no UI-only fields', () => {
      const result = budgetLineCreateFromFormSchema.parse(createFormValue);

      expect(result).toEqual({
        budgetId: BUDGET_ID,
        name: 'Loyer',
        amount: 1200,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: true,
        checkedAt: null,
      });
      expect('isChecked' in result).toBe(false);
      expect('conversion' in result).toBe(false);
    });

    it('should populate currency fields when conversion is provided', () => {
      const result = budgetLineCreateFromFormSchema.parse({
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

    it('should set checkedAt to ISO 8601 UTC string when isChecked is true', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-26T10:30:00.000Z'));

      const result = budgetLineCreateFromFormSchema.parse({
        ...createFormValue,
        isChecked: true,
      });

      expect(result.checkedAt).toBe('2026-04-26T10:30:00.000Z');

      vi.useRealTimers();
    });

    it('should set checkedAt to null when isChecked is false', () => {
      const result = budgetLineCreateFromFormSchema.parse({
        ...createFormValue,
        isChecked: false,
      });

      expect(result.checkedAt).toBeNull();
    });
  });

  describe('validation', () => {
    it('should reject a negative amount', () => {
      const result = budgetLineCreateFromFormSchema.safeParse({
        ...createFormValue,
        amount: -5,
      });

      expect(result.success).toBe(false);
    });

    it('should reject a non-UUID budgetId', () => {
      const result = budgetLineCreateFromFormSchema.safeParse({
        ...createFormValue,
        budgetId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty name', () => {
      const result = budgetLineCreateFromFormSchema.safeParse({
        ...createFormValue,
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an invalid kind', () => {
      const result = budgetLineCreateFromFormSchema.safeParse({
        ...createFormValue,
        kind: 'bogus',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an invalid recurrence', () => {
      const result = budgetLineCreateFromFormSchema.safeParse({
        ...createFormValue,
        recurrence: 'quarterly',
      });

      expect(result.success).toBe(false);
    });
  });
});
