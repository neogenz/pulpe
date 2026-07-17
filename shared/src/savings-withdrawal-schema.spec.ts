import { describe, expect, it } from 'vitest';
import {
  budgetLineSavingsWithdrawalCreateSchema,
  budgetLineSavingsWithdrawalDeleteQuerySchema,
} from '../schemas.js';

const BUDGET_ID = '123e4567-e89b-12d3-a456-426614174000';
const GROUP_ID = '223e4567-e89b-12d3-a456-426614174000';

const buildPayload = (overrides: Record<string, unknown> = {}) => ({
  budgetId: BUDGET_ID,
  amount: 280,
  incomeName: 'Mon épargne',
  savingName: 'Remettre sur ton épargne',
  ...overrides,
});

describe('budgetLineSavingsWithdrawalCreateSchema', () => {
  it('should accept a minimal payload without FX or group id', () => {
    const result =
      budgetLineSavingsWithdrawalCreateSchema.safeParse(buildPayload());

    expect(result.success).toBe(true);
  });

  it('should accept a client idempotency key', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({ groupId: GROUP_ID }),
    );

    expect(result.success).toBe(true);
  });

  it('should accept the full frozen FX quad with distinct currencies', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({
        originalAmount: 300,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.94,
      }),
    );

    expect(result.success).toBe(true);
  });

  it('should accept target-only FX metadata', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({ targetCurrency: 'CHF' }),
    );

    expect(result.success).toBe(true);
  });

  it('should reject an incoherent FX triad (rate without currencies)', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({ exchangeRate: 0.94 }),
    );

    expect(result.success).toBe(false);
  });

  it('should reject a full FX quad with identical currencies', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({
        originalAmount: 300,
        originalCurrency: 'CHF',
        targetCurrency: 'CHF',
        exchangeRate: 1,
      }),
    );

    expect(result.success).toBe(false);
  });

  it('should reject a non-positive amount', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({ amount: 0 }),
    );

    expect(result.success).toBe(false);
  });

  it('should reject unknown fields (strict contract)', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({ months: [{ year: 2026, month: 8 }] }),
    );

    expect(result.success).toBe(false);
  });

  it('should reject a missing repayment name', () => {
    const result = budgetLineSavingsWithdrawalCreateSchema.safeParse(
      buildPayload({ savingName: '' }),
    );

    expect(result.success).toBe(false);
  });
});

describe('budgetLineSavingsWithdrawalDeleteQuerySchema', () => {
  it.each(['pair', 'repayment'] as const)('should accept scope %s', (scope) => {
    const result = budgetLineSavingsWithdrawalDeleteQuerySchema.safeParse({
      scope,
    });

    expect(result.success).toBe(true);
  });

  it('should reject an unknown scope', () => {
    const result = budgetLineSavingsWithdrawalDeleteQuerySchema.safeParse({
      scope: 'income',
    });

    expect(result.success).toBe(false);
  });
});
