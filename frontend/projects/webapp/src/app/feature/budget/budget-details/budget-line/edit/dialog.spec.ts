import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  provideZonelessChangeDetection,
  signal,
  type Provider,
} from '@angular/core';
import { of, Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockBudgetLine } from '@app/testing/mock-factories';
import { PostHogService } from '@core/analytics/posthog';
import { AssetApi } from '@core/asset/asset-api';
import { CurrencyConverterService } from '@core/currency';
import { createMockDataCache } from '@core/testing';
import { UserSettingsStore } from '@core/user-settings';
import { TagStore } from '@core/tag';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import { createMockPostHogService } from '@app/testing/mock-posthog';
import type { Asset, BudgetLine, SupportedCurrency } from 'pulpe-shared';
import { EditBudgetLineDialog, type EditBudgetLineDialogData } from './dialog';

const TAG_ID = '00000000-0000-4000-8000-0000000000f1';
const ASSET_ID = '00000000-0000-4000-8000-0000000000f3';
const OTHER_ASSET_ID = '00000000-0000-4000-8000-0000000000f4';

interface SettingsMock {
  currency: ReturnType<typeof signal<SupportedCurrency>>;
  showCurrencySelector: ReturnType<typeof signal<boolean>>;
}
interface ConverterMock {
  convertWithMetadata: ReturnType<typeof vi.fn>;
}
interface DialogRefMock {
  close: ReturnType<typeof vi.fn>;
}

function configureDialog(
  budgetLine: BudgetLine,
  {
    userCurrency,
    providers = [],
  }: { userCurrency: SupportedCurrency; providers?: Provider[] },
) {
  const dialogRef: DialogRefMock = { close: vi.fn() };
  const settings: SettingsMock = {
    currency: signal<SupportedCurrency>(userCurrency),
    showCurrencySelector: signal(true),
  };
  const converter: ConverterMock = {
    convertWithMetadata: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [EditBudgetLineDialog, MatDialogModule, NoopAnimationsModule],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          budgetLine,
          budgetPeriod: { month: 1, year: 2026 },
        } satisfies EditBudgetLineDialogData,
      },
      { provide: UserSettingsStore, useValue: settings },
      { provide: CurrencyConverterService, useValue: converter },
      { provide: TagStore, useValue: createMockTagStore() },
      ...providers,
    ],
  });

  const fixture = TestBed.createComponent(EditBudgetLineDialog);
  const component = fixture.componentInstance;
  return { fixture, component, dialogRef, converter };
}

