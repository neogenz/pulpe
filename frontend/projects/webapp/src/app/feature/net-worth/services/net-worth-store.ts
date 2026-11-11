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
import {
  resolveAssetCategory,
  type CategoryChoice,
} from '@core/asset/asset-category';
import { injectNetWorthResource } from '@core/asset/net-worth';

export interface AssetCreateRequest {
  asset: Omit<AssetCreate, 'categoryId'>;
  category: CategoryChoice;
}

/** Only what changed; `value` is the new signed value of today. */
export interface AssetEditRequest {
  updates?: Pick<AssetUpdate, 'name'>;
  category?: CategoryChoice;
  value?: number;
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

  /** Patches the name and the Type, then records the value: each only when present. */
  saveAsset(
    id: string,
    { updates, category, value }: AssetEditRequest,
  ): Promise<void> {
    return this.#run(async () => {
      if (updates || category) {
        const categoryId = category && (await this.#resolveCategory(category));
        await firstValueFrom(
          this.#api.update$(id, {
            ...updates,
            ...(categoryId && { categoryId }),
          }),
        );
      }
      if (value !== undefined) {
        await firstValueFrom(
          this.#api.recordSnapshots$({ items: [{ assetId: id, value }] }),
        );
      }
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

  renameCategory(id: string, name: string): Promise<void> {
    return this.#run(() =>
      firstValueFrom(this.#api.updateCategory$(id, { name })),
    );
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

  #resolveCategory(choice: CategoryChoice): Promise<string> {
    return resolveAssetCategory(this.#api, this.categories(), choice);
  }
}
