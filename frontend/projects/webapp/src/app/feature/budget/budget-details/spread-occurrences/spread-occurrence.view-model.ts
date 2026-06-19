import {
  type BudgetPeriod,
  type SpreadOccurrence,
  compareBudgetPeriods,
  getBudgetPeriodForDate,
} from 'pulpe-shared';

/**
 * PUL-17 Lot C — display metadata for one spread occurrence, computed CLIENT-SIDE.
 *
 * `isPast` / `isCurrent` are payDay-aware via `getBudgetPeriodForDate` +
 * `compareBudgetPeriods` — NEVER a naive calendar `isBefore` (which ignores the
 * user's pay-day window). `isChecked` mirrors `checkedAt`. The two states
 * compose: a past + checked occurrence is dimmed AND struck-through.
 */
export interface SpreadOccurrenceViewModel {
  readonly occurrence: SpreadOccurrence;
  readonly isPast: boolean;
  readonly isCurrent: boolean;
  readonly isChecked: boolean;
}

export function buildSpreadOccurrenceViewModels(
  occurrences: readonly SpreadOccurrence[],
  payDayOfMonth: number | null,
  now: Date = new Date(),
): SpreadOccurrenceViewModel[] {
  const currentPeriod = getBudgetPeriodForDate(now, payDayOfMonth);

  return [...occurrences]
    .map((occurrence) => {
      const period: BudgetPeriod = {
        month: occurrence.month,
        year: occurrence.year,
      };
      const comparison = compareBudgetPeriods(period, currentPeriod);
      return {
        occurrence,
        isPast: comparison < 0,
        isCurrent: comparison === 0,
        isChecked: occurrence.checkedAt != null,
      };
    })
    .sort((a, b) =>
      compareBudgetPeriods(
        { month: a.occurrence.month, year: a.occurrence.year },
        { month: b.occurrence.month, year: b.occurrence.year },
      ),
    );
}