describe('EditBudgetLineDialog — currency edit rules', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows disabled picker and pre-fills originalAmount when line.originalCurrency differs from user currency', () => {
    const line = createMockBudgetLine({
      amount: 120,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.2,
    });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    expect(component['showCurrencySelector']()).toBe(true);
    expect(component['model']().money.amount).toBe(100);
  });

  it('hides picker and uses line.amount when originalCurrency equals user currency', () => {
    const line = createMockBudgetLine({
      amount: 500,
      originalAmount: 500,
      originalCurrency: 'CHF',
      targetCurrency: 'CHF',
      exchangeRate: 1,
    });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    expect(component['showCurrencySelector']()).toBe(false);
    expect(component['model']().money.amount).toBe(500);
  });

  it('hides picker on mono-currency lines (no originalCurrency)', () => {
    const line = createMockBudgetLine({ amount: 200 });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    expect(component['showCurrencySelector']()).toBe(false);
    expect(component['model']().money.amount).toBe(200);
  });

  it('on submit (mono-currency edit), PATCH does not include currency metadata (converter short-circuits same currency)', async () => {
    const line = createMockBudgetLine({ amount: 200 });

    const { component, dialogRef, converter } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 250,
      metadata: null,
    });

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 250 },
      name: 'Updated',
    }));

    await component.handleSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      250,
      'CHF',
      'CHF',
    );
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const patch = dialogRef.close.mock.calls[0][0];
    expect(patch.amount).toBe(250);
    expect(patch).not.toHaveProperty('originalAmount');
    expect(patch).not.toHaveProperty('originalCurrency');
    expect(patch).not.toHaveProperty('targetCurrency');
    expect(patch).not.toHaveProperty('exchangeRate');
  });

  it('carries the edited tag ids through the update patch', async () => {
    const line = createMockBudgetLine({ amount: 100, tagIds: [TAG_ID] });

    const { component, dialogRef, converter } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 100,
      metadata: null,
    });

    await component.handleSubmit();

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const patch = dialogRef.close.mock.calls[0][0];
    expect(patch.tagIds).toEqual([TAG_ID]);
  });

  it('on submit (alternate currency edit), converter is called with (amount, EUR, CHF) and PATCH includes fresh metadata', async () => {
    const line = createMockBudgetLine({
      amount: 120,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.2,
    });

    const { component, dialogRef, converter } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: 180,
      metadata: {
        originalAmount: 150,
        originalCurrency: 'EUR',
        targetCurrency: 'CHF',
        exchangeRate: 1.2,
      },
    });

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 150 },
    }));

    await component.handleSubmit();

    expect(converter.convertWithMetadata).toHaveBeenCalledWith(
      150,
      'EUR',
      'CHF',
    );
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    const patch = dialogRef.close.mock.calls[0][0];
    expect(patch.amount).toBe(180);
    expect(patch.originalAmount).toBe(150);
    expect(patch.originalCurrency).toBe('EUR');
    expect(patch.targetCurrency).toBe('CHF');
    expect(patch.exchangeRate).toBe(1.2);
  });

  it('blocks submit and sets conversionError when convertWithMetadata throws on alternate-currency edit', async () => {
    const line = createMockBudgetLine({
      amount: 120,
      originalAmount: 100,
      originalCurrency: 'EUR',
      targetCurrency: 'CHF',
      exchangeRate: 1.2,
    });

    const { component, dialogRef, converter } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    converter.convertWithMetadata.mockRejectedValue(new Error('rate down'));

    component['model'].update((m) => ({
      ...m,
      money: { ...m.money, amount: 150 },
    }));

    await component.handleSubmit();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component['conversionError']()).toBe(true);
  });

  it('originalCurrency falls back to null when budget line has no originalCurrency', () => {
    const line = createMockBudgetLine({ amount: 200 });

    const { component } = configureDialog(line, {
      userCurrency: 'CHF',
    });

    expect(component['originalCurrency']).toBe(null);
  });
});

describe('EditBudgetLineDialog — asset link', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const withNetWorthFlag = (isEnabled: boolean): Provider[] => {
    const postHog = createMockPostHogService();
    postHog.isFeatureEnabled.mockReturnValue(isEnabled);
    return [
      { provide: PostHogService, useValue: postHog },
      {
        provide: AssetApi,
        useValue: {
          cache: createMockDataCache(),
          getNetWorth$: () => new Subject(),
        },
      },
    ];
  };
  const submit = async (
    line: BudgetLine,
    isEnabled: boolean,
    edit?: (model: ReturnType<typeof configureDialog>['component']) => void,
  ) => {
    const { fixture, component, dialogRef, converter } = configureDialog(line, {
      userCurrency: 'CHF',
      providers: withNetWorthFlag(isEnabled),
    });
    converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: line.amount,
      metadata: null,
    });
    edit?.(component);
    fixture.detectChanges();
    await component.handleSubmit();
    return {
      fixture,
      patch: dialogRef.close.mock.calls[0][0],
    };
  };

  it('should offer no asset field and add no assetId key with the flag off', async () => {
    const line = createMockBudgetLine({ kind: 'saving', assetId: ASSET_ID });

    const { fixture, patch } = await submit(line, false);

    expect(
      fixture.nativeElement.querySelector('pulpe-asset-picker-field'),
    ).toBeNull();
    expect(patch).not.toHaveProperty('assetId');
  });

  it('should keep the linked asset in the patch when nothing changes', async () => {
    const line = createMockBudgetLine({ kind: 'saving', assetId: ASSET_ID });

    const { patch } = await submit(line, true);

    expect(patch.assetId).toBe(ASSET_ID);
  });

  it('should send the newly chosen asset', async () => {
    const line = createMockBudgetLine({ kind: 'saving', assetId: ASSET_ID });

    const { patch } = await submit(line, true, (component) =>
      component['model'].update((m) => ({ ...m, assetId: OTHER_ASSET_ID })),
    );

    expect(patch.assetId).toBe(OTHER_ASSET_ID);
  });

  it('should clear the asset when the kind changes, so an Épargne turned Dépense is not sent an own asset', async () => {
    const line = createMockBudgetLine({ kind: 'saving', assetId: ASSET_ID });

    const { patch } = await submit(line, true, (component) => {
      component['model'].update((m) => ({ ...m, kind: 'expense' }));
      component['onKindChange']();
    });

    expect(patch.assetId).toBeNull();
  });

  it('should offer own assets to a saving, debts to an expense, nothing to an income', () => {
    const { component } = configureDialog(
      createMockBudgetLine({ kind: 'saving' }),
      { userCurrency: 'CHF', providers: withNetWorthFlag(true) },
    );
    const direction = () => component['assetDirection']();

    expect(direction()).toBe('own');
    component['model'].update((m) => ({ ...m, kind: 'expense' }));
    expect(direction()).toBe('owe');
    component['model'].update((m) => ({ ...m, kind: 'income' }));
    expect(direction()).toBeNull();
  });
});

