import { describe, expect, it } from 'vitest';
import {
  budgetLineSavingsWithdrawalFromFormSchema,
  type BudgetLineSavingsWithdrawalFormValue,
} from './dialog.schema';

const BUDGET_ID = '00000000-0000-4000-8000-000000000001';
const GROUP_ID = '00000000-0000-4000-8000-0000000000aa';

const formValue: BudgetLineSavingsWithdrawalFormValue = {
  budgetId: BUDGET_ID,
  amount: 320,
  incomeName: 'Mon épargne',
  savingName: 'Remettre sur ton épargne',
  groupId: GROUP_ID,
  conversion: null,
};

describe('budgetLineSavingsWithdrawalFromFormSchema', () => {
  describe('transform', () => {
    it('should produce a savings-withdrawal DTO carrying both names and the group id, no FX fields', () => {
      const result = budgetLineSavingsWithdrawalFromFormSchema.parse(formValue);

      expect(result).toEqual({
        budgetId: BUDGET_ID,
        amount: 320,
        incomeName: 'Mon épargne',
        savingName: 'Remettre sur ton épargne',
        groupId: GROUP_ID,
      });
      expect('conversion' in result).toBe(false);
    });

    it('should populate the frozen FX quad when a conversion is provided', () => {
      const result = budgetLineSavingsWithdrawalFromFormSchema.parse({
        ...formValue,
        conversion: {
          originalAmount: 300,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.95,
        },
      });

      expect(result.originalAmount).toBe(300);
      expect(result.originalCurrency).toBe('EUR');
      expect(result.targetCurrency).toBe('CHF');
      expect(result.exchangeRate).toBe(0.95);
    });
  });

  describe('validation', () => {
    it('should reject a non-positive amount', () => {
      const result = budgetLineSavingsWithdrawalFromFormSchema.safeParse({
        ...formValue,
        amount: 0,
      });

      expect(result.success).toBe(false);
    });

    it('should reject a non-uuid group id (missing idempotency key is a parse error)', () => {
      const result = budgetLineSavingsWithdrawalFromFormSchema.safeParse({
        ...formValue,
        groupId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty income name', () => {
      const result = budgetLineSavingsWithdrawalFromFormSchema.safeParse({
        ...formValue,
        incomeName: '',
      });

      expect(result.success).toBe(false);
    });
  });
});
