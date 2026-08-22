import { describe, expect, it } from 'bun:test';
import {
  driftHistory,
  isClosedMonth,
  monthDrift,
  PRIOR_STRENGTH_MAX,
  PRIOR_STRENGTH_MIN,
  type HistoryMonth,
  type HistoryTransaction,
} from './drift-history';

// Pay day 1 → calendar months. "Now" is well past every fixture month.
const PAY_DAY = 1;
const NOW = new Date(2026, 7, 22);
const CHECKED = '2026-01-31T10:00:00Z';

function month(
  m: number,
  year: number,
  transactions: HistoryTransaction[],
  opts: { checked?: boolean; lines?: HistoryMonth['budgetLines'] } = {},
): HistoryMonth {
  return {
    month: m,
    year,
    budgetLines: opts.lines ?? [
      {
        id: 'rent',
        kind: 'expense',
        amount: 1000,
        checkedAt: opts.checked === false ? null : CHECKED,
      },
    ],
    transactions,
  };
}

/** A free expense moves the landing by its full amount (no envelope absorbs it). */
const spend = (date: string, amount: number): HistoryTransaction => ({
  kind: 'expense',
  amount,
  budgetLineId: null,
  transactionDate: date,
});
/** A free income moves the landing up. */
const earn = (date: string, amount: number): HistoryTransaction => ({
  kind: 'income',
  amount,
  budgetLineId: null,
  transactionDate: date,
});

describe('isClosedMonth', () => {
  it('is closed once the period ended and every line is pointed', () => {
    expect(isClosedMonth(month(3, 2026, []), PAY_DAY, NOW)).toBe(true);
  });

  it('is open while a line is unpointed', () => {
    expect(
      isClosedMonth(month(3, 2026, [], { checked: false }), PAY_DAY, NOW),
    ).toBe(false);
  });

  it('is open while the period has not ended', () => {
    expect(isClosedMonth(month(8, 2026, []), PAY_DAY, NOW)).toBe(false);
  });
});

describe('monthDrift', () => {
  it('rate is end drift over planned outflows, profile the share reached per quarter', () => {
    // March: 31 days. Quarter cut-offs fall on days 8, 16, 23, 31.
    const drift = monthDrift(
      month(3, 2026, [spend('2026-03-05', 100), spend('2026-03-20', 300)]),
      PAY_DAY,
    );
    expect(drift.endDrift).toBe(-400);
    expect(drift.plannedOutflows).toBe(1000);
    expect(drift.rate).toBeCloseTo(-0.4);
    expect(drift.profile).toEqual([0.25, 0.25, 1, 1]);
    expect(drift.daily).toHaveLength(32);
    expect(drift.daily[0]).toBe(0);
  });

  it('a held month has rate 0 and no profile', () => {
    const drift = monthDrift(month(3, 2026, []), PAY_DAY);
    expect(drift.endDrift).toBe(0);
    expect(drift.rate).toBe(0);
    expect(drift.profile).toBeNull();
  });

  it('a month without planned outflow has no rate', () => {
    const drift = monthDrift(
      month(3, 2026, [spend('2026-03-05', 50)], {
        lines: [
          { id: 'pay', kind: 'income', amount: 5000, checkedAt: CHECKED },
        ],
      }),
      PAY_DAY,
    );
    expect(drift.endDrift).toBe(-50);
    expect(drift.rate).toBeNull();
  });
});

