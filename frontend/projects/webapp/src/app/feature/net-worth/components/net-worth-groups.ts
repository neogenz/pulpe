import type { Asset, AssetCategory } from 'pulpe-shared';

/** One Type card on the page, and one node of the Sankey. */
export interface AssetGroup {
  /** The Type, or `null` for the overdrawn accounts: they keep their own Type but count as debts. */
  category: AssetCategory | null;
  /** In base currency. */
  total: number;
  assets: Asset[];
}

/** A Type card of what I own: it always has its Type. */
export type OwnGroup = AssetGroup & { category: AssetCategory };

const isOverdrawn = (asset: Asset): boolean =>
  asset.direction === 'own' && asset.latestValue < 0;

/** What I own, by Type. The subtotal is the one the API computed. */
export function ownGroups(
  categories: readonly AssetCategory[],
  activeAssets: readonly Asset[],
): OwnGroup[] {
  return categories
    .map((category) => ({
      category,
      total: category.total,
      assets: activeAssets.filter(
        (asset) =>
          asset.categoryId === category.id &&
          asset.direction === 'own' &&
          !isOverdrawn(asset),
      ),
    }))
    .filter((group) => group.assets.length > 0);
}

/**
 * What I owe, by Type, then the overdrawn accounts. The API gives no subtotal
 * per debt Type, so each one adds the converted values it already rounded to
 * the cent: in whole cents, the sum cannot drift from the API's own total.
 */
export function debtGroups(
  categories: readonly AssetCategory[],
  activeAssets: readonly Asset[],
): AssetGroup[] {
  const groups: AssetGroup[] = categories.map((category) =>
    toDebtGroup(
      category,
      activeAssets.filter(
        (asset) =>
          asset.categoryId === category.id && asset.direction === 'owe',
      ),
    ),
  );
  groups.push(toDebtGroup(null, activeAssets.filter(isOverdrawn)));
  return groups.filter((group) => group.assets.length > 0);
}

function toDebtGroup(
  category: AssetCategory | null,
  assets: Asset[],
): AssetGroup {
  const cents = assets.reduce(
    (sum, asset) => sum + Math.round(Math.abs(asset.convertedValue ?? 0) * 100),
    0,
  );
  return { category, total: cents / 100, assets };
}
