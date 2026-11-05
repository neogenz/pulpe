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
  AssetUpdatePatch,
  AssetWithValue,
  CheckedLinesCutoff,
  CheckedLinkedLine,
} from '../../domain/asset.entity';

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
        latestValue: this.encryption.decryptAmount(latest.value, dek),
        latestRecordedAt: latest.recorded_at,
        suggestionDismissedAt: row.suggestion_dismissed_at,
      };
    });
  }

  async findCheckedLinkedLines(
    cutoffs: CheckedLinesCutoff[],
  ): Promise<CheckedLinkedLine[]> {
    if (cutoffs.length === 0) return [];
    const supabase = this.supabaseProvider.client;

    // `budget_line` has no user column: the asset ids come from the user's own
    // assets, and the link trigger keeps a line on an asset of its owner.
    // `gt` also drops the lines that are not checked (`checked_at` is null).
    const rowsByAsset = await Promise.all(
      cutoffs.map(async ({ assetId, since }) => ({
        assetId,
        rows: await fetchAllPages((from, to) =>
          supabase
            .from('budget_line')
            .select('id, kind, amount')
            .eq('asset_id', assetId)
            .gt('checked_at', since)
            .order('id', { ascending: true })
            .range(from, to),
        ),
      })),
    ).catch((error: unknown) => {
      throw this.fetchFailed('listCheckedLinkedLines', error);
    });

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return rowsByAsset.flatMap(({ assetId, rows }) =>
      rows.map((row) => ({
        assetId,
        kind: row.kind,
        // Strict: a value Pulpe proposes and the user can apply must never
        // come from an amount that failed to decrypt.
        amount: row.amount ? this.encryption.decryptAmount(row.amount, dek) : 0,
      })),
    );
  }

  async insertAsset(input: AssetCreateInput): Promise<Asset> {
    const userId = this.supabaseProvider.user.id;
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('asset')
      .insert({
        user_id: userId,
        category_id: input.categoryId,
        name: input.name,
        currency: input.currency,
        direction: input.direction,
        in_pulpe: input.inPulpe,
      })
      .select('*')
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

    try {
      await this.insertSnapshots([{ assetId: data.id, value: input.value }]);
    } catch (snapshotError) {
      // Two statements, no transaction: never leave an asset without a value.
      const { error: cleanupError } = await supabase
        .from('asset')
        .delete()
        .eq('id', data.id);
      if (cleanupError) {
        this.logger.warn(
          {
            operation: 'createAsset.compensateSnapshotFailure',
            entityId: data.id,
            err: cleanupError,
          },
          'Failed to delete asset after first snapshot failure',
        );
      }
      throw snapshotError;
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
        suggestion_dismissed_at: patch.suggestionDismissedAt,
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