// Un revenu tiré du patrimoine garde son origine en lecture seule : elle se
// fixe à la création, aucune API ne la déplace.
describe('EditBudgetLineDialog — income drawn from an asset', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const livret: Asset = {
    id: ASSET_ID,
    categoryId: '00000000-0000-4000-8000-0000000000c1',
    name: 'Livret',
    currency: 'CHF',
    direction: 'own',
    inPulpe: false,
    archivedAt: null,
    latestValue: 3_000,
    latestRecordedAt: '2026-11-01T08:00:00.000Z',
    convertedValue: 3_000,
    suggestion: null,
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  const open = async (line: BudgetLine, isEnabled = true) => {
    const postHog = createMockPostHogService();
    postHog.isFeatureEnabled.mockReturnValue(isEnabled);
    const context = configureDialog(line, {
      userCurrency: 'CHF',
      providers: [
        { provide: PostHogService, useValue: postHog },
        {
          provide: AssetApi,
          useValue: {
            cache: createMockDataCache(),
            getNetWorth$: () =>
              of({
                success: true,
                data: {
                  totals: {
                    baseCurrency: 'CHF',
                    gross: 0,
                    debts: 0,
                    net: 0,
                    incomplete: false,
                  },
                  categories: [],
                  assets: [livret],
                },
              }),
          },
        },
      ],
    });
    context.converter.convertWithMetadata.mockResolvedValue({
      convertedAmount: line.amount,
      metadata: null,
    });
    context.fixture.detectChanges();
    await settle();
    context.fixture.detectChanges();
    return context;
  };
  const originLine = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector('[data-testid="asset-origin-line"]');

  it('names the asset read-only, with no picker, for a linked Revenu', async () => {
    const { fixture } = await open(
      createMockBudgetLine({ kind: 'income', assetId: ASSET_ID }),
    );

    const line = originLine(fixture)!;
    expect(line.textContent?.replace(/\s+/g, ' ')).toContain(
      'Pris sur · Livret',
    );
    expect(line.querySelector('mat-icon')?.textContent?.trim()).toBe(
      'account_balance_wallet',
    );
    expect(
      fixture.nativeElement.querySelector('pulpe-asset-picker-field'),
    ).toBeNull();
  });

  it('shows no origin for a Revenu without a link, or with the flag off', async () => {
    const unlinked = await open(
      createMockBudgetLine({ kind: 'income', assetId: null }),
    );
    expect(originLine(unlinked.fixture)).toBeNull();

    TestBed.resetTestingModule();
    const flagOff = await open(
      createMockBudgetLine({ kind: 'income', assetId: ASSET_ID }),
      false,
    );
    expect(originLine(flagOff.fixture)).toBeNull();
  });

  it('shows no origin line for an Épargne, which has its picker instead', async () => {
    const { fixture } = await open(
      createMockBudgetLine({ kind: 'saving', assetId: ASSET_ID }),
    );

    expect(originLine(fixture)).toBeNull();
    expect(
      fixture.nativeElement.querySelector('pulpe-asset-picker-field'),
    ).not.toBeNull();
  });

  it('keeps the link when the Revenu is saved', async () => {
    const { component, dialogRef } = await open(
      createMockBudgetLine({ kind: 'income', assetId: ASSET_ID }),
    );

    await component.handleSubmit();

    expect(dialogRef.close.mock.calls[0][0].assetId).toBe(ASSET_ID);
  });

  it('drops the origin line along with the link when the kind changes', async () => {
    const { fixture, component } = await open(
      createMockBudgetLine({ kind: 'income', assetId: ASSET_ID }),
    );

    component['model'].update((m) => ({ ...m, kind: 'expense' }));
    component['onKindChange']();
    fixture.detectChanges();

    expect(originLine(fixture)).toBeNull();
    expect(component['model']().assetId).toBeNull();
  });
});
