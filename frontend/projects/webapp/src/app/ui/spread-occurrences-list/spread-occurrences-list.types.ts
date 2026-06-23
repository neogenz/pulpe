import type { SpreadOccurrence } from 'pulpe-shared';

/**
 * PUL-17 Lot C — display metadata for one spread occurrence, computed CLIENT-SIDE
 * by the feature-layer builder (`buildSpreadOccurrenceViewModels`).
 *
 * Lives in the `ui/` layer (not `feature/`) so the pure presentational
 * `SpreadOccurrencesList` can consume it without a `ui/ → feature/` import
 * (forbidden by layer rules). The feature view-model file imports these
 * interfaces from here; the BUILDERS (domain logic) stay in `feature/`.
 *
 * `isPast` / `isCurrent` are payDay-aware (computed relative to the VIEWED budget
 * period) and drive DISPLAY (dimming, "Ici" badge). `isChecked` mirrors
 * `checkedAt`. `isClosed` is the REALIZATION axis: payDay-aware relative to the
 * LIVE current period (today), so a month genuinely past — independent of which
 * month you're viewing. Display (`isPast`) and realization (`isClosed`) are
 * distinct: you can view a future month (its past occurrences are `isPast`) yet
 * only the truly-elapsed ones are `isClosed`.
 */
export interface SpreadOccurrenceViewModel {
  readonly occurrence: SpreadOccurrence;
  readonly isPast: boolean;
  readonly isCurrent: boolean;
  readonly isChecked: boolean;
  readonly isClosed: boolean;
}

/**
 * PUL-17 v1.1 — derived progress of a smoothed expense, computed CLIENT-SIDE
 * (no new storage). All fields are pure functions of the occurrence list.
 *
 * - `count`           = number of occurrences (N months).
 * - `currentIndex`    = 1-based rank of the VIEWED month among the occurrences.
 *                       0 when the viewed period precedes every occurrence
 *                       (the plan has not started yet for this budget).
 * - `cumulatedAmount` = RÉALISÉ: Σ over REALIZED occurrences (month closed OR
 *                       pointée) of their realized amount (Σ sub-transactions if
 *                       any, else the prévu). Reflects what's actually happened,
 *                       not calendar position — NOT `index × perMonth`.
 * - `totalAmount`     = Σ of ALL occurrence amounts (Σ = the source total T).
 * - `perMonthAmount`  = representative tranche (viewed month's amount, else the
 *                       last/base split value), for the "{{ perMonth }} par
 *                       mois" line.
 * - `progressPercent` = cumulated / total, clamped to [0, 100].
 */
export interface SpreadTracker {
  readonly count: number;
  readonly currentIndex: number;
  readonly cumulatedAmount: number;
  readonly totalAmount: number;
  readonly perMonthAmount: number;
  readonly progressPercent: number;
}
