import { describe, expect, it } from 'vitest';
import { budgetLineSpreadCreateSchema } from '../schemas.js';

const base = {
  name: 'Prime assurance',
  kind: 'expense' as const,
};

describe('budgetLineSpreadCreateSchema', () => {
  it('accepts a mono-currency spread (no FX metadata)', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      tranches: [
        { year: 2026, month: 1, amount: 100 },
        { year: 2026, month: 2, amount: 100 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a target-only spread (display currency, no conversion)', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      targetCurrency: 'CHF',
      tranches: [{ year: 2026, month: 1, amount: 100 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a full multi-currency spread with a frozen rate', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.96,
      tranches: [
        { year: 2026, month: 1, amount: 96, originalAmount: 100 },
        { year: 2026, month: 2, amount: 96, originalAmount: 100 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects partial FX metadata (originalCurrency without the pair)', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      originalCurrency: 'EUR',
      tranches: [{ year: 2026, month: 1, amount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects full FX when a tranche is missing originalAmount', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 0.96,
      tranches: [
        { year: 2026, month: 1, amount: 96, originalAmount: 100 },
        { year: 2026, month: 2, amount: 96 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects full FX when origin equals target currency', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      originalCurrency: 'CHF',
      targetCurrency: 'CHF',
      exchangeRate: 1,
      tranches: [{ year: 2026, month: 1, amount: 100, originalAmount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a tranche originalAmount without FX metadata', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      tranches: [{ year: 2026, month: 1, amount: 100, originalAmount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects kind=income', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      name: 'Salaire',
      kind: 'income',
      tranches: [{ year: 2026, month: 1, amount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a client-supplied spreadGroupId (server-generated, strictObject)', () => {
    const result = budgetLineSpreadCreateSchema.safeParse({
      ...base,
      spreadGroupId: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      tranches: [{ year: 2026, month: 1, amount: 100 }],
    });
    expect(result.success).toBe(false);
  });
});
