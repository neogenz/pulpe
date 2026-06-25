import type { SpreadTranche } from './ports/budget-line-spread.port';

/**
 * Additive-spread tranche builder (PUL-287, server-side build).
 *
 * Interpretation B — PURE replication, NO division/redistribution: every target
 * month receives exactly `perMonthAmount` (and the single `perMonthOriginalAmount`
 * in full-FX, replicated unchanged). The client sends the INTENT
 * ({perMonthAmount, months}); the server materializes one tranche per month here
 * before the fan-out. Input order is preserved — no sort, no dedupe (the schema
 * already rejects duplicate periods).
 *
 * Pure — no I/O. FX currencies/rate stay flat on the fan-out input, not per tranche.
 */
export function buildSpreadTranches(
  perMonthAmount: number,
  months: { year: number; month: number }[],
  perMonthOriginalAmount?: number | null,
): SpreadTranche[] {
  return months.map((period) => ({
    year: period.year,
    month: period.month,
    amount: perMonthAmount,
    originalAmount: perMonthOriginalAmount ?? null,
  }));
}
