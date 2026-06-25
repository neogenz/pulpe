import { describe, expect, it } from 'vitest';
import { budgetLineSpreadCreateSchema } from '../schemas.js';

const base = {
  name: 'Prime assurance',
  kind: 'expense' as const,
  mode: 'perMonth' as const,
  perMonthAmount: 100,
};

const totalBase = {
  name: 'Voyage',
  kind: 'expense' as const,
  mode: 'total' as const,
  totalAmount: 4000,
};

describe('budgetLineSpreadCreateSchema', () => {
  describe('perMonth mode', () => {
    it('accepts a mono-currency intent (no FX metadata)', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a target-only intent (display currency, no conversion)', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        targetCurrency: 'CHF',
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a full multi-currency intent with a single per-month original amount', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
        perMonthOriginalAmount: 100,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects partial FX metadata (originalCurrency without the pair)', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        originalCurrency: 'EUR',
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects full FX when perMonthOriginalAmount is missing', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects perMonthOriginalAmount without originalCurrency/exchangeRate', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        perMonthOriginalAmount: 100,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects full FX when origin equals target currency', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        originalCurrency: 'CHF',
        targetCurrency: 'CHF',
        exchangeRate: 1,
        perMonthOriginalAmount: 100,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a missing perMonthAmount', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        name: 'Prime',
        kind: 'expense',
        mode: 'perMonth',
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('total mode', () => {
    it('accepts a mono-currency total intent', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...totalBase,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
          { year: 2026, month: 3 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a target-only total intent', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...totalBase,
        targetCurrency: 'CHF',
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a full multi-currency total intent with a total original amount', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...totalBase,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
        totalOriginalAmount: 4200,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects a missing totalAmount', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        name: 'Voyage',
        kind: 'expense',
        mode: 'total',
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects full FX when totalOriginalAmount is missing', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...totalBase,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('cross-mode field mixing', () => {
    it('rejects perMonthAmount in total mode', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...totalBase,
        perMonthAmount: 500,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects totalAmount in perMonth mode', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        totalAmount: 4000,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects totalOriginalAmount in perMonth mode', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 0.96,
        totalOriginalAmount: 100,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects an invalid mode value', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        name: 'X',
        kind: 'expense',
        mode: 'whole',
        totalAmount: 4000,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('shared invariants', () => {
    it('rejects kind=income', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        name: 'Salaire',
        kind: 'income',
        mode: 'perMonth',
        perMonthAmount: 100,
        months: [{ year: 2026, month: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty months array', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        months: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects duplicate target months', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        months: [
          { year: 2026, month: 1 },
          { year: 2026, month: 1 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than 36 target months', () => {
      const months = Array.from({ length: 37 }, (_, index) => ({
        year: 2026 + Math.floor(index / 12),
        month: (index % 12) + 1,
      }));
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        months,
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown extra key (strictObject)', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        months: [{ year: 2026, month: 1 }],
        spreadGroupId: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a legacy tranches key (strictObject)', () => {
      const result = budgetLineSpreadCreateSchema.safeParse({
        ...base,
        months: [{ year: 2026, month: 1 }],
        tranches: [{ year: 2026, month: 1, amount: 100 }],
      });
      expect(result.success).toBe(false);
    });
  });
});
