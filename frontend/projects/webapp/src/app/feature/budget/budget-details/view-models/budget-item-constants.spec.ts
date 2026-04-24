import { describe, it, expect } from 'vitest';
import {
  calculatePercentage,
  getBudgetConsumptionState,
  NEAR_LIMIT_THRESHOLD,
} from './budget-item-constants';

describe('calculatePercentage', () => {
  it('returns 0 when reserved is 0 and consumed is 0', () => {
    expect(calculatePercentage(0, 0)).toBe(0);
  });

  it('returns forced over-budget when reserved is 0 and consumed > 0', () => {
    expect(calculatePercentage(0, 50)).toBe(101);
  });

  it('returns forced over-budget when reserved is negative and consumed > 0', () => {
    expect(calculatePercentage(-100, 50)).toBe(101);
  });

  it('returns 0 when reserved is negative and consumed is 0', () => {
    expect(calculatePercentage(-100, 0)).toBe(0);
  });

  it('calculates percentage correctly', () => {
    expect(calculatePercentage(100, 50)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    expect(calculatePercentage(3, 1)).toBe(33);
  });

  it('returns 100 when fully consumed', () => {
    expect(calculatePercentage(500, 500)).toBe(100);
  });

  it('returns > 100 when over-consumed', () => {
    expect(calculatePercentage(100, 150)).toBe(150);
  });
});

describe('getBudgetConsumptionState', () => {
  it('returns no-transactions when hasTransactions is false', () => {
    expect(getBudgetConsumptionState(50, false, 'expense')).toBe(
      'no-transactions',
    );
  });

  describe('expense lines', () => {
    it('returns healthy below near-limit threshold', () => {
      expect(
        getBudgetConsumptionState(NEAR_LIMIT_THRESHOLD - 1, true, 'expense'),
      ).toBe('healthy');
    });

    it('returns near-limit at threshold', () => {
      expect(
        getBudgetConsumptionState(NEAR_LIMIT_THRESHOLD, true, 'expense'),
      ).toBe('near-limit');
    });

    it('returns near-limit between threshold and 100', () => {
      expect(getBudgetConsumptionState(99, true, 'expense')).toBe('near-limit');
    });

    it('returns near-limit at exactly 100', () => {
      expect(getBudgetConsumptionState(100, true, 'expense')).toBe(
        'near-limit',
      );
    });

    it('returns over-budget above 100', () => {
      expect(getBudgetConsumptionState(101, true, 'expense')).toBe(
        'over-budget',
      );
    });
  });

  describe('non-expense lines (income, saving)', () => {
    it('returns healthy for income regardless of percentage', () => {
      expect(getBudgetConsumptionState(200, true, 'income')).toBe('healthy');
    });

    it('returns healthy for saving regardless of percentage', () => {
      expect(getBudgetConsumptionState(150, true, 'saving')).toBe('healthy');
    });

    it('returns healthy for income at 0%', () => {
      expect(getBudgetConsumptionState(0, true, 'income')).toBe('healthy');
    });
  });
});
