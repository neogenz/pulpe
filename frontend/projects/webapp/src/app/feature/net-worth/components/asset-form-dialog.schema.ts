import {
  assetCreateSchema,
  assetUpdateSchema,
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
  /** An existing category id, or `NEW_CATEGORY_PREFIX` + a starter name. */
  categoryKey: string;
  currency: SupportedCurrency;
  value: number | null;
  inPulpe: boolean;
}

export const NEW_CATEGORY_PREFIX = 'new:';

const assetCreateWithoutCategorySchema = assetCreateSchema.omit({
  categoryId: true,
});

function toCategoryChoice(categoryKey: string): CategoryChoice {
  return categoryKey.startsWith(NEW_CATEGORY_PREFIX)
    ? { name: categoryKey.slice(NEW_CATEGORY_PREFIX.length) }
    : { id: categoryKey };
}

export function buildAssetCreate(value: AssetFormValue): AssetCreateRequest {
  return {
    asset: assetCreateWithoutCategorySchema.parse({
      name: value.name,
      currency: value.currency,
      direction: value.direction,
      inPulpe: value.inPulpe,
      value: value.value,
    }),
    category: toCategoryChoice(value.categoryKey),
  };
}

/** Direction and currency are fixed at creation, so the patch never carries them. */
export function buildAssetEdit(value: AssetFormValue): AssetEditRequest {
  return {
    updates: assetUpdateSchema.parse({
      name: value.name,
      inPulpe: value.inPulpe,
    }),
    category: toCategoryChoice(value.categoryKey),
  };
}
