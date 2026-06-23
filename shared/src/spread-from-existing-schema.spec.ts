import { describe, expect, it } from 'vitest';
import {
  budgetLineSpreadFromLineCreateSchema,
  transactionSpreadFromTxnCreateSchema,
} from '../schemas.js';

const buildPeriods = (count: number): { year: number; month: number }[] =>
  Array.from({ length: count }, (_, index) => ({
    year: 2026 + Math.floor(index / 12),
    month: (index % 12) + 1,
  }));

describe.each([
  [
    'budgetLineSpreadFromLineCreateSchema',
    budgetLineSpreadFromLineCreateSchema,
  ],
  [
    'transactionSpreadFromTxnCreateSchema',
    transactionSpreadFromTxnCreateSchema,
  ],
] as const)('%s', (_name, schema) => {
  it('accepts the minimum window of 2 periods', () => {
    const result = schema.safeParse({ periods: buildPeriods(2) });
    expect(result.success).toBe(true);
  });

  it('accepts the maximum window of 36 periods', () => {
    const result = schema.safeParse({ periods: buildPeriods(36) });
    expect(result.success).toBe(true);
  });

  it('rejects a single-period window (smoothing on 1 month is a no-op)', () => {
    const result = schema.safeParse({ periods: buildPeriods(1) });
    expect(result.success).toBe(false);
  });

  it('rejects a window exceeding 36 periods', () => {
    const result = schema.safeParse({ periods: buildPeriods(37) });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate periods even when the array has the minimum length', () => {
    const result = schema.safeParse({
      periods: [
        { year: 2026, month: 1 },
        { year: 2026, month: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys (strictObject — no client-forged fields)', () => {
    const result = schema.safeParse({
      periods: buildPeriods(2),
      spreadGroupId: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    });
    expect(result.success).toBe(false);
  });
});
