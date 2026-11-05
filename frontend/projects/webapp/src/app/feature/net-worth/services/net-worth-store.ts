import { computed, inject, Service } from '@angular/core';
import { cachedMutation } from 'ngx-ziflux';
import { firstValueFrom } from 'rxjs';
import type {
  Asset,
  AssetCategory,
  AssetCreate,
  AssetUpdate,
  NetWorthTotals,
} from 'pulpe-shared';
import { AssetApi } from '@core/asset/asset-api';
import { injectNetWorthResource } from '@core/asset/net-worth';

/** An existing category, or a starter suggestion to create on save. */
export type CategoryChoice = { id: string } | { name: string };

export interface AssetCreateRequest {
  asset: Omit<AssetCreate, 'categoryId'>;
  category: CategoryChoice;
}

export interface AssetEditRequest {
  updates: Omit<AssetUpdate, 'categoryId'>;
  category: CategoryChoice;
}

/**
 * « Mon patrimoine » state. Every figure is read from the API response; the
 * store only sorts assets into active and archived. Writes share one mutation
 * so any failure, including a category created before its asset failed,
 * refetches the page.
 */
@Service({ autoProvided: false })
export class NetWorthStore {
  readonly #api = inject(AssetApi);

  readonly netWorth = injectNetWorthResource();

  readonly totals = computed<NetWorthTotals | null>(
    () => this.netWorth.value()?.totals ?? null,
  );
  readonly categories = computed<AssetCategory[]>(
    () => this.netWorth.value()?.categories ?? [],
  );
  readonly assets = computed<Asset[]>(
    () => this.netWorth.value()?.assets ?? [],
  );
  readonly activeAssets = computed(() =>
    this.assets().filter((asset) => asset.archivedAt === null),
  );
  readonly archivedAssets = computed(() =>
    this.assets().filter((asset) => asset.archivedAt !== null),
  );
  readonly isEmpty = computed(() => this.assets().length === 0);

  readonly #write = cachedMutation<() => Promise<unknown>, true>({
    cache: this.#api.cache,
    invalidateKeys: () => [['assets']],
    mutationFn: async (run) => {
      await run();
      return true as const;
    },
    onError: () => this.#api.cache.invalidate(['assets']),
  });

  /** True while a write is in flight; a second one is dropped meanwhile. */
  readonly isSaving = this.#write.isPending;

  refresh(): void {
    this.netWorth.reload();
  }

  addAsset({ asset, category }: AssetCreateRequest): Promise<void> {
    return this.#run(async () => {
      const categoryId = await this.#resolveCategory(category);
      await firstValueFrom(this.#api.create$({ ...asset, categoryId }));
    });
  }

  editAsset(
    id: string,
    { updates, category }: AssetEditRequest,
  ): Promise<void> {
    return this.#run(async () => {
      const categoryId = await this.#resolveCategory(category);
      await firstValueFrom(this.#api.update$(id, { ...updates, categoryId }));
    });
  }

  recordValue(assetId: string, value: number): Promise<void> {
    return this.#run(() =>
      firstValueFrom(
        this.#api.recordSnapshots$({ items: [{ assetId, value }] }),
      ),
    );
  }

  dismissSuggestion(id: string): Promise<void> {
    return this.#run(() => firstValueFrom(this.#api.dismissSuggestion$(id)));
  }

  setArchived(id: string, archived: boolean): Promise<void> {
    return this.#run(() => firstValueFrom(this.#api.update$(id, { archived })));
  }

  deleteAsset(id: string): Promise<void> {
    return this.#run(() => firstValueFrom(this.#api.delete$(id)));
  }

  addCategory(name: string): Promise<void> {
    return this.#run(() => firstValueFrom(this.#api.createCategory$({ name })));
  }

  renameCategory(id: string, name: string): Promise<void> {
    return this.#run(() =>
      firstValueFrom(this.#api.updateCategory$(id, { name })),
    );
  }

  deleteCategory(id: string): Promise<void> {
    return this.#run(() => firstValueFrom(this.#api.deleteCategory$(id)));
  }

  /**
   * Resolves once the write is done and the asset cache invalidated; the
   * refetch lands after. Throws on failure. Ignored while another write is in
   * flight, so a double click never records twice.
   */
  async #run(run: () => Promise<unknown>): Promise<void> {
    if (this.isSaving()) return;
    const done = await this.#write.mutate(run);
    if (!done) {
      throw this.#write.error() ?? new Error('Net worth write failed');
    }
  }

  async #resolveCategory(choice: CategoryChoice): Promise<string> {
    if ('id' in choice) return choice.id;
    const created = await firstValueFrom(
      this.#api.createCategory$({ name: choice.name }),
    );
    return created.data.id;
  }
}
