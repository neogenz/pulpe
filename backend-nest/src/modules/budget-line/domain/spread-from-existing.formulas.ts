import { splitTotalPreserving, type SupportedCurrency } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { SpreadTranche } from './ports/budget-line-spread.port';

const MONTHS_PER_YEAR = 12;

export interface SpreadSource {
  /** Source's own period — must be the earliest target (M0), never rewritten before. */
  month: number;
  year: number;
  /** Decrypted total to redistribute (Σ tranches === total). */
  amount: number;
  /** Frozen FX original total, split the same way when FX is present. */
  originalAmount: number | null;
  originalCurrency: SupportedCurrency | null;
  targetCurrency: SupportedCurrency | null;
  exchangeRate: number | null;
}

export interface SpreadFromExistingPlan {
  tranches: SpreadTranche[];
  originalCurrency: SupportedCurrency | null;
  targetCurrency: SupportedCurrency | null;
  exchangeRate: number | null;
}

const toOrdinal = (period: { year: number; month: number }): number =>
  period.year * MONTHS_PER_YEAR + period.month;

/**
 * Total-preserving redistribution plan (PUL-17 v1.1). Validates the requested
 * periods (must include the source's own period M0; reject any period strictly
 * before M0 — forward-only, never rewrite a closed month), dedupes + sorts
 * ascending, then splits the source total via `splitTotalPreserving` so Σ === T
 * to the cent (remainder on the earliest months, M0 first). When the source
 * carries frozen FX, the original total is split the same way and the rate is
 * inherited on every tranche.
 *
 * Pure — no I/O. The caller owns provisioning, fan-out and source deletion.
 */
export function buildSpreadFromExistingPlan(
  source: SpreadSource,
  periods: { year: number; month: number }[],
): SpreadFromExistingPlan {
  const sortedPeriods = dedupeAndSort(periods);
  const m0Ordinal = toOrdinal(source);

  // Check the past-period guard first: when the user selects only past months,
  // both conditions hold, and "cannot smooth into a past month" is the
  // diagnostic error — it names the actual mistake, not the missing-M0 symptom.
  const hasPastPeriod = sortedPeriods.some(
    (period) => toOrdinal(period) < m0Ordinal,
  );
  if (hasPastPeriod) {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
      {
        reason: `cannot smooth into a month before the source month ${source.month}/${source.year}`,
      },
    );
  }

  const includesM0 = sortedPeriods.some(
    (period) => toOrdinal(period) === m0Ordinal,
  );
  if (!includesM0) {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
      {
        reason: `the smoothing window must include the source month ${source.month}/${source.year}`,
      },
    );
  }

  const amounts = splitTotalPreserving(source.amount, sortedPeriods.length);
  const originalAmounts =
    source.originalAmount !== null
      ? splitTotalPreserving(source.originalAmount, sortedPeriods.length)
      : null;

  const tranches: SpreadTranche[] = sortedPeriods.map((period, index) => ({
    year: period.year,
    month: period.month,
    amount: amounts[index],
    originalAmount: originalAmounts ? originalAmounts[index] : null,
  }));

  return {
    tranches,
    originalCurrency: source.originalCurrency,
    targetCurrency: source.targetCurrency,
    exchangeRate: source.exchangeRate,
  };
}

function dedupeAndSort(
  periods: { year: number; month: number }[],
): { year: number; month: number }[] {
  const seen = new Set<number>();
  const unique: { year: number; month: number }[] = [];
  for (const period of periods) {
    const ordinal = toOrdinal(period);
    if (seen.has(ordinal)) continue;
    seen.add(ordinal);
    unique.push({ year: period.year, month: period.month });
  }
  return unique.sort((a, b) => toOrdinal(a) - toOrdinal(b));
}
