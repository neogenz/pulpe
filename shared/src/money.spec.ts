import { describe, expect, it } from 'vitest';
import { hasCents, moneyDifference } from './money.js';

describe('moneyDifference', () => {
  it('ignores binary floating-point dust', () => {
    expect(moneyDifference(0.1 + 0.2, 0.3)).toBe(0);
    expect(Object.is(moneyDifference(-0.004, 0), -0)).toBe(false);
  });

  it('preserves a real cent-level difference and its sign', () => {
    expect(moneyDifference(58.55, 58.5)).toBe(0.05);
    expect(moneyDifference(58.5, 58.55)).toBe(-0.05);
  });

  it('keeps integer differences exact', () => {
    expect(moneyDifference(5_000, 4_000)).toBe(1_000);
  });

  it.each(['CHF', 'EUR'])('uses two-decimal precision for %s', () => {
    expect(moneyDifference(10.01, 10)).toBe(0.01);
  });
});

describe('hasCents', () => {
  it('is false on a whole amount, including float dust below the cent', () => {
    expect(hasCents(5_500)).toBe(false);
    expect(hasCents(1_960.004)).toBe(false);
    expect(hasCents(-120)).toBe(false);
  });

  it('is true as soon as one cent survives the rounding', () => {
    expect(hasCents(1_960.5)).toBe(true);
    expect(hasCents(112.22999999999999)).toBe(true);
    expect(hasCents(-0.05)).toBe(true);
  });
});
