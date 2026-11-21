import { describe, it, expect } from 'vitest';
import {
  reconciliationContextSchema,
  updateReconciliationStateSchema,
} from '../schemas.js';

describe('updateReconciliationStateSchema', () => {
  it.each([
    { startingAmount: 3100 },
    { startingAmount: -50.5 },
    { startingAmount: 999_999_999.99 },
    { startingAmount: -999_999_999.99 },
    { completed: true },
    { startingAmount: 0, completed: true },
  ])('should accept %j', (body) => {
    expect(updateReconciliationStateSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['empty', {}],
    ['unknown key', { startingAmount: 1, extra: 1 }],
    ['text amount', { startingAmount: 'abc' }],
    ['NaN', { startingAmount: Number.NaN }],
    ['Infinity', { startingAmount: Number.POSITIVE_INFINITY }],
    ['above nine digits', { startingAmount: 1_000_000_000 }],
    ['below -nine digits', { startingAmount: -1_000_000_000 }],
    ['1e308', { startingAmount: 1e308 }],
    ['completed false', { completed: false }],
  ])('should reject %s', (_name, body) => {
    expect(updateReconciliationStateSchema.safeParse(body).success).toBe(false);
  });
});

describe('reconciliationContextSchema', () => {
  it('should accept the empty context of a new user', () => {
    const result = reconciliationContextSchema.safeParse({
      startingAmount: 0,
      hasCompletedComparison: false,
      priorCorrection: 0,
      priorItems: [],
    });

    expect(result.success).toBe(true);
  });

  it('should reject a prior item older than two months', () => {
    const result = reconciliationContextSchema.safeParse({
      startingAmount: 0,
      hasCompletedComparison: false,
      priorCorrection: 0,
      priorItems: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          source: 'transaction',
          budgetId: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Pharmacie',
          amount: 20,
          kind: 'expense',
          monthsAgo: 3,
          effect: -20,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
