import { describe, it, expect } from 'vitest';
import {
  calculatePercentage,
  consumptionProgressMessage,
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

describe('consumptionProgressMessage', () => {
  it('keeps the percentage through exactly 100%', () => {
    expect(consumptionProgressMessage(100, 100, 100)).toEqual({
      key: 'budgetLine.usedPercent',
      params: { percent: 100 },
    });
  });

  it('replaces an overflow percentage with the exceeded amount', () => {
    expect(consumptionProgressMessage(39, 343, 879)).toEqual({
      key: 'budgetLine.exceededBy',
      params: { amount: 304 },
    });
  });

  it('detects an overflow hidden by a rounded percentage', () => {
    const planned = 58.5;
    const consumed = 58.55;
    const percentage = calculatePercentage(planned, consumed);
    const message = consumptionProgressMessage(planned, consumed, percentage);

    expect(percentage).toBe(100);
    expect(message.key).toBe('budgetLine.exceededBy');
    if (message.key !== 'budgetLine.exceededBy') {
      throw new Error('Expected the exact amounts to produce an overage');
    }
    expect(message.params.amount).toBeCloseTo(0.05);
  });
});

describe('getBudgetConsumptionState', () => {
  it('returns no-transactions when hasTransactions is false', () => {
    expect(getBudgetConsumptionState(50, false, 'expense', false)).toBe(
      'no-transactions',
    );
  });

  describe('expense lines', () => {
    it('returns healthy below near-limit threshold', () => {
      expect(
        getBudgetConsumptionState(
          NEAR_LIMIT_THRESHOLD - 1,
          true,
          'expense',
          false,
        ),
      ).toBe('healthy');
    });

    it('returns near-limit at threshold', () => {
      expect(
        getBudgetConsumptionState(NEAR_LIMIT_THRESHOLD, true, 'expense', false),
      ).toBe('near-limit');
    });

    it('returns near-limit between threshold and 100', () => {
      expect(getBudgetConsumptionState(99, true, 'expense', false)).toBe(
        'near-limit',
      );
    });

    it('returns near-limit at exactly 100', () => {
      expect(getBudgetConsumptionState(100, true, 'expense', false)).toBe(
        'near-limit',
      );
    });

    it('returns over-budget when the exact amounts exceed the forecast', () => {
      expect(getBudgetConsumptionState(100, true, 'expense', true)).toBe(
        'over-budget',
      );
    });
  });

  describe('non-expense lines (income, saving)', () => {
    it('returns healthy for income regardless of percentage', () => {
      expect(getBudgetConsumptionState(200, true, 'income', true)).toBe(
        'healthy',
      );
    });

    it('returns healthy for saving regardless of percentage', () => {
      expect(getBudgetConsumptionState(150, true, 'saving', true)).toBe(
        'healthy',
      );
    });

    it('returns healthy for income at 0%', () => {
      expect(getBudgetConsumptionState(0, true, 'income', false)).toBe(
        'healthy',
      );
    });
  });
});
