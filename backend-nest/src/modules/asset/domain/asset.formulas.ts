import type { SupportedCurrency } from 'pulpe-shared';
import type { AssetCategory, AssetWithValue, NetWorth } from './asset.entity';

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
}

/**
 * The only place net-worth money is computed. Every figure is rounded to the
 * cent; sums run on integer cents so they do not drift.
 *
 * Active assets only count in the totals. A positive `own` value goes to its
 * category `total` and to `gross`; a negative `own` value (overdraft) and an
 * `owe` value go to `debts`. An asset with no rate keeps `convertedValue: null`
 * and stays out of the totals, which then carry `incomplete`.
 */
export function computeNetWorth(input: NetWorthInput): NetWorth {
  const { baseCurrency, categories, assets, rates } = input;
  const categoryCents = new Map(categories.map((c) => [c.id, 0]));
  let grossCents = 0;
  let debtsCents = 0;
  let incomplete = false;

  const valuedAssets = assets.map((asset) => {
    const rate = asset.currency === baseCurrency ? 1 : rates[asset.currency];
    if (rate === undefined) {
      incomplete ||= asset.archivedAt === null;
      return { ...asset, convertedValue: null };
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
    return { ...asset, convertedValue: toUnits(cents) };
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

function toUnits(cents: number): number {
  return cents === 0 ? 0 : cents / CENTS_PER_UNIT;
}
