import { describe, expect, it } from 'vitest';

import {
  transactionCreateFromQuickFormSchema,
  transactionFormDataSchema,
  type TransactionFormData,
} from './add-transaction-form.schema';

const formData: TransactionFormData = {
  name: 'Courses',
  amount: 45,
  kind: 'expense',
  category: null,
  isChecked: false,
  conversion: null,
};

const context = {
  budgetId: '00000000-0000-4000-8000-000000000001',
  transactionDate: '2026-07-16T12:00:00+02:00',
};

describe('transactionFormDataSchema', () => {
  it('validates the shared surface result', () => {
    expect(transactionFormDataSchema.parse(formData)).toEqual(formData);
  });
});

describe('transactionCreateFromQuickFormSchema', () => {
  it('transforms the surface result and dashboard context into a transaction', () => {
    const result = transactionCreateFromQuickFormSchema.parse({
      ...formData,
      ...context,
      isChecked: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        budgetId: context.budgetId,
        transactionDate: context.transactionDate,
        name: 'Courses',
        amount: 45,
        checkedAt: expect.any(String),
      }),
    );
  });

  it('flattens conversion metadata into the transaction payload', () => {
    const result = transactionCreateFromQuickFormSchema.parse({
      ...formData,
      ...context,
      conversion: {
        originalAmount: 50,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.9,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        originalAmount: 50,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.9,
      }),
    );
  });

  it('rejects invalid dashboard context', () => {
    const result = transactionCreateFromQuickFormSchema.safeParse({
      ...formData,
      ...context,
      budgetId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });
});
