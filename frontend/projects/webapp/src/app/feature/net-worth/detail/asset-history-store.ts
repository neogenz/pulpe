import { computed, inject, linkedSignal, Service, signal } from '@angular/core';
import { cachedResource } from 'ngx-ziflux';
import { firstValueFrom, map } from 'rxjs';
import * as z from 'zod';
import {
  API_ERROR_CODES,
  type AssetHistory,
  type AssetHistoryEntry,
} from 'pulpe-shared';
import { isApiError } from '@core/api/api-error';
import { AssetApi } from '@core/asset/asset-api';

interface LaterPages {
  entries: AssetHistoryEntry[];
  nextCursor: string | null;
  monthEndProjection: AssetHistory['monthEndProjection'] | null;
}

/**
 * The detail of one asset: the server's computed asset and its history. The
 * first page is cached under `['assets', …]`, so a check in a budget or a new
 * entry refetches it; the pages loaded by scrolling are appended after it and
 * dropped whenever it changes, since their cursors no longer line up.
 */
@Service({ autoProvided: false })
export class AssetHistoryStore {
  readonly #api = inject(AssetApi);
  readonly #assetId = signal<string | null>(null);
  // A typed or truncated address: the server would answer 400, not 404.
  readonly #isMalformedId = computed(() => {
    const id = this.#assetId();
    return id !== null && !z.uuid().safeParse(id).success;
  });

  readonly firstPage = cachedResource<AssetHistory, { id: string }>({
    cache: this.#api.cache,
    cacheKey: ({ id }) => ['assets', 'history', id],
    params: () => {
      const id = this.#assetId();
      return id && !this.#isMalformedId() ? { id } : undefined;
    },
    loader: ({ params }) =>
      this.#api.getHistory$(params.id).pipe(map((response) => response.data)),
  });

  readonly #laterPages = linkedSignal<
    AssetHistory | undefined,
    LaterPages | null
  >({ source: this.firstPage.value, computation: () => null });
  readonly #loadMoreFailed = linkedSignal({
    source: this.firstPage.value,
    computation: () => false,
  });
  readonly #isLoadingMore = signal(false);

  readonly asset = computed(() => this.firstPage.value()?.asset ?? null);
  readonly entries = computed<AssetHistoryEntry[]>(() => [
    ...(this.firstPage.value()?.entries ?? []),
    ...(this.#laterPages()?.entries ?? []),
  ]);
  readonly #nextCursor = computed(() => {
    const later = this.#laterPages();
    return later
      ? later.nextCursor
      : (this.firstPage.value()?.nextCursor ?? null);
  });
  readonly hasMore = computed(() => this.#nextCursor() !== null);
  /** From the latest page loaded: each page carries the projection of the moment. */
  readonly monthEndProjection = computed(() => {
    const later = this.#laterPages();
    return later
      ? later.monthEndProjection
      : (this.firstPage.value()?.monthEndProjection ?? null);
  });
  readonly isLoadingMore = this.#isLoadingMore.asReadonly();
  readonly loadMoreFailed = this.#loadMoreFailed.asReadonly();

  /** Unknown or archived (the server answers 404 for both), or not an id at all. */
  readonly isNotFound = computed(() => {
    if (this.#isMalformedId()) return true;
    const error = this.firstPage.error();
    return isApiError(error) && error.code === API_ERROR_CODES.ASSET_NOT_FOUND;
  });

  setAssetId(id: string): void {
    this.#assetId.set(id);
  }

  reload(): void {
    this.firstPage.reload();
  }

  /** Appends the next page; a second call while one is in flight is dropped. */
  async loadMore(): Promise<void> {
    const id = this.#assetId();
    const cursor = this.#nextCursor();
    const firstPage = this.firstPage.value();
    if (!id || !cursor || this.#isLoadingMore()) return;

    this.#isLoadingMore.set(true);
    this.#loadMoreFailed.set(false);
    try {
      const { data } = await firstValueFrom(this.#api.getHistory$(id, cursor));
      if (this.firstPage.value() !== firstPage) return;
      this.#laterPages.update((later) => ({
        entries: [...(later?.entries ?? []), ...data.entries],
        nextCursor: data.nextCursor,
        monthEndProjection: data.monthEndProjection ?? null,
      }));
    } catch {
      if (this.firstPage.value() === firstPage) this.#loadMoreFailed.set(true);
    } finally {
      this.#isLoadingMore.set(false);
    }
  }
}
