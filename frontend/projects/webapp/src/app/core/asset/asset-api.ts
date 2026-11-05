import { effect, inject, Service, untracked } from '@angular/core';
import { type Observable, tap } from 'rxjs';
import {
  type AssetCategoryCreate,
  assetCategoryCreateSchema,
  type AssetCategoryDeleteResponse,
  assetCategoryDeleteResponseSchema,
  type AssetCategoryResponse,
  assetCategoryResponseSchema,
  type AssetCategoryUpdate,
  assetCategoryUpdateSchema,
  type AssetCreate,
  assetCreateSchema,
  type AssetDeleteResponse,
  assetDeleteResponseSchema,
  type AssetResponse,
  assetResponseSchema,
  type AssetSnapshotsCreate,
  assetSnapshotsCreateSchema,
  type AssetSnapshotsResponse,
  assetSnapshotsResponseSchema,
  type AssetUpdate,
  assetUpdateSchema,
  type NetWorthResponse,
  netWorthResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { DataCache } from 'ngx-ziflux';

/** The entry the page and the reconciliation read, one request for both. */
export const NET_WORTH_CACHE_KEY = ['assets', 'net-worth'];

/**
 * « Mon patrimoine » client. Every figure comes from `getNetWorth$` (the
 * server computes totals, subtotals and conversions at today's rate): the web
 * only displays them. One cache, shared by the page, the reconciliation and
 * the prévision pickers.
 */
@Service()
export class AssetApi {
  readonly #api = inject(ApiClient);
  readonly #budgetApi = inject(BudgetApi);
  readonly #templatesApi = inject(BudgetTemplatesApi);
  readonly cache = new DataCache({
    name: 'assets',
    staleTime: 30_000,
    expireTime: 300_000,
  });

  constructor() {
    // Value suggestions are computed server-side from the checked prévisions
    // linked to an asset: any budget-domain mutation (checking one, linking
    // one…) makes them stale, so returning to the page shows them unreloaded.
    effect(() => {
      if (this.#budgetApi.cache.version() === 0) return;
      untracked(() => this.cache.invalidate(['assets']));
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getNetWorth$(): Observable<NetWorthResponse> {
    return this.#api.get$('/assets', netWorthResponseSchema);
  }

  create$(asset: AssetCreate): Observable<AssetResponse> {
    return this.#api.post$(
      '/assets',
      asset,
      assetResponseSchema,
      assetCreateSchema,
    );
  }

  update$(id: string, updates: AssetUpdate): Observable<AssetResponse> {
    return this.#api.patch$(
      `/assets/${id}`,
      updates,
      assetResponseSchema,
      assetUpdateSchema,
    );
  }

  delete$(id: string): Observable<AssetDeleteResponse> {
    // The server unlinks the prévisions that pointed at it: cached budgets and
    // templates would otherwise send the deleted id back on their next edit.
    return this.#api.delete$(`/assets/${id}`, assetDeleteResponseSchema).pipe(
      tap(() => {
        this.#budgetApi.cache.invalidate(['budget']);
        this.#templatesApi.cache.invalidate(['templates']);
      }),
    );
  }

  recordSnapshots$(
    snapshots: AssetSnapshotsCreate,
  ): Observable<AssetSnapshotsResponse> {
    return this.#api.post$(
      '/assets/snapshots',
      snapshots,
      assetSnapshotsResponseSchema,
      assetSnapshotsCreateSchema,
    );
  }

  dismissSuggestion$(id: string): Observable<AssetResponse> {
    return this.#api.post$(
      `/assets/${id}/dismiss-suggestion`,
      {},
      assetResponseSchema,
    );
  }

  createCategory$(
    category: AssetCategoryCreate,
  ): Observable<AssetCategoryResponse> {
    return this.#api.post$(
      '/asset-categories',
      category,
      assetCategoryResponseSchema,
      assetCategoryCreateSchema,
    );
  }

  updateCategory$(
    id: string,
    category: AssetCategoryUpdate,
  ): Observable<AssetCategoryResponse> {
    return this.#api.patch$(
      `/asset-categories/${id}`,
      category,
      assetCategoryResponseSchema,
      assetCategoryUpdateSchema,
    );
  }

  deleteCategory$(id: string): Observable<AssetCategoryDeleteResponse> {
    return this.#api.delete$(
      `/asset-categories/${id}`,
      assetCategoryDeleteResponseSchema,
    );
  }
}
