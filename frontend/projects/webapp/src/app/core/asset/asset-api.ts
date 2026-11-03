import { inject, Service } from '@angular/core';
import type { Observable } from 'rxjs';
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
import { DataCache } from 'ngx-ziflux';

/**
 * « Mon patrimoine » client. Every figure comes from `getNetWorth$` (the
 * server computes totals, subtotals and conversions at today's rate): the web
 * only displays them. One cache, shared by the page and, later, the
 * reconciliation and prévision pickers.
 */
@Service()
export class AssetApi {
  readonly #api = inject(ApiClient);
  readonly cache = new DataCache({
    name: 'assets',
    staleTime: 30_000,
    expireTime: 300_000,
  });

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
    return this.#api.delete$(`/assets/${id}`, assetDeleteResponseSchema);
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
