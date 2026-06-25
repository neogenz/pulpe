import { splitTotalPreserving } from 'pulpe-shared';
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

/**
 * Total-mode tranche builder (PUL-17 dual-mode create, total branch).
 *
 * The client types the WHOLE amount to smooth (`totalAmount`) and picks N months;
 * the server DIVIDES it here, cents-preserving, via `splitTotalPreserving`
 * (Σ tranches === `totalAmount` exactly, the rounding remainder landing on the
 * first months). In full-FX the original total is split the same way so
 * Σ originals === `totalOriginalAmount`; the single frozen rate (RG-009) stays
 * flat on the fan-out input, not per tranche. Input order is preserved.
 *
 * Pure — no I/O. Empty `months` yields `[]`.
 */
export function buildSpreadTranchesFromTotal(
  totalAmount: number,
  months: { year: number; month: number }[],
  totalOriginalAmount?: number | null,
): SpreadTranche[] {
  if (months.length === 0) return [];
  const amounts = splitTotalPreserving(totalAmount, months.length);
  const originalAmounts =
    totalOriginalAmount != null
      ? splitTotalPreserving(totalOriginalAmount, months.length)
      : null;
  return months.map((period, index) => ({
    year: period.year,
    month: period.month,
    amount: amounts[index],
    originalAmount: originalAmounts ? originalAmounts[index] : null,
  }));
}
