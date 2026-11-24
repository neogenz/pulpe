import type {
  AssetDirection,
  SupportedCurrency,
  TransactionKind,
} from 'pulpe-shared';
import type {
  AssetCategory,
  AssetWithValue,
  CheckedLinesCutoff,
  CheckedLinkedLine,
  NetWorth,
} from './asset.entity';

const CENTS_PER_UNIT = 100;

export interface NetWorthInput {
  baseCurrency: SupportedCurrency;
  categories: AssetCategory[];
  /** Every asset, archived ones included, with its last entry. */
  assets: AssetWithValue[];
  /**
   * Today's rate per foreign currency: how many `baseCurrency` one unit of it
   * is worth. A missing entry means no rate could be obtained.
   */
  rates: Partial<Record<SupportedCurrency, number>>;
  /**
   * Checked prévisions linked to an active asset, already restricted to those
   * checked after that asset's last entry (`checkedLinesCutoffs`). Amounts are
   * in `baseCurrency`.
   */
  checkedLines: CheckedLinkedLine[];
}

/**
 * The only place net-worth money is computed. Every figure is rounded to the
 * cent; sums run on integer cents so they do not drift.
 *
 * The value of an asset is its last entry plus what was checked since. An
 * archived asset, or one without a rate, keeps its last entry.
 *
 * Active assets only count in the totals. A positive `own` value goes to its
 * category `total` and to `gross`; a negative `own` value (overdraft) and an
 * `owe` value go to `debts`. An asset with no rate keeps `convertedValue: null`
 * and stays out of the totals, which then carry `incomplete`.
 */
export function computeNetWorth(input: NetWorthInput): NetWorth {
  const { baseCurrency, categories, assets, rates, checkedLines } = input;
  const categoryCents = new Map(categories.map((c) => [c.id, 0]));
  let grossCents = 0;
  let debtsCents = 0;
  let incomplete = false;

  const valuedAssets = assets.map((asset) => {
    const rate = asset.currency === baseCurrency ? 1 : rates[asset.currency];
    if (rate === undefined) {
      incomplete ||= asset.archivedAt === null;
      return { ...asset, value: asset.recordedValue, convertedValue: null };
    }

    const valueCents = assetValueCents(asset, checkedLines, rate);
    const cents = Math.round(valueCents * rate);
    if (asset.archivedAt === null) {
      if (asset.direction === 'own' && cents >= 0) {
        grossCents += cents;
        categoryCents.set(
          asset.categoryId,
          (categoryCents.get(asset.categoryId) ?? 0) + cents,
        );
      } else {
        debtsCents += Math.abs(cents);
      }
    }
    return {
      ...asset,
      value: toUnits(valueCents),
      convertedValue: toUnits(cents),
    };
  });

  return {
    totals: {
      baseCurrency,
      gross: toUnits(grossCents),
      debts: toUnits(debtsCents),
      net: toUnits(grossCents - debtsCents),
      incomplete,
    },
    categories: categories.map((category) => ({
      ...category,
      total: toUnits(categoryCents.get(category.id) ?? 0),
    })),
    assets: valuedAssets,
  };
}

/**
 * For each active asset, the instant after which a checked prévision moves its
 * value: its last entry, which already holds what was checked before. An
 * archived asset keeps its last entry, so it has no cutoff.
 */
export function checkedLinesCutoffs(
  assets: AssetWithValue[],
): CheckedLinesCutoff[] {
  return assets
    .filter((asset) => asset.archivedAt === null)
    .map(({ id, latestRecordedAt }) => ({
      assetId: id,
      since: latestRecordedAt,
    }));
}

/**
 * How a checked prévision moves the value of an asset: an Épargne adds to what
 * I own, a Revenu drawn from it subtracts, a Dépense repays what I owe. Any
 * other pairing (the database refuses to link them) moves nothing.
 */
function movementSign(direction: AssetDirection, kind: TransactionKind) {
  if (direction === 'own') {
    return kind === 'saving' ? 1 : kind === 'income' ? -1 : 0;
  }
  return kind === 'expense' ? -1 : 0;
}

/**
 * The value of an asset in its own currency, in cents: its last entry plus its
 * `lines`, each converted from base currency at `rate`. A debt takes them in
 * the order they were checked and never goes below zero: each movement only
 * counts for what remains due at that moment. An archived asset keeps its last
 * entry.
 */
function assetValueCents(
  asset: AssetWithValue,
  lines: CheckedLinkedLine[],
  rate: number,
): number {
  const recordedCents = Math.round(asset.recordedValue * CENTS_PER_UNIT);
  if (asset.archivedAt !== null) return recordedCents;

  return lines
    .filter((line) => line.assetId === asset.id)
    .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt))
    .reduce((valueCents, line) => {
      const movedCents =
        movementSign(asset.direction, line.kind) *
        Math.round((line.amount * CENTS_PER_UNIT) / rate);
      const next = valueCents + movedCents;
      return asset.direction === 'owe' ? Math.max(0, next) : next;
    }, recordedCents);
}

function toUnits(cents: number): number {
  return cents === 0 ? 0 : cents / CENTS_PER_UNIT;
}
