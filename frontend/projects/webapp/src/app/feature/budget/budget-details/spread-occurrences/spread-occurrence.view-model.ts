import {
  type BudgetPeriod,
  type SpreadOccurrence,
  compareBudgetPeriods,
} from 'pulpe-shared';
import type {
  SpreadOccurrenceViewModel,
  SpreadTracker,
} from '@ui/spread-occurrences-list';

/**
 * PUL-17 Lot C / v1.1 — display metadata + progress for a spread group, computed
 * CLIENT-SIDE (no new storage). The DOMAIN logic (these builders) stays in
 * `feature/`; the INTERFACES `SpreadOccurrenceViewModel` / `SpreadTracker` live
 * in the `ui/` component (`@ui/spread-occurrences-list`) so the pure
 * presentational list can consume them without a `ui/ → feature/` import.
 */
export type { SpreadOccurrenceViewModel, SpreadTracker };

/**
 * Builds payDay-aware display state against the LIVE period while keeping the
 * VIEWED period as an independent tracker/marker axis.
 */
export function buildSpreadOccurrenceViewModels(
  occurrences: readonly SpreadOccurrence[],
  referencePeriod: BudgetPeriod,
  livePeriod: BudgetPeriod,
): SpreadOccurrenceViewModel[] {
  return occurrences
    .map((occurrence) => {
      const period: BudgetPeriod = {
        month: occurrence.month,
        year: occurrence.year,
      };
      const viewedComparison = compareBudgetPeriods(period, referencePeriod);
      const liveComparison = compareBudgetPeriods(period, livePeriod);
      return {
        occurrence,
        isPast: liveComparison < 0,
        isViewed: viewedComparison === 0,
        isBeforeViewed: viewedComparison < 0,
        isChecked: occurrence.checkedAt != null,
        isClosed: liveComparison < 0,
      };
    })
    .toSorted((a, b) =>
      compareBudgetPeriods(
        { month: a.occurrence.month, year: a.occurrence.year },
        { month: b.occurrence.month, year: b.occurrence.year },
      ),
    );
}

/**
 * Realized amount of a single occurrence: the real consumed (Σ of its
 * sub-transactions) when any exist, else the prévu (planned tranche). This is
 * what a realized month contributes to the tracker's cumulé.
 */
export function spreadOccurrenceRealizedAmount(
  vm: SpreadOccurrenceViewModel,
): number {
  return vm.occurrence.transactionCount > 0
    ? vm.occurrence.consumed
    : vm.occurrence.amount;
}

/**
 * Derives the progress tracker from the view-models. All fields are pure
 * functions of the occurrence list (see {@link SpreadTracker}):
 *
 * - `currentIndex`    = 1-based rank of the VIEWED month among the occurrences
 *                       (count of `isBeforeViewed || isViewed`). 0 when the viewed
 *                       month precedes every occurrence (plan not started here).
 *                       Position indicator only — independent of realization.
 * - `cumulatedAmount` = RÉALISÉ: Σ over REALIZED occurrences (`isClosed ||
 *                       isChecked`) of {@link spreadOccurrenceRealizedAmount}
 *                       (consumed if sub-transactions, else prévu). Reflects
 *                       what actually happened, not calendar position.
 * - `totalAmount`     = Σ of ALL occurrence amounts (Σ = the source total T).
 * - `perMonthAmount`  = representative tranche (viewed month's amount, else the
 *                       last/base split value).
 * - `progressPercent` = realized / total, clamped to [0, 100].
 */
export function buildSpreadTracker(
  viewModels: readonly SpreadOccurrenceViewModel[],
): SpreadTracker | null {
  const count = viewModels.length;
  if (count === 0) return null;

  const currentIndex = viewModels.reduce(
    (rank, vm, index) => (vm.isBeforeViewed || vm.isViewed ? index + 1 : rank),
    0,
  );

  const cumulatedAmount = viewModels
    .filter((vm) => vm.isClosed || vm.isChecked)
    .reduce((sum, vm) => sum + spreadOccurrenceRealizedAmount(vm), 0);

  const totalAmount = viewModels.reduce(
    (sum, vm) => sum + vm.occurrence.amount,
    0,
  );

  const representative =
    viewModels.find((vm) => vm.isViewed)?.occurrence.amount ??
    viewModels.at(-1)?.occurrence.amount ??
    0;

  const progressPercent =
    totalAmount > 0
      ? Math.min(100, Math.max(0, (cumulatedAmount / totalAmount) * 100))
      : 0;

  return {
    count,
    currentIndex,
    cumulatedAmount,
    totalAmount,
    perMonthAmount: representative,
    progressPercent,
  };
}
