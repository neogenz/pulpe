import { describe, it, expect } from 'vitest';
import { splitTotalPreserving } from './spread-split.js';

describe('splitTotalPreserving', () => {
  const sumCents = (parts: number[]): number =>
    parts.reduce((acc, p) => acc + Math.round(p * 100), 0);

  it('splits evenly when divisible', () => {
    expect(splitTotalPreserving(800, 8)).toEqual([
      100, 100, 100, 100, 100, 100, 100, 100,
    ]);
  });

  it('puts the remainder cents on the FIRST parts (M0 first)', () => {
    expect(splitTotalPreserving(800, 3)).toEqual([266.67, 266.67, 266.66]);
  });

  it('preserves the total to the cent for 100 / 7', () => {
    const parts = splitTotalPreserving(100, 7);
    expect(sumCents(parts)).toBe(10000);
    expect(parts[0]).toBeGreaterThanOrEqual(parts[6]);
  });

  it('preserves the total to the cent for 1000 / 6', () => {
    const parts = splitTotalPreserving(1000, 6);
    expect(sumCents(parts)).toBe(100000);
    expect(parts).toEqual([166.67, 166.67, 166.67, 166.67, 166.66, 166.66]);
  });

  it('handles a single part', () => {
    expect(splitTotalPreserving(42.5, 1)).toEqual([42.5]);
  });

  it('rejects a non-positive total', () => {
    expect(() => splitTotalPreserving(0, 3)).toThrow();
    expect(() => splitTotalPreserving(-10, 3)).toThrow();
  });

  it('rejects an invalid partCount', () => {
    expect(() => splitTotalPreserving(100, 0)).toThrow();
    expect(() => splitTotalPreserving(100, 2.5)).toThrow();
  });

  describe('invariant sweep', () => {
    const isNonIncreasing = (parts: number[]): boolean =>
      parts.every(
        (part, index) =>
          index === 0 ||
          Math.round(parts[index - 1] * 100) >= Math.round(part * 100),
      );

    it.each([
      [100.01, 3],
      [1234.56, 7],
      [999.99, 36],
      [10000, 36],
      [50.05, 13],
    ])(
      'splits %d over %d parts: Σ === total to the cent and remainder lands on the first parts',
      (total, partCount) => {
        const parts = splitTotalPreserving(total, partCount);

        expect(parts).toHaveLength(partCount);
        expect(sumCents(parts)).toBe(Math.round(total * 100));
        expect(isNonIncreasing(parts)).toBe(true);
      },
    );
  });
});