describe('driftHistory', () => {
  it('is null without a closed month', () => {
    expect(driftHistory([], PAY_DAY, NOW)).toBeNull();
    expect(
      driftHistory([month(3, 2026, [], { checked: false })], PAY_DAY, NOW),
    ).toBeNull();
  });

  it('median rate, MAD in CHF, profile non-decreasing ending at 1', () => {
    const history = driftHistory(
      [
        month(3, 2026, [spend('2026-03-10', 300)]),
        month(2, 2026, [spend('2026-02-10', 200)]),
        month(1, 2026, [spend('2026-01-10', 100)]),
        month(12, 2025, [], { checked: false }), // unpointed → excluded
      ],
      PAY_DAY,
      NOW,
    );
    expect(history).not.toBeNull();
    expect(history!.closedMonths).toBe(3);
    expect(history!.usualOutflowDrift).toBeCloseTo(-0.2);
    expect(history!.driftMad).toBe(100);
    expect(history!.driftProfile).toEqual([0, 1, 1, 1]);
    expect(history!.priorStrength).toBeGreaterThanOrEqual(PRIOR_STRENGTH_MIN);
    expect(history!.priorStrength).toBeLessThanOrEqual(PRIOR_STRENGTH_MAX);
  });

  it('alternating signs zero the usual drift', () => {
    const history = driftHistory(
      [
        month(4, 2026, [earn('2026-04-10', 500)]),
        month(3, 2026, [spend('2026-03-10', 500)]),
        month(2, 2026, [earn('2026-02-10', 400)]),
        month(1, 2026, [spend('2026-01-10', 450)]),
      ],
      PAY_DAY,
      NOW,
    );
    expect(history!.usualOutflowDrift).toBe(0);
    expect(history!.closedMonths).toBe(4);
  });

  it('a held month counts, contributes rate 0 and is skipped in the profile', () => {
    const history = driftHistory(
      [month(3, 2026, []), month(2, 2026, [spend('2026-02-20', 200)])],
      PAY_DAY,
      NOW,
    );
    expect(history!.closedMonths).toBe(2);
    expect(history!.usualOutflowDrift).toBeCloseTo(-0.1); // median(0, -0.2)
    expect(history!.driftProfile).toEqual([0, 0, 1, 1]); // February's alone
  });

  it('a month without planned outflow is excluded from the rate', () => {
    const history = driftHistory(
      [
        month(3, 2026, [spend('2026-03-05', 50)], {
          lines: [
            { id: 'pay', kind: 'income', amount: 5000, checkedAt: CHECKED },
          ],
        }),
        month(2, 2026, [spend('2026-02-10', 200)]),
      ],
      PAY_DAY,
      NOW,
    );
    expect(history!.closedMonths).toBe(2);
    expect(history!.usualOutflowDrift).toBeCloseTo(-0.2);
  });

  it('prior strength: regular months trust history (K max), noisy months trust the month (K min)', () => {
    // Same daily increments every month → nothing between months to explain → floor → K = 14.
    const regular = Array.from({ length: 6 }, (_, i) =>
      month(6 - i, 2026, [
        spend(`2026-0${6 - i}-10`, 100),
        spend(`2026-0${6 - i}-20`, 100),
      ]),
    );
    expect(driftHistory(regular, PAY_DAY, NOW)!.priorStrength).toBe(
      PRIOR_STRENGTH_MAX,
    );

    // Steady daily spending (tiny within-month noise) at very different levels per
    // month → the months genuinely differ → history is a weak prior → K = 3.
    const daily = (m: number, base: number) =>
      month(
        m,
        2026,
        Array.from({ length: 28 }, (_, d) =>
          spend(`2026-0${m}-${String(d + 1).padStart(2, '0')}`, base + (d % 2)),
        ),
      );
    const noisy = [daily(4, 100), daily(3, 1), daily(2, 100), daily(1, 1)];
    expect(driftHistory(noisy, PAY_DAY, NOW)!.priorStrength).toBe(
      PRIOR_STRENGTH_MIN,
    );
  });

  it('keeps the 12 most recent closed months', () => {
    const months = Array.from({ length: 14 }, (_, i) => {
      const m = ((5 - i + 24) % 12) + 1;
      const year = i <= 4 ? 2026 : 2025;
      return month(m, year, [
        spend(`${year}-${String(m).padStart(2, '0')}-10`, 100),
      ]);
    });
    expect(driftHistory(months, PAY_DAY, NOW)!.closedMonths).toBe(12);
  });
});
