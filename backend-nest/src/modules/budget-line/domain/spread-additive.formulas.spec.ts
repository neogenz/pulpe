import { describe, it, expect } from 'bun:test';
import {
  buildSpreadTranches,
  buildSpreadTranchesFromTotal,
} from './spread-additive.formulas';

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

describe('buildSpreadTranchesFromTotal', () => {
  it('divides the total cents-preserving with the remainder on the first months', () => {
    const months = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ];

    const tranches = buildSpreadTranchesFromTotal(100, months);

    expect(tranches.map((t) => t.amount)).toEqual([33.34, 33.33, 33.33]);
    const sum = tranches.reduce((acc, t) => acc + t.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
  });

  it('splits the FX original total the same way (Σ originals === totalOriginalAmount)', () => {
    const months = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ];

    const tranches = buildSpreadTranchesFromTotal(96, months, 100);

    expect(tranches.map((t) => t.originalAmount)).toEqual([
      33.34, 33.33, 33.33,
    ]);
    const sumOriginal = tranches.reduce(
      (acc, t) => acc + (t.originalAmount ?? 0),
      0,
    );
    expect(Math.round(sumOriginal * 100) / 100).toBe(100);
  });

  it('sets originalAmount to null on every tranche when totalOriginalAmount is omitted', () => {
    const tranches = buildSpreadTranchesFromTotal(100, [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);

    expect(tranches.every((t) => t.originalAmount === null)).toBe(true);
  });

  it('returns an empty array for empty months', () => {
    expect(buildSpreadTranchesFromTotal(100, [])).toEqual([]);
  });

  it('preserves the input month order (no sort, no reorder)', () => {
    const months = [
      { year: 2026, month: 5 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ];

    const tranches = buildSpreadTranchesFromTotal(90, months);

    expect(tranches.map((t) => `${t.month}/${t.year}`)).toEqual([
      '5/2026',
      '1/2026',
      '12/2025',
    ]);
  });
});
