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
  tagIds: [],
  isChecked: false,
  conversion: null,
};

const context = {
  budgetId: '00000000-0000-4000-8000-000000000001',
  transactionDate: '2026-07-16T12:00:00+02:00',
};

const GOAL_ID = '00000000-0000-4000-8000-0000000000a1';

describe('transactionFormDataSchema', () => {
  it('should validate the shared surface result', () => {
    expect(transactionFormDataSchema.parse(formData)).toEqual({
      ...formData,
      sourceSavingsGoalId: null,
    });
  });

  it('should reject a one-character name', () => {
    const result = transactionFormDataSchema.safeParse({
      ...formData,
      name: 'A',
    });

    expect(result.success).toBe(false);
  });

  it('should reject a whitespace-only name', () => {
    const result = transactionFormDataSchema.safeParse({
      ...formData,
      name: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('should reject a padded one-character name', () => {
    const result = transactionFormDataSchema.safeParse({
      ...formData,
      name: ' A ',
    });

    expect(result.success).toBe(false);
  });

  it('should reject a non-uuid tag id', () => {
    const result = transactionFormDataSchema.safeParse({
      ...formData,
      tagIds: ['not-a-uuid'],
    });

    expect(result.success).toBe(false);
  });
});

describe('transactionCreateFromQuickFormSchema', () => {
  it('should transform the surface result and dashboard context into a transaction', () => {
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

  it('should omit tagIds from the transaction when none are selected', () => {
    const result = transactionCreateFromQuickFormSchema.parse({
      ...formData,
      ...context,
    });

    expect(result.tagIds).toBeUndefined();
  });

  it('should forward selected tagIds to the transaction', () => {
    const tagId = '00000000-0000-4000-8000-0000000000f1';
    const result = transactionCreateFromQuickFormSchema.parse({
      ...formData,
      ...context,
      tagIds: [tagId],
    });

    expect(result.tagIds).toEqual([tagId]);
  });

  it('should flatten conversion metadata into the transaction payload', () => {
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

  it('should forward the savings-goal source of a linked income', () => {
    const result = transactionCreateFromQuickFormSchema.parse({
      ...formData,
      ...context,
      kind: 'income',
      sourceSavingsGoalId: GOAL_ID,
    });

    expect(result.sourceSavingsGoalId).toBe(GOAL_ID);
  });

  it('should omit the source rather than send it null on an ordinary transaction', () => {
    const result = transactionCreateFromQuickFormSchema.parse({
      ...formData,
      ...context,
    });

    expect(result).not.toHaveProperty('sourceSavingsGoalId');
  });

  it('should reject invalid dashboard context', () => {
    const result = transactionCreateFromQuickFormSchema.safeParse({
      ...formData,
      ...context,
      budgetId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });
});
