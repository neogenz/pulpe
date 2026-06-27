import { describe, expect, it } from 'vitest';
import {
  MAX_SPREAD_MONTHS,
  defaultSpreadEnd,
  enumerateMonths,
  monthKey,
  monthSpan,
} from './spread.utils';

describe('spread.utils', () => {
  describe('monthSpan', () => {
    it('returns 1 for the same month', () => {
      expect(
        monthSpan({ year: 2026, month: 6 }, { year: 2026, month: 6 }),
      ).toBe(1);
    });

    it('counts inclusive months within a year', () => {
      expect(
        monthSpan({ year: 2026, month: 1 }, { year: 2026, month: 6 }),
      ).toBe(6);
    });

    it('counts across a year boundary', () => {
      expect(
        monthSpan({ year: 2026, month: 11 }, { year: 2027, month: 2 }),
      ).toBe(4);
    });

    it('returns a value < 1 when end precedes start', () => {
      expect(
        monthSpan({ year: 2026, month: 6 }, { year: 2026, month: 5 }),
      ).toBeLessThan(1);
    });
  });

  describe('enumerateMonths', () => {
    it('lists every month inclusive of both ends', () => {
      const months = enumerateMonths(
        { year: 2026, month: 1 },
        { year: 2026, month: 3 },
      );
      expect(months).toEqual([
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
      ]);
    });

    it('wraps across the year boundary', () => {
      const months = enumerateMonths(
        { year: 2026, month: 11 },
        { year: 2027, month: 1 },
      );
      expect(months).toEqual([
        { year: 2026, month: 11 },
        { year: 2026, month: 12 },
        { year: 2027, month: 1 },
      ]);
    });

    it('returns an empty array when end precedes start', () => {
      expect(
        enumerateMonths({ year: 2026, month: 6 }, { year: 2026, month: 5 }),
      ).toEqual([]);
    });
  });

  describe('defaultSpreadEnd', () => {
    it('defaults to a 6-month horizon (inclusive)', () => {
      expect(defaultSpreadEnd({ year: 2026, month: 1 })).toEqual({
        year: 2026,
        month: 6,
      });
    });

    it('wraps the horizon across the year boundary', () => {
      expect(defaultSpreadEnd({ year: 2026, month: 10 })).toEqual({
        year: 2027,
        month: 3,
      });
    });

    it('never produces a window longer than the cap', () => {
      const start = { year: 2026, month: 1 };
      const end = defaultSpreadEnd(start, MAX_SPREAD_MONTHS + 12);
      expect(monthSpan(start, end)).toBeLessThanOrEqual(MAX_SPREAD_MONTHS);
    });
  });

  describe('monthKey', () => {
    it('builds a stable key', () => {
      expect(monthKey({ year: 2026, month: 3 })).toBe('2026-3');
    });
  });
});
