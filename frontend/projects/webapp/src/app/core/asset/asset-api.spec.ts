import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import type { NetWorth } from 'pulpe-shared';
import { createMockPostHogService } from '@app/testing/mock-posthog';
import { PostHogService } from '@core/analytics/posthog';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { AssetApi } from './asset-api';

const BASE_URL = 'http://localhost:3000/api/v1';
const ASSET_ID = '68c73361-c59b-4ce4-9e6a-0843505a08d5';
const CATEGORY_ID = '0b1c8a66-6f4e-4f55-9f2d-2f3c6a0c1d11';

const netWorth: NetWorth = {
  totals: {
    baseCurrency: 'CHF',
    gross: 1000,
    debts: 250,
    net: 750,
    incomplete: false,
  },
  categories: [{ id: CATEGORY_ID, name: 'Comptes', total: 1000 }],
  assets: [
    {
      id: ASSET_ID,
      categoryId: CATEGORY_ID,
      name: 'UBS',
      currency: 'CHF',
      direction: 'own',
      inPulpe: true,
      archivedAt: null,
      latestValue: 1000,
      latestRecordedAt: '2026-11-03T10:00:00.000Z',
      convertedValue: 1000,
    },
  ],
};

describe('AssetApi', () => {
  let api: AssetApi;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        AssetApi,
        { provide: PostHogService, useValue: createMockPostHogService() },
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => BASE_URL },
        },
      ],
    });

    api = TestBed.inject(AssetApi);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('getNetWorth$ GETs /assets and parses the totals, categories and assets', async () => {
    const response = firstValueFrom(api.getNetWorth$());

    const req = httpTesting.expectOne(`${BASE_URL}/assets`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: netWorth });

    expect((await response).data).toEqual(netWorth);
  });

  it('create$ POSTs the asset with its first value', async () => {
    const body = {
      name: 'Cash',
      categoryId: CATEGORY_ID,
      currency: 'CHF' as const,
      direction: 'own' as const,
      inPulpe: false,
      value: 150,
    };
    const response = firstValueFrom(api.create$(body));

    const req = httpTesting.expectOne(`${BASE_URL}/assets`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({
      success: true,
      data: { ...netWorth.assets[0], name: 'Cash', inPulpe: false },
    });

    expect((await response).data.name).toBe('Cash');
  });

  it('update$ PATCHes only the given fields', async () => {
    const response = firstValueFrom(api.update$(ASSET_ID, { archived: true }));

    const req = httpTesting.expectOne(`${BASE_URL}/assets/${ASSET_ID}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ archived: true });
    req.flush({ success: true, data: netWorth.assets[0] });

    await response;
  });

  it('update$ refuses an empty patch before any request', async () => {
    await expect(
      firstValueFrom(api.update$(ASSET_ID, {})),
    ).rejects.toMatchObject({ code: 'ZOD_PARSE_ERROR' });
  });

  it('recordSnapshots$ POSTs a batch of values and returns the shared date', async () => {
    const items = [{ assetId: ASSET_ID, value: -300 }];
    const response = firstValueFrom(api.recordSnapshots$({ items }));

    const req = httpTesting.expectOne(`${BASE_URL}/assets/snapshots`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ items });
    req.flush({
      success: true,
      data: { recordedAt: '2026-11-03T10:00:00.000Z' },
    });

    expect((await response).data.recordedAt).toBe('2026-11-03T10:00:00.000Z');
  });

  it('delete$ DELETEs the asset', async () => {
    const response = firstValueFrom(api.delete$(ASSET_ID));

    const req = httpTesting.expectOne(`${BASE_URL}/assets/${ASSET_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'deleted' });

    expect((await response).success).toBe(true);
  });

  it('manages categories under /asset-categories', async () => {
    const created = firstValueFrom(api.createCategory$({ name: 'Crypto' }));
    const createReq = httpTesting.expectOne(`${BASE_URL}/asset-categories`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({ name: 'Crypto' });
    createReq.flush({
      success: true,
      data: { id: CATEGORY_ID, name: 'Crypto' },
    });
    expect((await created).data.id).toBe(CATEGORY_ID);

    const renamed = firstValueFrom(
      api.updateCategory$(CATEGORY_ID, { name: 'Placements' }),
    );
    const renameReq = httpTesting.expectOne(
      `${BASE_URL}/asset-categories/${CATEGORY_ID}`,
    );
    expect(renameReq.request.method).toBe('PATCH');
    renameReq.flush({
      success: true,
      data: { id: CATEGORY_ID, name: 'Placements' },
    });
    expect((await renamed).data.name).toBe('Placements');

    const removed = firstValueFrom(api.deleteCategory$(CATEGORY_ID));
    const deleteReq = httpTesting.expectOne(
      `${BASE_URL}/asset-categories/${CATEGORY_ID}`,
    );
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true, message: 'deleted' });
    expect((await removed).success).toBe(true);
  });

  it('clearCache wipes every cached entry', () => {
    api.cache.set(['assets', 'net-worth'], netWorth);

    api.clearCache();

    expect(api.cache.get(['assets', 'net-worth'])).toBeNull();
  });
});
