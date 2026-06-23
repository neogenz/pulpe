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
 * Builds the per-occurrence view-models relative to the VIEWED budget period.
 *
 * `isPast` / `isCurrent` are computed against `referencePeriod` (the month the
 * user is currently looking at) via `compareBudgetPeriods` — NOT against `now`.
 * This means the tracker reflects the position of the VIEWED month inside the
 * spread, not where the live calendar clock is. The viewed budget's
 * `month`/`year` ARE the budget-period label (already payDay-resolved upstream).
 */
export function buildSpreadOccurrenceViewModels(
  occurrences: readonly SpreadOccurrence[],
  referencePeriod: BudgetPeriod,
  livePeriod: BudgetPeriod,
): SpreadOccurrenceViewModel[] {
  return [...occurrences]
    .map((occurrence) => {
      const period: BudgetPeriod = {
        month: occurrence.month,
        year: occurrence.year,
      };
      const comparison = compareBudgetPeriods(period, referencePeriod);
      return {
        occurrence,
        isPast: comparison < 0,
        isCurrent: comparison === 0,
        isChecked: occurrence.checkedAt != null,
        // Realization axis: closed = strictly before TODAY's live period (≠ the
        // viewed reference). A month is "clôturé" once it has truly elapsed.
        isClosed: compareBudgetPeriods(period, livePeriod) < 0,
      };
    })
    .sort((a, b) =>
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
 *                       (count of `isPast || isCurrent`). 0 when the viewed
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
    (rank, vm, index) => (vm.isPast || vm.isCurrent ? index + 1 : rank),
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
    viewModels.find((vm) => vm.isCurrent)?.occurrence.amount ??
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
