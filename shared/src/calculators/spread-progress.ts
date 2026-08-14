/**
 * @fileoverview Progression d'un groupe de lissage — état d'affichage et suivi.
 *
 * MIROIR SWIFT : `ios/Pulpe/Domain/Formulas/SpreadProgress.swift`. Toute modif
 * ici se fait aussi là-bas, tests inclus, même commit
 * (voir `.claude/rules/00-architecture/formula-mirrors-ts-swift.md`).
 *
 * NOTE: L'import utilise l'extension .js (pas .ts) - exigence ESM Node.js
 */

import type { SpreadOccurrence } from '../../schemas.js';
import { compareBudgetPeriods, type BudgetPeriod } from './budget-period.js';

const PERCENT = 100;

export interface SpreadOccurrenceItem {
  occurrence: SpreadOccurrence;
  /** Behind the month being lived in — nothing more will be booked there. */
  isPast: boolean;
  /** The month the sheet was opened from. */
  isViewed: boolean;
  isBeforeViewed: boolean;
  isChecked: boolean;
}

export interface SpreadTracker {
  count: number;
  currentIndex: number;
  cumulatedAmount: number;
  totalAmount: number;
  perMonthAmount: number;
  progressPercent: number;
  remainingToProvision: number;
  perRemainingMonth: number | null;
}

/**
 * Display state and progress for a spread group, derived here rather than
 * stored: the server returns raw `{month, year}` precisely so the client can
 * decide past/current against the pay-day cycle, which a frozen flag would get
 * wrong on a short cache.
 */
export function spreadOccurrenceItems(
  occurrences: readonly SpreadOccurrence[],
  viewedPeriod: BudgetPeriod,
  livePeriod: BudgetPeriod,
): SpreadOccurrenceItem[] {
  return occurrences
    .map((occurrence) => {
      const period: BudgetPeriod = {
        month: occurrence.month,
        year: occurrence.year,
      };
      const viewedComparison = compareBudgetPeriods(period, viewedPeriod);
      return {
        occurrence,
        isPast: compareBudgetPeriods(period, livePeriod) < 0,
        isViewed: viewedComparison === 0,
        isBeforeViewed: viewedComparison < 0,
        isChecked: occurrence.checkedAt !== null,
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
 * What a month really cost: the sum of its own operations once any exist, and
 * the tranche it planned otherwise.
 */
export function spreadRealizedAmount(item: SpreadOccurrenceItem): number {
  return item.occurrence.transactionCount > 0
    ? item.occurrence.consumed
    : item.occurrence.amount;
}

/**
 * The catch-up, stated rather than left to be worked out: what is still to be
 * put aside, and what that comes to per month still open. A month already
 * behind or pointed counts as done, so it is never both in the total and in the
 * divisor.
 */
export function spreadTracker(
  items: readonly SpreadOccurrenceItem[],
): SpreadTracker | null {
  if (items.length === 0) return null;

  const currentIndex = items.reduce(
    (rank, item, index) =>
      item.isBeforeViewed || item.isViewed ? index + 1 : rank,
    0,
  );
  const isRealized = (item: SpreadOccurrenceItem) =>
    item.isPast || item.isChecked;
  const cumulatedAmount = items
    .filter(isRealized)
    .reduce((sum, item) => sum + spreadRealizedAmount(item), 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + item.occurrence.amount,
    0,
  );
  const perMonthAmount =
    items.find((item) => item.isViewed)?.occurrence.amount ??
    items.at(-1)?.occurrence.amount ??
    0;
  const progressPercent =
    totalAmount > 0
      ? Math.min(
          PERCENT,
          Math.max(0, (cumulatedAmount / totalAmount) * PERCENT),
        )
      : 0;
  const remainingToProvision = Math.max(0, totalAmount - cumulatedAmount);
  const openMonths = items.filter((item) => !isRealized(item)).length;

  return {
    count: items.length,
    currentIndex,
    cumulatedAmount,
    totalAmount,
    perMonthAmount,
    progressPercent,
    remainingToProvision,
    perRemainingMonth:
      remainingToProvision > 0 && openMonths > 0
        ? remainingToProvision / openMonths
        : null,
  };
}
