import { describe, it, expect } from 'bun:test';
import {
  buildSpreadFromExistingPlan,
  type SpreadSource,
} from './spread-from-existing.formulas';

const source = (overrides: Partial<SpreadSource> = {}): SpreadSource => ({
  month: 3,
  year: 2026,
  amount: 300,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  ...overrides,
});

describe('buildSpreadFromExistingPlan', () => {
  it('splits the source total across the window, source month first, sum preserved', () => {
    const plan = buildSpreadFromExistingPlan(source({ amount: 300 }), [
      { year: 2026, month: 5 },
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
    ]);

    expect(plan.tranches.map((t) => `${t.month}/${t.year}`)).toEqual([
      '3/2026',
      '4/2026',
      '5/2026',
    ]);
    expect(plan.tranches.reduce((sum, t) => sum + t.amount, 0)).toBe(300);
  });

  it('rejects a window that omits the source month', () => {
    expect(() =>
      buildSpreadFromExistingPlan(source({ month: 3, year: 2026 }), [
        { year: 2026, month: 4 },
        { year: 2026, month: 5 },
      ]),
    ).toThrow(/must include the source month/);
  });

  it('reports the past-month error (not the missing-source one) when only past months are selected', () => {
    // [Jan, Feb] with M0 = Mar: the window both omits M0 AND contains past
    // months. The past-month guard must win so the message names the real
    // mistake — this asserts the validation order.
    let thrown: Error | undefined;
    try {
      buildSpreadFromExistingPlan(source({ month: 3, year: 2026 }), [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toMatch(/before the source month/);
    expect(thrown?.message).not.toMatch(/must include the source month/);
  });
});
