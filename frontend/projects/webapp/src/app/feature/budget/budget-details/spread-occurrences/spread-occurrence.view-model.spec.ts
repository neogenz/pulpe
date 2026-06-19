import { describe, expect, it } from 'vitest';
import type { SpreadOccurrence } from 'pulpe-shared';
import { buildSpreadOccurrenceViewModels } from './spread-occurrence.view-model';

/**
 * PUL-17 Lot C — past/current/checked computation for spread occurrences.
 * Past + current MUST be payDay-aware (via compareBudgetPeriods +
 * getBudgetPeriodForDate), NOT a naive calendar isBefore.
 */
function occurrence(
  overrides: Partial<SpreadOccurrence> & { month: number; year: number },
): SpreadOccurrence {
  return {
    budgetLineId: `bl-${overrides.year}-${overrides.month}`,
    budgetId: `b-${overrides.year}-${overrides.month}`,
    name: 'Assurance',
    amount: 120,
    kind: 'expense',
    checkedAt: null,
    ...overrides,
  };
}

describe('buildSpreadOccurrenceViewModels (PUL-17 Lot C)', () => {
  const now = new Date(2026, 5, 15); // 2026-06-15

  it('should flag occurrences before the current period as past (payDay=1 calendar)', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026 }),
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(occurrences, 1, now);

    const may = vms.find((v) => v.occurrence.month === 5)!;
    const june = vms.find((v) => v.occurrence.month === 6)!;
    const july = vms.find((v) => v.occurrence.month === 7)!;

    expect(may.isPast).toBe(true);
    expect(june.isPast).toBe(false);
    expect(july.isPast).toBe(false);
  });

  it('should mark exactly the current period occurrence as current', () => {
    const occurrences = [
      occurrence({ month: 5, year: 2026 }),
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(occurrences, 1, now);

    expect(vms.filter((v) => v.isCurrent)).toHaveLength(1);
    expect(vms.find((v) => v.isCurrent)!.occurrence.month).toBe(6);
  });

  it('should be payDay-aware: a late-month date with payDay=27 belongs to the NEXT period', () => {
    // 2026-06-28 with payDay 27 → current budget period is July 2026.
    const lateJune = new Date(2026, 5, 28);
    const occurrences = [
      occurrence({ month: 6, year: 2026 }),
      occurrence({ month: 7, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(occurrences, 27, lateJune);

    const june = vms.find((v) => v.occurrence.month === 6)!;
    const july = vms.find((v) => v.occurrence.month === 7)!;

    // Naive calendar isBefore would call June "current" and July "future";
    // payDay-aware logic makes June PAST and July CURRENT.
    expect(june.isPast).toBe(true);
    expect(june.isCurrent).toBe(false);
    expect(july.isCurrent).toBe(true);
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

    const vms = buildSpreadOccurrenceViewModels(occurrences, 1, now);

    const may = vms.find((v) => v.occurrence.month === 5)!;
    const june = vms.find((v) => v.occurrence.month === 6)!;

    expect(may.isChecked).toBe(true);
    expect(june.isChecked).toBe(false);
  });

  it('should compose past + checked on the same occurrence', () => {
    const occurrences = [
      occurrence({
        month: 5,
        year: 2026,
        checkedAt: '2026-05-10T00:00:00+02:00',
      }),
    ];

    const vms = buildSpreadOccurrenceViewModels(occurrences, 1, now);

    expect(vms[0].isPast).toBe(true);
    expect(vms[0].isChecked).toBe(true);
  });

  it('should sort occurrences chronologically', () => {
    const occurrences = [
      occurrence({ month: 7, year: 2026 }),
      occurrence({ month: 12, year: 2025 }),
      occurrence({ month: 3, year: 2026 }),
    ];

    const vms = buildSpreadOccurrenceViewModels(occurrences, 1, now);

    expect(
      vms.map((v) => `${v.occurrence.year}-${v.occurrence.month}`),
    ).toEqual(['2025-12', '2026-3', '2026-7']);
  });
});
