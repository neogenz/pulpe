import { describe, it, expect } from 'bun:test';
import { buildSpreadTranches } from './spread-additive.formulas';

describe('buildSpreadTranches', () => {
  it('replicates the per-month amount into one tranche per month', () => {
    const months = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ];

    const tranches = buildSpreadTranches(100, months);

    expect(tranches).toHaveLength(3);
    expect(tranches.every((t) => t.amount === 100)).toBe(true);
  });

  it('replicates perMonthOriginalAmount on every tranche', () => {
    const months = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ];

    const tranches = buildSpreadTranches(96, months, 100);

    expect(tranches.every((t) => t.originalAmount === 100)).toBe(true);
  });

  it('sets originalAmount to null (not undefined) when perMonthOriginalAmount is omitted', () => {
    const tranches = buildSpreadTranches(100, [{ year: 2026, month: 1 }]);

    expect(tranches[0].originalAmount).toBeNull();
    expect(tranches.every((t) => t.originalAmount === null)).toBe(true);
  });

  it('returns an empty array for empty months', () => {
    expect(buildSpreadTranches(100, [])).toEqual([]);
  });

  it('preserves the input month order (no sort, no reorder)', () => {
    const months = [
      { year: 2026, month: 5 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ];

    const tranches = buildSpreadTranches(100, months);

    expect(tranches.map((t) => `${t.month}/${t.year}`)).toEqual([
      '5/2026',
      '1/2026',
      '12/2025',
    ]);
  });
});
