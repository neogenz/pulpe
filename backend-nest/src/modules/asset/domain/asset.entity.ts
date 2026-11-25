import type {
  AssetDirection,
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
 * An asset with its last entry: the latest snapshot, decrypted, in the asset's
 * own currency. A snapshot is a value typed by the user (edit or
 * reconciliation), never a checked movement.
 */
export interface AssetWithValue extends Asset {
  recordedValue: number;
  latestRecordedAt: string;
}

/** A checked movement of a prévision: it counts through the prévision. */
export interface CheckedReal {
  amount: number;
  checkedAt: string;
}

/**
 * A prévision linked to an asset, as its account (`accountId`) or as the asset
 * it feeds, draws from or repays (`assetId`). `amount` is decrypted and in the
 * budget currency, the one the totals are converted into, like the amounts of
 * its checked movements. The movements of a prévision never carry an account
 * of their own: they follow the prévision's.
 */
export interface MovementLine {
  id: string;
  kind: TransactionKind;
  amount: number;
  checkedAt: string | null;
  accountId: string | null;
  assetId: string | null;
  checkedReals: CheckedReal[];
}

/** A checked movement outside any prévision, with an account. */
export interface FreeMovement {
  accountId: string;
  kind: TransactionKind;
  amount: number;
  checkedAt: string;
}

/**
 * What can move an asset after an instant: the linked prévisions checked after
 * it or holding a movement checked after it, with all their checked movements,
 * and the free movements checked after it.
 */
export interface AssetMovements {
  lines: MovementLine[];
  freeMovements: FreeMovement[];
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

/**
 * Asset with its up-to-date `value` (last entry plus what was checked since,
 * own currency) and that value in base currency at today's rate, `null`
 * without a rate.
 */
export interface NetWorthAsset extends AssetWithValue {
  value: number;
  convertedValue: number | null;
}

export interface NetWorth {
  totals: NetWorthTotals;
  categories: NetWorthCategory[];
  assets: NetWorthAsset[];
}
