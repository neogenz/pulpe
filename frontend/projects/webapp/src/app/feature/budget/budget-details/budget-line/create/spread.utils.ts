/**
 * Pure helpers for the "Lisser sur plusieurs mois" (PUL-17) entry flow.
 *
 * Interprétation B: the client enumerates the SELECTED months in the picked
 * range and the server receives concrete tranches `{year, month, amount}`.
 * The calculation lives 100% client-side — these helpers own the
 * range → months → selection mapping.
 */

export interface SpreadMonth {
  readonly year: number;
  readonly month: number;
}

export const MAX_SPREAD_MONTHS = 36;

export function monthKey({ year, month }: SpreadMonth): string {
  return `${year}-${month}`;
}

/**
 * Total inclusive month count between two periods (1 when start === end).
 * Returns a negative/zero value when `end` precedes `start` so callers can
 * surface a `fin < début` validation error.
 */
export function monthSpan(start: SpreadMonth, end: SpreadMonth): number {
  return (end.year - start.year) * 12 + (end.month - start.month) + 1;
}

/**
 * Enumerates every month in the inclusive `[start, end]` range, in order.
 * Returns an empty array when `end` precedes `start`.
 */
export function enumerateMonths(
  start: SpreadMonth,
  end: SpreadMonth,
): SpreadMonth[] {
  const span = monthSpan(start, end);
  if (span < 1) return [];

  const months: SpreadMonth[] = [];
  let year = start.year;
  let month = start.month;
  for (let i = 0; i < span; i++) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * Default "À" period: the start month plus a small horizon, clamped so the
 * range never exceeds {@link MAX_SPREAD_MONTHS}. Gives the user a sensible
 * pre-filled window they can then trim.
 */
export function defaultSpreadEnd(
  start: SpreadMonth,
  horizonMonths = 6,
): SpreadMonth {
  const offset = Math.min(horizonMonths, MAX_SPREAD_MONTHS) - 1;
  const zeroBased = start.month - 1 + offset;
  return {
    year: start.year + Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
  };
}
