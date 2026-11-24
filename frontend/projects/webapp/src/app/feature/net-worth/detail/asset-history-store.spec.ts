import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import type { AssetHistoryResponse } from 'pulpe-shared';
import { ApiError } from '@core/api/api-error';
import { AssetApi } from '@core/asset/asset-api';
import { createMockDataCache } from '@core/testing';
import {
  HISTORY_ACCOUNT,
  HISTORY_ENTRIES,
  historyResponse,
} from '@app/testing/net-worth-fixtures';
import { AssetHistoryStore } from './asset-history-store';

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const CURSOR_1 = 'cursor-1';
const CURSOR_2 = 'cursor-2';

describe('AssetHistoryStore', () => {
  const cache = createMockDataCache();
  const getHistory$ = vi.fn();
  let store: AssetHistoryStore;

  const names = () =>
    store
      .entries()
      .map((entry) => (entry.type === 'movement' ? entry.name : entry.value));

  beforeEach(() => {
    cache.get.mockReturnValue(null);
    getHistory$.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AssetHistoryStore,
        { provide: AssetApi, useValue: { cache, getHistory$ } },
      ],
    });
    store = TestBed.inject(AssetHistoryStore);
  });

  async function open(first: AssetHistoryResponse): Promise<void> {
    getHistory$.mockReturnValueOnce(of(first));
    store.setAssetId(HISTORY_ACCOUNT.id);
    await settle();
  }

  it('loads nothing before it knows which asset to show', async () => {
    await settle();

    expect(getHistory$).not.toHaveBeenCalled();
    expect(store.asset()).toBeNull();
  });

  it('CA2, CA3: reads the asset and its first page for the routed id', async () => {
    await open(historyResponse());

    expect(getHistory$).toHaveBeenCalledWith(HISTORY_ACCOUNT.id);
    expect(store.asset()?.latestValue).toBe(9_420);
    expect(names()).toEqual([
      'Salaire',
      'Restaurant',
      'Loyer',
      5_000,
      'Assurance',
      4_800,
    ]);
    expect(store.hasMore()).toBe(false);
  });

  it('CA11: appends the next pages until the server says there are no more', async () => {
    await open(
      historyResponse({
        entries: HISTORY_ENTRIES.slice(0, 2),
        nextCursor: CURSOR_1,
      }),
    );
    getHistory$
      .mockReturnValueOnce(
        of(
          historyResponse({
            entries: HISTORY_ENTRIES.slice(2, 4),
            nextCursor: CURSOR_2,
          }),
        ),
      )
      .mockReturnValueOnce(
        of(
          historyResponse({
            entries: HISTORY_ENTRIES.slice(4),
            nextCursor: null,
          }),
        ),
      );

    await store.loadMore();
    expect(getHistory$).toHaveBeenLastCalledWith(HISTORY_ACCOUNT.id, CURSOR_1);
    expect(store.hasMore()).toBe(true);

    await store.loadMore();
    expect(getHistory$).toHaveBeenLastCalledWith(HISTORY_ACCOUNT.id, CURSOR_2);
    expect(names()).toEqual([
      'Salaire',
      'Restaurant',
      'Loyer',
      5_000,
      'Assurance',
      4_800,
    ]);
    expect(store.hasMore()).toBe(false);

    await store.loadMore();
    expect(getHistory$).toHaveBeenCalledTimes(3);
  });

  it('PUL-380: keeps the month-end projection of the latest page loaded', async () => {
    await open(
      historyResponse({
        monthEndProjection: { month: 11, year: 2026, value: 8_000 },
        nextCursor: CURSOR_1,
      }),
    );
    expect(store.monthEndProjection()?.value).toBe(8_000);

    getHistory$.mockReturnValueOnce(
      of(
        historyResponse({
          entries: [],
          monthEndProjection: { month: 11, year: 2026, value: 7_900 },
          nextCursor: null,
        }),
      ),
    );
    await store.loadMore();

    expect(store.monthEndProjection()?.value).toBe(7_900);
  });

  it('PUL-380: reads a missing projection as none', async () => {
    await open(historyResponse());

    expect(store.monthEndProjection()).toBeNull();
  });

  it('drops a second scroll while a page is on its way', async () => {
    await open(historyResponse({ nextCursor: CURSOR_1 }));
    const page = new Subject<AssetHistoryResponse>();
    getHistory$.mockReturnValueOnce(page);

    const first = store.loadMore();
    await store.loadMore();
    page.next(historyResponse({ entries: [], nextCursor: null }));
    page.complete();
    await first;

    expect(getHistory$).toHaveBeenCalledTimes(2);
  });

  it('CA8, CA9: starts again from the new first page when the history moved', async () => {
    await open(
      historyResponse({
        entries: HISTORY_ENTRIES.slice(0, 3),
        nextCursor: CURSOR_1,
      }),
    );
    getHistory$.mockReturnValueOnce(
      of(
        historyResponse({
          entries: HISTORY_ENTRIES.slice(3),
          nextCursor: null,
        }),
      ),
    );
    await store.loadMore();
    expect(store.entries()).toHaveLength(6);

    // Restaurant unchecked in its budget: the asset cache refetches the first page.
    getHistory$.mockReturnValueOnce(
      of(
        historyResponse({
          asset: { ...HISTORY_ACCOUNT, latestValue: 9_500 },
          entries: [HISTORY_ENTRIES[0], HISTORY_ENTRIES[2]],
          nextCursor: CURSOR_2,
        }),
      ),
    );
    store.reload();
    await settle();

    expect(store.asset()?.latestValue).toBe(9_500);
    expect(names()).toEqual(['Salaire', 'Loyer']);
    expect(store.hasMore()).toBe(true);
  });

  it('keeps a late page out of a history that moved meanwhile', async () => {
    await open(historyResponse({ nextCursor: CURSOR_1 }));
    const late = new Subject<AssetHistoryResponse>();
    getHistory$.mockReturnValueOnce(late);
    const loading = store.loadMore();

    getHistory$.mockReturnValueOnce(
      of(historyResponse({ entries: [HISTORY_ENTRIES[0]], nextCursor: null })),
    );
    store.reload();
    await settle();
    late.next(
      historyResponse({ entries: [HISTORY_ENTRIES[5]], nextCursor: null }),
    );
    late.complete();
    await loading;

    expect(names()).toEqual(['Salaire']);
  });

  it('says when the next page failed, and loads it on retry', async () => {
    await open(historyResponse({ nextCursor: CURSOR_1 }));
    getHistory$
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(
        of(historyResponse({ entries: [], nextCursor: null })),
      );

    await store.loadMore();
    expect(store.loadMoreFailed()).toBe(true);
    expect(store.hasMore()).toBe(true);

    await store.loadMore();
    expect(store.loadMoreFailed()).toBe(false);
    expect(store.hasMore()).toBe(false);
  });

  it('CA15: tells an unknown or archived asset apart from a failed load', async () => {
    getHistory$.mockReturnValueOnce(
      throwError(
        () => new ApiError('Not found', 'ERR_ASSET_NOT_FOUND', 404, undefined),
      ),
    );
    store.setAssetId(HISTORY_ACCOUNT.id);
    await settle();

    expect(store.isNotFound()).toBe(true);
    expect(store.asset()).toBeNull();
  });

  it('does not take a failed load for a missing asset', async () => {
    getHistory$.mockReturnValueOnce(
      throwError(
        () => new ApiError('Boom', 'ASSET_FETCH_FAILED', 500, undefined),
      ),
    );
    store.setAssetId(HISTORY_ACCOUNT.id);
    await settle();

    expect(store.isNotFound()).toBe(false);
    expect(store.firstPage.status()).toBe('error');
  });
});
