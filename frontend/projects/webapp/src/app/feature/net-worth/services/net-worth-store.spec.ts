import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import type { Asset, NetWorth } from 'pulpe-shared';
import { AssetApi } from '@core/asset/asset-api';
import { createMockDataCache } from '@core/testing';
import { NetWorthStore } from './net-worth-store';

const CHECKING = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';
const NEW_CATEGORY_ID = '33333333-3333-4333-8333-333333333333';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: ASSET_ID,
    categoryId: CHECKING,
    name: 'UBS',
    currency: 'CHF',
    direction: 'own',
    inPulpe: true,
    archivedAt: null,
    latestValue: 1000,
    latestRecordedAt: '2026-11-03T10:00:00.000Z',
    convertedValue: 1000,
    suggestion: null,
    ...overrides,
  };
}

const netWorth: NetWorth = {
  totals: {
    baseCurrency: 'CHF',
    gross: 1000,
    debts: 0,
    net: 1000,
    incomplete: false,
  },
  categories: [{ id: CHECKING, name: 'Comptes', total: 1000 }],
  assets: [
    makeAsset(),
    makeAsset({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Ancien',
      archivedAt: '2026-10-01T00:00:00.000Z',
    }),
  ],
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('NetWorthStore', () => {
  const cache = createMockDataCache();
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: NetWorthStore;

  beforeEach(() => {
    cache.get.mockReturnValue(null);
    cache.set.mockClear();
    cache.invalidate.mockClear();

    api = {
      getNetWorth$: vi
        .fn()
        .mockReturnValue(of({ success: true, data: netWorth })),
      create$: vi
        .fn()
        .mockReturnValue(of({ success: true, data: makeAsset() })),
      update$: vi
        .fn()
        .mockReturnValue(of({ success: true, data: makeAsset() })),
      delete$: vi.fn().mockReturnValue(of({ success: true, message: 'ok' })),
      recordSnapshots$: vi.fn().mockReturnValue(
        of({
          success: true,
          data: { recordedAt: '2026-11-03T10:00:00.000Z' },
        }),
      ),
      createCategory$: vi.fn().mockReturnValue(
        of({
          success: true,
          data: { id: NEW_CATEGORY_ID, name: 'Placements' },
        }),
      ),
      updateCategory$: vi.fn(),
      deleteCategory$: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        NetWorthStore,
        { provide: AssetApi, useValue: { ...api, cache } },
      ],
    });
    store = TestBed.inject(NetWorthStore);
  });

  it('exposes the API figures untouched and splits active from archived assets', async () => {
    await settle();

    expect(store.totals()).toEqual(netWorth.totals);
    expect(store.categories()).toEqual(netWorth.categories);
    expect(store.activeAssets().map((asset) => asset.name)).toEqual(['UBS']);
    expect(store.archivedAssets().map((asset) => asset.name)).toEqual([
      'Ancien',
    ]);
    expect(store.isEmpty()).toBe(false);
  });

  it('is empty without assets', async () => {
    api['getNetWorth$'].mockReturnValue(
      of({
        success: true,
        data: { ...netWorth, categories: [], assets: [] },
      }),
    );
    await settle();

    expect(store.isEmpty()).toBe(true);
  });

  it('adds an asset in an existing category without creating one', async () => {
    await store.addAsset({
      asset: {
        name: 'Cash',
        currency: 'CHF',
        direction: 'own',
        inPulpe: false,
        value: 150,
      },
      category: { id: CHECKING },
    });

    expect(api['createCategory$']).not.toHaveBeenCalled();
    expect(api['create$']).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cash', categoryId: CHECKING }),
    );
    expect(cache.invalidate).toHaveBeenCalledWith(['assets']);
  });

  it('creates a starter category once, then the asset inside it', async () => {
    await store.addAsset({
      asset: {
        name: 'ETF',
        currency: 'CHF',
        direction: 'own',
        inPulpe: false,
        value: 500,
      },
      category: { name: 'Placements' },
    });

    expect(api['createCategory$']).toHaveBeenCalledTimes(1);
    expect(api['createCategory$']).toHaveBeenCalledWith({
      name: 'Placements',
    });
    expect(api['create$']).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ETF', categoryId: NEW_CATEGORY_ID }),
    );
  });

  it('refetches and rethrows when the asset fails after its category was created', async () => {
    api['create$'].mockReturnValue(throwError(() => new Error('boom')));

    await expect(
      store.addAsset({
        asset: {
          name: 'ETF',
          currency: 'CHF',
          direction: 'own',
          inPulpe: false,
          value: 500,
        },
        category: { name: 'Placements' },
      }),
    ).rejects.toThrow('boom');

    expect(api['createCategory$']).toHaveBeenCalledTimes(1);
    expect(cache.invalidate).toHaveBeenCalledWith(['assets']);
  });

  it('edits an asset with its resolved category', async () => {
    await store.editAsset(ASSET_ID, {
      updates: { name: 'UBS Pro', inPulpe: false },
      category: { name: 'Placements' },
    });

    expect(api['update$']).toHaveBeenCalledWith(ASSET_ID, {
      name: 'UBS Pro',
      inPulpe: false,
      categoryId: NEW_CATEGORY_ID,
    });
  });

  it('records a signed value as a snapshot', async () => {
    await store.recordValue(ASSET_ID, -300);

    expect(api['recordSnapshots$']).toHaveBeenCalledWith({
      items: [{ assetId: ASSET_ID, value: -300 }],
    });
  });

  it('archives, unarchives and deletes through the API', async () => {
    await store.setArchived(ASSET_ID, true);
    await store.setArchived(ASSET_ID, false);
    await store.deleteAsset(ASSET_ID);

    expect(api['update$']).toHaveBeenNthCalledWith(1, ASSET_ID, {
      archived: true,
    });
    expect(api['update$']).toHaveBeenNthCalledWith(2, ASSET_ID, {
      archived: false,
    });
    expect(api['delete$']).toHaveBeenCalledWith(ASSET_ID);
  });

  it('surfaces a refused category deletion to the caller', async () => {
    const refusal = new Error('ASSET_CATEGORY_NOT_EMPTY');
    api['deleteCategory$'].mockReturnValue(throwError(() => refusal));

    await expect(store.deleteCategory(CHECKING)).rejects.toBe(refusal);
  });
});
