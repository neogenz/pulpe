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
 * `isPast` and `isClosed` share today's formula (occurrence period strictly before
 * the LIVE current period, payDay-aware) but are kept SEPARATE on purpose: `isPast`
 * is PRESENTATION (greys out the row), `isClosed` is the DOMAIN signal that an
 * occurrence is realized and counts toward the RÉALISÉ sum (`buildSpreadTracker`
 * filters on `isClosed || isChecked`). Collapsing them would couple the realized
 * aggregation to a display flag — keep distinct so either can evolve without
 * silently moving the totals.
 * `isViewed` marks the VIEWED budget month (the "Ici" badge), while
 * `isBeforeViewed` preserves its position for the tracker independently from
 * the live clock. `isChecked` mirrors `checkedAt`.
 */
export interface SpreadOccurrenceViewModel {
  readonly occurrence: SpreadOccurrence;
  /** Presentation only: grey out an occurrence whose month is past. */
  readonly isPast: boolean;
  readonly isViewed: boolean;
  readonly isBeforeViewed: boolean;
  readonly isChecked: boolean;
  /** Domain: occurrence is realized (closed month) → counts in the RÉALISÉ sum. */
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
 *                       last/base split value). No longer rendered: PUL-290
 *                       replaced the static "par mois" line with the
 *                       forward-looking `perRemainingMonth`. Retained as the
 *                       derived base split value (still locked by its spec).
 * - `progressPercent` = cumulated / total, clamped to [0, 100].
 *
 * PUL-290 — explicit catch-up so the user never does the mental math:
 * - `remainingToProvision` = objectif − provisionné, clamped to ≥ 0
 *                       (`max(0, totalAmount − cumulatedAmount)`). 0 ⇒ objectif
 *                       atteint.
 * - `perRemainingMonth` = `remainingToProvision` ÷ the number of months still
 *                       open (occurrences NOT closed and NOT pointée), or `null`
 *                       when nothing is left to provision OR no open month
 *                       remains (no division by zero, no negative catch-up).
 */
export interface SpreadTracker {
  readonly count: number;
  readonly currentIndex: number;
  readonly cumulatedAmount: number;
  readonly totalAmount: number;
  readonly perMonthAmount: number;
  readonly progressPercent: number;
  readonly remainingToProvision: number;
  readonly perRemainingMonth: number | null;
}
