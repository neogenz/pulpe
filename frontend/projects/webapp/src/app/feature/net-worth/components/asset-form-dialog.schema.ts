import {
  assetCreateSchema,
  assetUpdateSchema,
  type Asset,
  type AssetCategory,
  type AssetDirection,
  type SupportedCurrency,
} from 'pulpe-shared';
import type { CategoryChoice } from '@core/asset/asset-category';
import type {
  AssetCreateRequest,
  AssetEditRequest,
} from '../services/net-worth-store';

export interface AssetFormValue {
  name: string;
  direction: AssetDirection;
  /** An existing Type id, `NEW_CATEGORY_PREFIX` + a suggestion, or `OTHER_TYPE_KEY`. */
  categoryKey: string;
  /** The name typed after picking « Autre type… ». */
  typeName: string;
  currency: SupportedCurrency;
  /** Always a magnitude; `isOverdraft` carries the sign of an account. */
  value: number | null;
  isOverdraft: boolean;
}

export const NEW_CATEGORY_PREFIX = 'new:';
export const OTHER_TYPE_KEY = 'other';
export const MAX_TYPE_NAME_LENGTH = 30;

/** Translation keys under `netWorth.starter` / `netWorth.starterDebt`. */
export const STARTER_TYPE_KEYS: Record<AssetDirection, readonly string[]> = {
  own: [
    'netWorth.starter.accounts',
    'netWorth.starter.savings',
    'netWorth.starter.investments',
    'netWorth.starter.cash',
    'netWorth.starter.valuables',
    'netWorth.starter.property',
  ],
  owe: [
    'netWorth.starterDebt.loan',
    'netWorth.starterDebt.mortgage',
    'netWorth.starterDebt.leasing',
    'netWorth.starterDebt.card',
  ],
};

export interface TypeOptions {
  /** Types an element of this direction already uses, most used first. */
  used: AssetCategory[];
  /** Suggested names for this direction that no listed Type carries. */
  suggestions: string[];
}

/** A Type has no direction of its own: it shows where its elements are. */
export function typeOptionsFor(
  direction: AssetDirection,
  categories: readonly AssetCategory[],
  assets: readonly Asset[],
  starterNames: readonly string[],
): TypeOptions {
  const uses = new Map<string, number>();
  for (const asset of assets) {
    if (asset.direction !== direction) continue;
    uses.set(asset.categoryId, (uses.get(asset.categoryId) ?? 0) + 1);
  }
  const used = categories
    .filter((category) => uses.has(category.id))
    .sort((a, b) => uses.get(b.id)! - uses.get(a.id)!);
  const taken = new Set(used.map((category) => category.name.toLowerCase()));
  return {
    used,
    suggestions: starterNames.filter((name) => !taken.has(name.toLowerCase())),
  };
}

/** The most used Type of the direction, or its first suggestion. */
export function defaultCategoryKey({ used, suggestions }: TypeOptions): string {
  return used[0]?.id ?? NEW_CATEGORY_PREFIX + suggestions[0];
}

const assetCreateWithoutCategorySchema = assetCreateSchema.omit({
  categoryId: true,
});

function toCategoryChoice(value: AssetFormValue): CategoryChoice {
  if (value.categoryKey === OTHER_TYPE_KEY) return { name: value.typeName };
  return value.categoryKey.startsWith(NEW_CATEGORY_PREFIX)
    ? { name: value.categoryKey.slice(NEW_CATEGORY_PREFIX.length) }
    : { id: value.categoryKey };
}

// Only an account I own can be overdrawn; a debt is never negative.
function signedValue(value: AssetFormValue): number {
  const magnitude = value.value ?? 0;
  return value.direction === 'own' && value.isOverdraft && magnitude !== 0
    ? -magnitude
    : magnitude;
}

export function buildAssetCreate(value: AssetFormValue): AssetCreateRequest {
  return {
    asset: assetCreateWithoutCategorySchema.parse({
      name: value.name,
      currency: value.currency,
      direction: value.direction,
      value: signedValue(value),
    }),
    category: toCategoryChoice(value),
  };
}

/**
 * Only what changed: the name and the Type go in a patch, the value in a new
 * snapshot. Direction and currency are fixed at creation.
 */
export function buildAssetEdit(
  value: AssetFormValue,
  original: Asset,
): AssetEditRequest {
  const edit: AssetEditRequest = {};
  const name = value.name.trim();
  if (name !== original.name) {
    edit.updates = assetUpdateSchema.parse({ name });
  }
  if (value.categoryKey !== original.categoryId) {
    edit.category = toCategoryChoice(value);
  }
  const signed = signedValue(value);
  if (signed !== original.latestValue) edit.value = signed;
  return edit;
}
