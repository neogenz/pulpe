import type {
  Asset,
  AssetCategory,
  AssetCreateInput,
  AssetMovements,
  AssetSnapshot,
  AssetSnapshotInput,
  AssetUpdatePatch,
  AssetWithValue,
  MonthMovements,
} from '../asset.entity';

export const ASSET_REPOSITORY = Symbol('ASSET_REPOSITORY');

/**
 * Persistence port for assets, their categories and their dated snapshots.
 * The repository owns the encryption boundary: snapshot values are plain
 * numbers on both sides of it.
 */
export interface AssetRepositoryPort {
  findAllCategories(): Promise<AssetCategory[]>;
  insertCategory(name: string): Promise<AssetCategory>;
  updateCategory(id: string, name: string): Promise<AssetCategory>;
  /** Throws ASSET_CATEGORY_NOT_EMPTY while the category still holds an asset. */
  deleteCategory(id: string): Promise<void>;

  /** Every asset, archived ones included, without any amount. */
  findAll(): Promise<Asset[]>;
  /** Every asset with its latest snapshot decrypted. */
  findAllWithLatestValue(): Promise<AssetWithValue[]>;
  /**
   * What can move an asset strictly after `since`, amounts decrypted: every
   * asset, or only `assetId` when given.
   */
  findMovementsSince(since: string, assetId?: string): Promise<AssetMovements>;
  /**
   * What the budget of `month`/`year` plans or holds for an asset, checked or
   * not, amounts decrypted, uncached: its prévisions linked by `account_id` or
   * `asset_id` with all their movements, and its free movements. Empty without
   * a budget that month.
   */
  findMonthMovements(
    assetId: string,
    month: number,
    year: number,
  ): Promise<MonthMovements>;
  /** Every entry of an asset, oldest first, decrypted; the last is its latest. */
  findSnapshots(assetId: string): Promise<AssetSnapshot[]>;
  /** Writes the asset and its first snapshot together. */
  insertAsset(input: AssetCreateInput): Promise<Asset>;
  update(id: string, patch: AssetUpdatePatch): Promise<Asset>;
  delete(id: string): Promise<void>;
  /** Writes every snapshot with one `recorded_at` and returns it. */
  insertSnapshots(items: AssetSnapshotInput[]): Promise<string>;
}
