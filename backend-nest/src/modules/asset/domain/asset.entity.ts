import type {
  AssetDirection,
  AssetSuggestion,
  NetWorthTotals,
  SupportedCurrency,
  TransactionKind,
} from 'pulpe-shared';
import type { Database } from '../../../types/database.types';

export type AssetRow = Database['public']['Tables']['asset']['Row'];
export type AssetCategoryRow =
  Database['public']['Tables']['asset_category']['Row'];

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
  /** When the user last dismissed a suggestion; never exposed by the API. */
  suggestionDismissedAt: string | null;
}

/**
 * A prévision of the user, linked to an asset and checked. `amount` is decrypted
 * and in the account currency, the one the totals are converted into.
 */
export interface CheckedLinkedLine {
  assetId: string;
  kind: TransactionKind;
  amount: number;
}

/** Lines are read when checked strictly after `since` (an ISO instant). */
export interface CheckedLinesCutoff {
  assetId: string;
  since: string;
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
  suggestionDismissedAt?: string;
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
  suggestion: AssetSuggestion | null;
}

export interface NetWorth {
  totals: NetWorthTotals;
  categories: NetWorthCategory[];
  assets: NetWorthAsset[];
}
