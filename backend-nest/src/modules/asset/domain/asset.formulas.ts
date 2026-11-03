import type {
  AssetDirection,
  SupportedCurrency,
  TransactionKind,
} from 'pulpe-shared';
import type {
  AssetCategory,
  AssetSuggestion,
  AssetWithValue,
  CheckedLinesCutoff,
  CheckedLinkedLine,
  NetWorth,
} from './asset.entity';

const CENTS_PER_UNIT = 100;

export interface NetWorthInput {
  baseCurrency: SupportedCurrency;
  categories: AssetCategory[];
  /** Every asset, archived ones included, valued in its own currency. */
  assets: AssetWithValue[];
  /**
   * Today's rate per foreign currency: how many `baseCurrency` one unit of it
   * is worth. A missing entry means no rate could be obtained.
   */
  rates: Partial<Record<SupportedCurrency, number>>;
  /**
   * Checked prévisions linked to an active asset, already restricted to those
   * checked after that asset's cutoff (`checkedLinesCutoffs`). Amounts are in
   * `baseCurrency`.
   */
  checkedLines: CheckedLinkedLine[];
}

/**
 * The only place net-worth money is computed. Every figure is rounded to the
 * cent; sums run on integer cents so they do not drift.
 *
 * Active assets only count in the totals. A positive `own` value goes to its
 * category `total` and to `gross`; a negative `own` value (overdraft) and an
 * `owe` value go to `debts`. An asset with no rate keeps `convertedValue: null`
 * and stays out of the totals, which then carry `incomplete`.
 *
 * Each active asset also carries the value its `checkedLines` propose.
 */
export function computeNetWorth(input: NetWorthInput): NetWorth {
  const { baseCurrency, categories, assets, rates, checkedLines } = input;
  const categoryCents = new Map(categories.map((c) => [c.id, 0]));
  let grossCents = 0;
  let debtsCents = 0;
  let incomplete = false;

  const valuedAssets = assets.map((asset) => {
    const rate = asset.currency === baseCurrency ? 1 : rates[asset.currency];
    const suggestion = computeAssetSuggestion(asset, checkedLines, rate);
    if (rate === undefined) {
      incomplete ||= asset.archivedAt === null;
      return { ...asset, convertedValue: null, suggestion };
    }

    const cents = Math.round(asset.latestValue * rate * CENTS_PER_UNIT);
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
    return { ...asset, convertedValue: toUnits(cents), suggestion };
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
 * For each active asset, the instant after which a checked prévision still
 * counts: the later of its latest snapshot (the value already includes what
 * was checked before) and its last dismissal (a dismissed movement is
 * forgotten). An archived asset carries no suggestion, so it has no cutoff.
 */
export function checkedLinesCutoffs(
  assets: AssetWithValue[],
): CheckedLinesCutoff[] {
  return assets
    .filter((asset) => asset.archivedAt === null)
    .map(({ id, latestRecordedAt, suggestionDismissedAt }) => ({
      assetId: id,
      since:
        suggestionDismissedAt !== null &&
        Date.parse(suggestionDismissedAt) > Date.parse(latestRecordedAt)
          ? suggestionDismissedAt
          : latestRecordedAt,
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
 * The value `lines` propose for an active asset, in its own currency. `rate` is
 * how many base currency one unit of the asset currency is worth; the lines
 * are in base currency, so no rate means no suggestion. A debt never goes below
 * zero. `null` when nothing moves the value.
 */
function computeAssetSuggestion(
  asset: AssetWithValue,
  lines: CheckedLinkedLine[],
  rate: number | undefined,
): AssetSuggestion | null {
  if (asset.archivedAt !== null || rate === undefined) return null;

  const movedBaseCents = lines
    .filter((line) => line.assetId === asset.id)
    .reduce(
      (sum, line) =>
        sum +
        movementSign(asset.direction, line.kind) *
          Math.round(line.amount * CENTS_PER_UNIT),
      0,
    );
  const valueCents = Math.round(asset.latestValue * CENTS_PER_UNIT);
  const movedValueCents = valueCents + Math.round(movedBaseCents / rate);
  const proposedCents =
    asset.direction === 'owe' ? Math.max(0, movedValueCents) : movedValueCents;
  if (proposedCents === valueCents) return null;

  return {
    delta: toUnits(proposedCents - valueCents),
    proposedValue: toUnits(proposedCents),
  };
}

function toUnits(cents: number): number {
  return cents === 0 ? 0 : cents / CENTS_PER_UNIT;
}
