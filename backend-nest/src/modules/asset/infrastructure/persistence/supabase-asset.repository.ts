import { Inject, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import type { SupportedCurrency } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  ERROR_DEFINITIONS,
  type ErrorDefinition,
} from '@common/constants/error-definitions';
import { fetchAllPages } from '@common/utils/postgrest-pagination';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AssetRepositoryPort } from '../../domain/ports/asset-repository.port';
import type {
  Asset,
  AssetCategory,
  AssetCategoryRow,
  AssetCreateInput,
  AssetRow,
  AssetSnapshotInput,
  AssetMovements,
  AssetSnapshot,
  AssetUpdatePatch,
  AssetWithValue,
  CheckedReal,
  FreeMovement,
  MonthFreeMovement,
  MonthLine,
  MonthMovements,
  MovementLine,
} from '../../domain/asset.entity';
import type { Database } from '../../../../types/database.types';

type ListedMovement =
  Database['public']['Functions']['list_asset_movements_for']['Returns'][number];
/** The generated type says every column is set; a row only fills those of its `movement`. */
type AssetMovementRow = {
  [K in keyof ListedMovement]: ListedMovement[K] | null;
};

const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';
const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGREST_NO_ROWS = 'PGRST116';

@Injectable()
export class SupabaseAssetRepository implements AssetRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    @InjectInfoLogger(SupabaseAssetRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  async findAllCategories(): Promise<AssetCategory[]> {
    const { data, error } = await this.supabaseProvider.client
      .from('asset_category')
      .select('*')
      .eq('user_id', this.supabaseProvider.user.id)
      .order('name', { ascending: true });

    if (error) throw this.fetchFailed('listAssetCategories', error);
    return data.map((row) => this.toCategory(row));
  }

  async insertCategory(name: string): Promise<AssetCategory> {
    const userId = this.supabaseProvider.user.id;
    const { data, error } = await this.supabaseProvider.client
      .from('asset_category')
      .insert({ user_id: userId, name })
      .select('*')
      .single();

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      throw this.duplicateCategory('createAssetCategory', name, error);
    }
    if (error) {
      throw this.writeFailed(
        ERROR_DEFINITIONS.ASSET_CREATE_FAILED,
        'createAssetCategory',
        'asset category',
        error,
      );
    }
    return this.toCategory(data);
  }

  async updateCategory(id: string, name: string): Promise<AssetCategory> {
    const { data, error } = await this.supabaseProvider.client
      .from('asset_category')
      .update({ name })
      .eq('id', id)
      .eq('user_id', this.supabaseProvider.user.id)
      .select('*')
      .single();

    if (error?.code === POSTGRES_UNIQUE_VIOLATION) {
      throw this.duplicateCategory('updateAssetCategory', name, error);
    }
    if (error?.code === POSTGREST_NO_ROWS) {
      throw this.notFound(
        ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_FOUND,
        'updateAssetCategory',
        id,
        error,
      );
    }
    if (error) {
      throw this.writeFailed(
        ERROR_DEFINITIONS.ASSET_UPDATE_FAILED,
        'updateAssetCategory',
        'asset category',
        error,
      );
    }
    return this.toCategory(data);
  }

  async deleteCategory(id: string): Promise<void> {
    const { data, error } = await this.supabaseProvider.client
      .from('asset_category')
      .delete()
      .eq('id', id)
      .eq('user_id', this.supabaseProvider.user.id)
      .select('id');

    if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_EMPTY,
        { id },
        this.logContext('deleteAssetCategory', id),
        { cause: error },
      );
    }
    if (error) {
      throw this.writeFailed(
        ERROR_DEFINITIONS.ASSET_DELETE_FAILED,
        'deleteAssetCategory',
        'asset category',
        error,
      );
    }
    if (data.length === 0) {
      throw this.notFound(
        ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_FOUND,
        'deleteAssetCategory',
        id,
      );
    }
  }

  async findAll(): Promise<Asset[]> {
    return (await this.selectAssetRows()).map((row) => this.toAsset(row));
  }

  async findAllWithLatestValue(): Promise<AssetWithValue[]> {
    const userId = this.supabaseProvider.user.id;
    const supabase = this.supabaseProvider.client;
    const [rows, snapshots] = await Promise.all([
      this.selectAssetRows(),
      fetchAllPages((from, to) =>
        supabase
          .from('asset_latest_snapshot')
          .select('asset_id, value, recorded_at')
          .eq('user_id', userId)
          .order('asset_id', { ascending: true })
          .range(from, to),
      ).catch((error: unknown) => {
        throw this.fetchFailed('listAssetSnapshots', error);
      }),
    ]);

    const latestByAssetId = new Map(
      snapshots.map((snapshot) => [snapshot.asset_id, snapshot]),
    );

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return rows.flatMap((row) => {
      const latest = latestByAssetId.get(row.id);
      if (!latest?.value || !latest.recorded_at) {
        // An orphan left by a failed creation must not take the whole list down.
        this.logger.warn(
          { operation: 'listAssets', entityId: row.id },
          'Asset has no snapshot, left out of the list',
        );
        return [];
      }
      return {
        ...this.toAsset(row),
        recordedValue: this.encryption.decryptAmount(latest.value, dek),
        latestRecordedAt: latest.recorded_at,
      };
    });
  }

  async findMovementsSince(
    since: string,
    assetId?: string,
  ): Promise<AssetMovements> {
    const supabase = this.supabaseProvider.client;
    const rows = await fetchAllPages<AssetMovementRow>((from, to) =>
      supabase
        .rpc('list_asset_movements_for', {
          p_since: since,
          p_asset_id: assetId,
        })
        .order('id', { ascending: true })
        .range(from, to),
    ).catch((error: unknown) => {
      throw this.fetchFailed('listAssetMovements', error);
    });

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    // Strict: the value of an asset must never move by an amount that failed
    // to decrypt. A row without an amount moves nothing.
    const decrypt = (amount: string) =>
      this.encryption.decryptAmount(amount, dek);

    const realsByLineId = new Map<string, CheckedReal[]>();
    for (const row of rows) {
      if (row.movement !== 'real' || !row.budget_line_id) continue;
      if (!row.amount || !row.checked_at) continue;
      const reals = realsByLineId.get(row.budget_line_id) ?? [];
      reals.push({ amount: decrypt(row.amount), checkedAt: row.checked_at });
      realsByLineId.set(row.budget_line_id, reals);
    }

    const lines = rows.flatMap((row): MovementLine[] => {
      if (row.movement !== 'line' || !row.id || !row.kind || !row.amount) {
        return [];
      }
      return [
        {
          id: row.id,
          name: row.name ?? '',
          kind: row.kind,
          amount: decrypt(row.amount),
          checkedAt: row.checked_at,
          accountId: row.account_id,
          assetId: row.asset_id,
          checkedReals: realsByLineId.get(row.id) ?? [],
        },
      ];
    });
    const freeMovements = rows.flatMap((row): FreeMovement[] => {
      if (row.movement !== 'free' || !row.id || !row.kind) return [];
      if (!row.amount || !row.account_id || !row.checked_at) return [];
      return [
        {
          id: row.id,
          name: row.name ?? '',
          accountId: row.account_id,
          kind: row.kind,
          amount: decrypt(row.amount),
          checkedAt: row.checked_at,
        },
      ];
    });
    return { lines, freeMovements };
  }

  async findMonthMovements(
    assetId: string,
    month: number,
    year: number,
  ): Promise<MonthMovements> {
    const supabase = this.supabaseProvider.client;
    const userId = this.supabaseProvider.user.id;
    const failed = (error: unknown) => {
      throw this.fetchFailed('listAssetMonthMovements', error, {
        entityId: assetId,
      });
    };
    // The budget is joined rather than read first: no budget, no rows.
    const [lineRows, freeRows] = await Promise.all([
      fetchAllPages((from, to) =>
        supabase
          .from('budget_line')
          .select(
            'id, kind, amount, checked_at, account_id, asset_id, transaction(amount, checked_at), monthly_budget!inner(month, year, user_id)',
          )
          .eq('monthly_budget.month', month)
          .eq('monthly_budget.year', year)
          .eq('monthly_budget.user_id', userId)
          .or(`account_id.eq.${assetId},asset_id.eq.${assetId}`)
          .order('id', { ascending: true })
          .range(from, to),
      ).catch(failed),
      fetchAllPages((from, to) =>
        supabase
          .from('transaction')
          .select(
            'id, kind, amount, checked_at, monthly_budget!inner(month, year, user_id)',
          )
          .eq('monthly_budget.month', month)
          .eq('monthly_budget.year', year)
          .eq('monthly_budget.user_id', userId)
          .is('budget_line_id', null)
          .eq('account_id', assetId)
          .order('id', { ascending: true })
          .range(from, to),
      ).catch(failed),
    ]);

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    // Strict, like `findMovementsSince`: a projection never moves by an amount
    // that failed to decrypt. A row without an amount moves nothing.
    const decrypt = (amount: string) =>
      this.encryption.decryptAmount(amount, dek);

    const lines = lineRows.flatMap((row): MonthLine[] => {
      if (!row.amount) return [];
      return [
        {
          kind: row.kind,
          amount: decrypt(row.amount),
          checkedAt: row.checked_at,
          accountId: row.account_id,
          assetId: row.asset_id,
          reals: row.transaction.flatMap((real) =>
            real.amount
              ? [{ amount: decrypt(real.amount), checkedAt: real.checked_at }]
              : [],
          ),
        },
      ];
    });
    const freeMovements = freeRows.flatMap((row): MonthFreeMovement[] =>
      row.amount
        ? [
            {
              kind: row.kind,
              amount: decrypt(row.amount),
              accountId: assetId,
              checkedAt: row.checked_at,
            },
          ]
        : [],
    );
    return { lines, freeMovements };
  }

  async findSnapshots(assetId: string): Promise<AssetSnapshot[]> {
    const supabase = this.supabaseProvider.client;
    const rows = await fetchAllPages((from, to) =>
      supabase
        .from('asset_snapshot')
        .select('id, value, recorded_at')
        .eq('asset_id', assetId)
        .eq('user_id', this.supabaseProvider.user.id)
        // Same tie-break as `asset_latest_snapshot`: the last row is the latest.
        .order('recorded_at', { ascending: true })
        .order('id', { ascending: false })
        .range(from, to),
    ).catch((error: unknown) => {
      throw this.fetchFailed('listAssetSnapshotHistory', error, {
        entityId: assetId,
      });
    });

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    // Strict: an entry that fails to decrypt fails the read, never shows as 0.
    return rows.map((row) => ({
      id: row.id,
      value: this.encryption.decryptAmount(row.value, dek),
      recordedAt: row.recorded_at,
    }));
  }

  async insertAsset(input: AssetCreateInput): Promise<Asset> {
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    // One transaction: an asset never exists without its first value.
    const { data, error } = await this.supabaseProvider.client
      .rpc('create_asset_with_first_snapshot', {
        p_category_id: input.categoryId,
        p_name: input.name,
        p_currency: input.currency,
        p_direction: input.direction,
        p_in_pulpe: input.inPulpe,
        p_value: this.encryption.encryptAmount(input.value, dek),
      })
      .single();

    if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      throw this.notFound(
        ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_FOUND,
        'createAsset',
        input.categoryId,
        error,
      );
    }
    if (error) {
      throw this.writeFailed(
        ERROR_DEFINITIONS.ASSET_CREATE_FAILED,
        'createAsset',
        'asset',
        error,
      );
    }
    return this.toAsset(data);
  }

  async update(id: string, patch: AssetUpdatePatch): Promise<Asset> {
    const { data, error } = await this.supabaseProvider.client
      .from('asset')
      .update({
        name: patch.name,
        category_id: patch.categoryId,
        in_pulpe: patch.inPulpe,
        archived_at: patch.archivedAt,
      })
      .eq('id', id)
      .eq('user_id', this.supabaseProvider.user.id)
      .select('*')
      .single();

    if (error?.code === POSTGREST_NO_ROWS) {
      throw this.notFound(
        ERROR_DEFINITIONS.ASSET_NOT_FOUND,
        'updateAsset',
        id,
        error,
      );
    }
    if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      throw this.notFound(
        ERROR_DEFINITIONS.ASSET_CATEGORY_NOT_FOUND,
        'updateAsset',
        patch.categoryId,
        error,
      );
    }
    if (error) {
      throw this.writeFailed(
        ERROR_DEFINITIONS.ASSET_UPDATE_FAILED,
        'updateAsset',
        'asset',
        error,
      );
    }
    return this.toAsset(data);
  }

  async delete(id: string): Promise<void> {
    const { data, error } = await this.supabaseProvider.client
      .from('asset')
      .delete()
      .eq('id', id)
      .eq('user_id', this.supabaseProvider.user.id)
      .select('id');

    if (error) {
      throw this.writeFailed(
        ERROR_DEFINITIONS.ASSET_DELETE_FAILED,
        'deleteAsset',
        'asset',
        error,
      );
    }
    if (data.length === 0) {
      throw this.notFound(ERROR_DEFINITIONS.ASSET_NOT_FOUND, 'deleteAsset', id);
    }
  }

  async insertSnapshots(items: AssetSnapshotInput[]): Promise<string> {
    const user = this.supabaseProvider.user;
    const dek = await this.encryption.getDekFor(user);
    // One INSERT: the rows share the default `recorded_at` and land together.
    const { data, error } = await this.supabaseProvider.client
      .from('asset_snapshot')
      .insert(
        items.map((item) => ({
          user_id: user.id,
          asset_id: item.assetId,
          value: this.encryption.encryptAmount(item.value, dek),
        })),
      )
      .select('recorded_at');

    if (error?.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
      throw this.notFound(
        ERROR_DEFINITIONS.ASSET_NOT_FOUND,
        'recordAssetSnapshots',
        undefined,
        error,
      );
    }
    if (error) {
      throw this.writeFailed(
        ERROR_DEFINITIONS.ASSET_CREATE_FAILED,
        'recordAssetSnapshots',
        'asset snapshot',
        error,
      );
    }
    return data[0].recorded_at;
  }

  private async selectAssetRows(): Promise<AssetRow[]> {
    const { data, error } = await this.supabaseProvider.client
      .from('asset')
      .select('*')
      .eq('user_id', this.supabaseProvider.user.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw this.fetchFailed('listAssets', error);
    return data;
  }

  private logContext(
    operation: string,
    entityId?: string,
  ): Record<string, unknown> {
    return {
      operation,
      entityId,
      entityType: 'asset',
      userId: this.supabaseProvider.user.id,
    };
  }

  private fetchFailed(
    operation: string,
    error: unknown,
    extra: Record<string, unknown> = {},
  ): BusinessException {
    return new BusinessException(
      ERROR_DEFINITIONS.ASSET_FETCH_FAILED,
      undefined,
      { ...this.logContext(operation), ...extra },
      { cause: error },
    );
  }

  private writeFailed(
    definition: ErrorDefinition,
    operation: string,
    entity: string,
    error: PostgrestError,
  ): BusinessException {
    return new BusinessException(
      definition,
      { entity },
      this.logContext(operation),
      { cause: error },
    );
  }

  private notFound(
    definition: ErrorDefinition,
    operation: string,
    id: string | undefined,
    error?: PostgrestError,
  ): BusinessException {
    return new BusinessException(
      definition,
      { id },
      this.logContext(operation, id),
      { cause: error },
    );
  }

  private duplicateCategory(
    operation: string,
    name: string,
    error: PostgrestError,
  ): BusinessException {
    return new BusinessException(
      ERROR_DEFINITIONS.ASSET_CATEGORY_DUPLICATE,
      { name },
      this.logContext(operation),
      { cause: error },
    );
  }

  private toCategory(row: AssetCategoryRow): AssetCategory {
    return { id: row.id, name: row.name };
  }

  private toAsset(row: AssetRow): Asset {
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      // The CHECK constraints on the table guarantee both values.
      currency: row.currency as SupportedCurrency,
      direction: row.direction as Asset['direction'],
      inPulpe: row.in_pulpe,
      archivedAt: row.archived_at,
    };
  }
}
