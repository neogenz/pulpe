import type {
  AssetDirection,
  NetWorthTotals,
  SupportedCurrency,
} from 'pulpe-shared';
import type { Database } from '../../../types/database.types';

export type AssetRow = Database['public']['Tables']['asset']['Row'];
export type AssetInsert = Database['public']['Tables']['asset']['Insert'];
export type AssetCategoryRow =
  Database['public']['Tables']['asset_category']['Row'];
export type AssetSnapshotRow =
  Database['public']['Tables']['asset_snapshot']['Row'];

export interface AssetCategory {
  id: string;
  name: string;
}

/** An asset or a debt (`direction: 'owe'`), without any amount. */
export interface Asset {
  id: string;
  categoryId: string;
  name: string;
  currency: SupportedCurrency;
  direction: AssetDirection;
  inPulpe: boolean;
  archivedAt: string | null;
}

/**
 * An asset with its current value: the latest snapshot, decrypted, in the
 * asset's own currency.
 */
export interface AssetWithValue extends Asset {
  latestValue: number;
  latestRecordedAt: string;
}

export interface AssetCreateInput {
  name: string;
  categoryId: string;
  currency: SupportedCurrency;
  direction: AssetDirection;
  inPulpe: boolean;
  /** First snapshot. */
  value: number;
}

/** `undefined` means "do not touch"; `archivedAt: null` unarchives. */
export interface AssetUpdatePatch {
  name?: string;
  categoryId?: string;
  inPulpe?: boolean;
  archivedAt?: string | null;
}

export interface AssetSnapshotInput {
  assetId: string;
  value: number;
}

/** Category with its total in base currency, computed by the net-worth formula. */
export interface NetWorthCategory extends AssetCategory {
  total: number;
}

/** Asset with its value in base currency at today's rate; `null` without a rate. */
export interface NetWorthAsset extends AssetWithValue {
  convertedValue: number | null;
}

export interface NetWorth {
  totals: NetWorthTotals;
  categories: NetWorthCategory[];
  assets: NetWorthAsset[];
}
