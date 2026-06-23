import { describe, expect, it } from 'vitest';
import type { BudgetPeriod, SpreadOccurrence } from 'pulpe-shared';
import {
  buildSpreadOccurrenceViewModels,
  buildSpreadTracker,
  spreadOccurrenceRealizedAmount,
} from './spread-occurrence.view-model';

/**
 * PUL-17 — two distinct axes:
 *  - DISPLAY: isPast / isCurrent, relative to the VIEWED budget period.
 *  - REALIZATION: isClosed, relative to the LIVE current period (today). The
 *    réalisé cumulé counts occurrences that are closed OR checked, using their
 *    consumed (Σ sub-transactions) when any exist, else the prévu.
 */
function occurrence(
  overrides: Partial<SpreadOccurrence> & { month: number; year: number },
): SpreadOccurrence {
  return {
    budgetLineId: `bl-${overrides.year}-${overrides.month}`,
    budgetId: `b-${overrides.year}-${overrides.month}`,
    name: 'Assurance',
    amount: 120,
    consumed: 0,
    transactionCount: 0,
    kind: 'expense',
    checkedAt: null,
    ...overrides,
  };
}

describe('buildSpreadOccurrenceViewModels (PUL-17)', () => {
  const viewedJune: BudgetPeriod = { month: 6, year: 2026 };
  const liveJune: BudgetPeriod = { month: 6, year: 2026 };

  it('should flag occurrences before the viewed period as past', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026 }),
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(
      occurrences,
      viewedJune,
      liveJune,
    );

    expect(vms.find((v) => v.occurrence.month === 5)!.isPast).toBe(true);
    expect(vms.find((v) => v.occurrence.month === 6)!.isPast).toBe(false);
    expect(vms.find((v) => v.occurrence.month === 7)!.isPast).toBe(false);
  });

  it('should mark exactly the viewed period occurrence as current', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026 }),
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(
      occurrences,
      viewedJune,
      liveJune,
    );

    expect(vms.filter((v) => v.isCurrent)).toHaveLength(1);
    expect(vms.find((v) => v.isCurrent)!.occurrence.month).toBe(6);
  });

  it('should follow the viewed period when it changes (track viewed month, not now)', () => {
    const occurrences = [
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(
      occurrences,
      { month: 7, year: 2026 },
      liveJune,
    );

    expect(vms.find((v) => v.occurrence.month === 6)!.isPast).toBe(true);
    expect(vms.find((v) => v.occurrence.month === 7)!.isCurrent).toBe(true);
  });

  it('should compute isClosed relative to the LIVE period, independent of the viewed one', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026 }),
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];

    // Viewed = October (all three are isPast vs viewed) but live = June.
    const vms = buildSpreadOccurrenceViewModels(
      occurrences,
      { month: 10, year: 2026 },
      { month: 6, year: 2026 },
    );

    expect(vms.find((v) => v.occurrence.month === 5)!.isClosed).toBe(true);
    expect(vms.find((v) => v.occurrence.month === 6)!.isClosed).toBe(false);
    expect(vms.find((v) => v.occurrence.month === 7)!.isClosed).toBe(false);
    expect(vms.every((v) => v.isPast)).toBe(true);
  });

  it('should mark checked occurrences via checkedAt', () => {
    const occurrences = [
      occurrence({
        month: 5,
        year: 2026,
        checkedAt: '2026-05-10T00:00:00+02:00',
      }),
      occurrence({ month: 6, year: 2026, checkedAt: null }),
    ];

    const vms = buildSpreadOccurrenceViewModels(
      occurrences,
      viewedJune,
      liveJune,
    );

    expect(vms.find((v) => v.occurrence.month === 5)!.isChecked).toBe(true);
    expect(vms.find((v) => v.occurrence.month === 6)!.isChecked).toBe(false);
  });

  it('should sort occurrences chronologically', () => {
    const occurrences = [
      occurrence({ month: 7, year: 2026 }),
      occurrence({ month: 12, year: 2025 }),
      occurrence({ month: 3, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(
      occurrences,
      viewedJune,
      liveJune,
    );

    expect(
      vms.map((v) => `${v.occurrence.year}-${v.occurrence.month}`),
    ).toEqual(['2025-12', '2026-3', '2026-7']);
  });
});

describe('spreadOccurrenceRealizedAmount (PUL-17)', () => {
  const live: BudgetPeriod = { month: 6, year: 2026 };

  it('should use the prévu when the occurrence has no sub-transactions', () => {
    const [vm] = buildSpreadOccurrenceViewModels(
      [occurrence({ month: 6, year: 2026, amount: 120 })],
      live,
      live,
    );

    expect(spreadOccurrenceRealizedAmount(vm)).toBe(120);
  });

  it('should use the consumed (Σ sub-transactions) when transactions exist', () => {
    const [vm] = buildSpreadOccurrenceViewModels(
      [
        occurrence({
          month: 6,
          year: 2026,
          amount: 120,
          consumed: 95,
          transactionCount: 3,
        }),
      ],
      live,
      live,
    );

    expect(spreadOccurrenceRealizedAmount(vm)).toBe(95);
  });
});

describe('buildSpreadTracker (PUL-17 — réalisé)', () => {
  const viewed: BudgetPeriod = { month: 6, year: 2026 };

  it('should return null for an empty list', () => {
    expect(buildSpreadTracker([])).toBeNull();
  });

  it('should cumulate closed months with their prévu when they have no sub-transactions', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026, amount: 100 }),
      occurrence({ month: 6, year: 2026, amount: 100 }),
      occurrence({ month: 7, year: 2026, amount: 100 }),
    ];
    // live = July → May & June are closed; July is the live month (not closed).
    const vms = buildSpreadOccurrenceViewModels(occurrences, viewed, {
      month: 7,
      year: 2026,
    });

    const tracker = buildSpreadTracker(vms)!;

    expect(tracker.cumulatedAmount).toBe(200);
    expect(tracker.totalAmount).toBe(300);
  });

  it('should NOT cumulate a month that is neither closed nor checked', () => {
    const occurrences = [
      occurrence({ month: 6, year: 2026, amount: 100 }),
      occurrence({ month: 7, year: 2026, amount: 100 }),
    ];
    // live = June → nothing elapsed yet (June current, July future).
    const vms = buildSpreadOccurrenceViewModels(occurrences, viewed, {
      month: 6,
      year: 2026,
    });

    expect(buildSpreadTracker(vms)!.cumulatedAmount).toBe(0);
  });

  it('should cumulate a checked occurrence even when its month is not closed', () => {
    const occurrences = [
      occurrence({
        month: 6,
        year: 2026,
        amount: 100,
        checkedAt: '2026-06-02T00:00:00+02:00',
      }),
      occurrence({ month: 7, year: 2026, amount: 100 }),
    ];
    const vms = buildSpreadOccurrenceViewModels(occurrences, viewed, {
      month: 6,
      year: 2026,
    });

    expect(buildSpreadTracker(vms)!.cumulatedAmount).toBe(100);
  });

  it('should count the consumed (Σ sub-transactions) for realized months that have transactions', () => {
    const occurrences = [
      occurrence({
        month: 5,
        year: 2026,
        amount: 100,
        consumed: 80,
        transactionCount: 2,
      }),
      occurrence({ month: 6, year: 2026, amount: 100 }),
    ];
    // live = July → both closed; May counts 80 (consumed), June counts 100 (prévu).
    const vms = buildSpreadOccurrenceViewModels(occurrences, viewed, {
      month: 7,
      year: 2026,
    });

    expect(buildSpreadTracker(vms)!.cumulatedAmount).toBe(180);
  });

  it('should sum REAL closed amounts (rounding remainder), not currentIndex × perMonth', () => {
    // splitTotalPreserving(100, 3) → [33.34, 33.33, 33.33]. With May & June
    // closed (live = July), réalisé = 33.34 + 33.33 = 66.67, not 2 × 33.33.
    const occurrences = [
      occurrence({ month: 5, year: 2026, amount: 33.34 }),
      occurrence({ month: 6, year: 2026, amount: 33.33 }),
      occurrence({ month: 7, year: 2026, amount: 33.33 }),
    ];
    const vms = buildSpreadOccurrenceViewModels(occurrences, viewed, {
      month: 7,
      year: 2026,
    });

    const tracker = buildSpreadTracker(vms)!;

    expect(tracker.cumulatedAmount).toBeCloseTo(66.67, 2);
    expect(tracker.cumulatedAmount).not.toBeCloseTo(
      2 * tracker.perMonthAmount,
      2,
    );
  });

  it('should keep currentIndex as the viewed-month rank, independent of realization', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026 }),
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];
    // viewed = June (rank 2), live = January → nothing realized.
    const vms = buildSpreadOccurrenceViewModels(occurrences, viewed, {
      month: 1,
      year: 2026,
    });

    const tracker = buildSpreadTracker(vms)!;

    expect(tracker.currentIndex).toBe(2);
    expect(tracker.cumulatedAmount).toBe(0);
  });

  it('should use the viewed month amount as the representative perMonth', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026, amount: 33.34 }),
      occurrence({ month: 6, year: 2026, amount: 33.33 }),
      occurrence({ month: 7, year: 2026, amount: 33.33 }),
    ];
    const vms = buildSpreadOccurrenceViewModels(
      occurrences,
      { month: 5, year: 2026 },
      { month: 5, year: 2026 },
    );

    expect(buildSpreadTracker(vms)!.perMonthAmount).toBeCloseTo(33.34, 2);
  });
});
