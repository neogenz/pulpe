import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import {
  getBudgetPeriodDates,
  type Asset,
  type NetWorth,
  type SupportedCurrency,
} from 'pulpe-shared';

import { createMockPostHogService } from '@app/testing/mock-posthog';
import { PostHogService } from '@core/analytics/posthog';
import { AssetApi } from '@core/asset/asset-api';
import { createMockDataCache } from '@core/testing';
import {
  ReconcileAccountsDialog,
  type ReconcileAccountsDialogData,
} from './reconcile-accounts-dialog';
import { ReconcileAccountsDialogService } from './reconcile-accounts-dialog.service';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    categoryId: '99999999-9999-4999-8999-999999999999',
    name: 'Compte UBS',
    currency: 'CHF',
    direction: 'own',
    inPulpe: true,
    archivedAt: null,
    latestValue: 12000,
    latestRecordedAt: '2026-11-01T10:00:00.000Z',
    convertedValue: 12000,
    suggestion: null,
    ...overrides,
  };
}

function makeNetWorth(assets: Asset[]): NetWorth {
  return {
    totals: {
      baseCurrency: 'CHF',
      gross: 0,
      debts: 0,
      net: 0,
      incomplete: false,
    },
    categories: [],
    assets,
  };
}

const UBS = makeAsset();

function setup(
  options: { isFlagOn?: boolean; currency?: SupportedCurrency } = {},
) {
  const cache = createMockDataCache();
  let stored: { data: NetWorth; fresh: boolean } | null = null;
  cache.get.mockImplementation(() => stored);
  cache.prefetch.mockImplementation(
    async (_key: string[], fetch: () => Promise<NetWorth>) => {
      stored = { data: await fetch(), fresh: true };
    },
  );
  const assetApi = { cache, getNetWorth$: vi.fn() };
  const dialog = { open: vi.fn() };
  const postHog = createMockPostHogService();
  postHog.isFeatureEnabled.mockReturnValue(options.isFlagOn ?? true);

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: MatDialog, useValue: dialog },
      { provide: AssetApi, useValue: assetApi },
      { provide: PostHogService, useValue: postHog },
    ],
  });

  const data: Omit<ReconcileAccountsDialogData, 'linkedAccounts'> = {
    realized: signal(null),
    currency: signal(options.currency ?? 'CHF'),
    periodDates: signal(getBudgetPeriodDates(11, 2026)),
    recordAdjustment: vi.fn(),
    viewItemsToCheck: vi.fn(),
  };
  const openedData = () => {
    const [, config] = dialog.open.mock.calls[0] as [
      unknown,
      MatDialogConfig<ReconcileAccountsDialogData>,
    ];
    return config.data;
  };

  return {
    service: TestBed.inject(ReconcileAccountsDialogService),
    cache,
    assetApi,
    dialog,
    postHog,
    data,
    openedData,
    seed(assets: Asset[]) {
      assetApi.getNetWorth$.mockReturnValue(
        of({ success: true, data: makeNetWorth(assets) }),
      );
    },
  };
}

describe('ReconcileAccountsDialogService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should open at once on no linked account when the flag is off', () => {
    const view = setup({ isFlagOn: false });
    view.seed([UBS]);

    void view.service.open(view.data, false);

    expect(view.dialog.open).toHaveBeenCalledTimes(1);
    expect(view.dialog.open).toHaveBeenCalledWith(
      ReconcileAccountsDialog,
      expect.objectContaining({ disableClose: true }),
    );
    expect(view.openedData()?.linkedAccounts).toEqual([]);
    expect(view.assetApi.getNetWorth$).not.toHaveBeenCalled();
  });

  it('should keep the active in-Pulpe accounts of the budget currency', async () => {
    const view = setup();
    view.seed([
      UBS,
      makeAsset({ id: 'a-livret', name: 'Livret', inPulpe: false }),
      makeAsset({ id: 'a-eur', name: 'Compte EUR', currency: 'EUR' }),
      makeAsset({
        id: 'a-old',
        name: 'Ancien',
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
      makeAsset({ id: 'a-debt', name: 'Prêt', direction: 'owe' }),
    ]);

    await view.service.open(view.data, false);

    expect(view.openedData()?.linkedAccounts).toEqual([UBS]);
  });

  it('should follow the currency of the budget', async () => {
    const view = setup({ currency: 'EUR' });
    const eur = makeAsset({ id: 'a-eur', name: 'Compte EUR', currency: 'EUR' });
    view.seed([UBS, eur]);

    await view.service.open(view.data, false);

    expect(view.openedData()?.linkedAccounts).toEqual([eur]);
  });

  it('should read through the shared cache and skip the request when it is fresh', async () => {
    const view = setup();
    view.seed([UBS]);
    await view.service.open(view.data, false);

    await view.service.open(view.data, false);

    expect(view.cache.prefetch).toHaveBeenCalledTimes(1);
    expect(view.cache.prefetch).toHaveBeenCalledWith(
      ['assets', 'net-worth'],
      expect.any(Function),
    );
    expect(view.assetApi.getNetWorth$).toHaveBeenCalledTimes(1);
    expect(view.dialog.open).toHaveBeenCalledTimes(2);
  });

  it('should open on no linked account when the read fails', async () => {
    const view = setup();
    view.assetApi.getNetWorth$.mockReturnValue(
      throwError(() => new Error('offline')),
    );

    await view.service.open(view.data, false);

    expect(view.dialog.open).toHaveBeenCalledTimes(1);
    expect(view.openedData()?.linkedAccounts).toEqual([]);
  });

  it('should wait for a slow read and open once, whatever the clicks in between', async () => {
    const view = setup();
    const response = new Subject<{ success: true; data: NetWorth }>();
    view.assetApi.getNetWorth$.mockReturnValue(response);

    const opening = view.service.open(view.data, false);
    await view.service.open(view.data, false);
    expect(view.dialog.open).not.toHaveBeenCalled();

    response.next({ success: true, data: makeNetWorth([UBS]) });
    await opening;

    expect(view.dialog.open).toHaveBeenCalledTimes(1);
    expect(view.openedData()?.linkedAccounts).toEqual([UBS]);
  });

  it('should frame the dialog full-height on a phone and centred elsewhere', async () => {
    const view = setup({ isFlagOn: false });

    await view.service.open(view.data, true);
    await view.service.open(view.data, false);

    const [phone, desktop] = view.dialog.open.mock.calls.map(
      ([, config]) => config as MatDialogConfig,
    );
    expect(phone.panelClass).toBe('full-screen-dialog');
    expect(phone.height).toBe('100dvh');
    expect(desktop.panelClass).toBeUndefined();
    expect(desktop.width).toBe('560px');
  });
});
