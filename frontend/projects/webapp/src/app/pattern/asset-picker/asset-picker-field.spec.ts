import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatSelect, type MatSelectChange } from '@angular/material/select';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Asset,
  AssetDirection,
  NetWorth,
  TransactionKind,
} from 'pulpe-shared';
import { AssetApi } from '@core/asset/asset-api';
import { createMockDataCache } from '@core/testing';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { assetDirectionForKind } from '@core/asset/net-worth';
import { AssetPickerField } from './asset-picker-field';

const SAVINGS_CATEGORY_ID = '00000000-0000-4000-8000-0000000000c1';
const DEBTS_CATEGORY_ID = '00000000-0000-4000-8000-0000000000c2';

const buildAsset = (overrides: Partial<Asset>): Asset => ({
  id: '00000000-0000-4000-8000-000000000a01',
  categoryId: SAVINGS_CATEGORY_ID,
  name: 'Livret',
  currency: 'CHF',
  direction: 'own',
  inPulpe: false,
  archivedAt: null,
  latestValue: 1_000,
  latestRecordedAt: '2026-11-01T08:00:00.000Z',
  convertedValue: 1_000,
  suggestion: null,
  ...overrides,
});

const livret = buildAsset({ id: '00000000-0000-4000-8000-000000000a01' });
const placement = buildAsset({
  id: '00000000-0000-4000-8000-000000000a02',
  name: '3e pilier',
});
const oldLivret = buildAsset({
  id: '00000000-0000-4000-8000-000000000a03',
  name: 'Ancien livret',
  archivedAt: '2026-10-01T08:00:00.000Z',
});
const leasing = buildAsset({
  id: '00000000-0000-4000-8000-000000000a04',
  categoryId: DEBTS_CATEGORY_ID,
  name: 'Leasing',
  direction: 'owe',
});

const netWorth = (assets: Asset[]): { data: NetWorth; success: true } => ({
  success: true,
  data: {
    totals: {
      baseCurrency: 'CHF',
      gross: 0,
      debts: 0,
      net: 0,
      incomplete: false,
    },
    categories: [
      { id: SAVINGS_CATEGORY_ID, name: 'Épargne', total: 0 },
      { id: DEBTS_CATEGORY_ID, name: 'Dettes', total: 0 },
    ],
    assets,
  },
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/** Drives the very output the template listens to, so the pick counts as the user's. */
const pickInSelect = (
  fixture: ComponentFixture<AssetPickerField>,
  assetId: string | null,
): void =>
  fixture.debugElement
    .query(By.directive(MatSelect))
    .componentInstance.selectionChange.emit({
      value: assetId,
    } as MatSelectChange);

describe('AssetPickerField', () => {
  const getNetWorth$ = vi.fn();
  const mockCache = createMockDataCache();

  beforeEach(async () => {
    getNetWorth$.mockReset();
    mockCache.get.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [AssetPickerField],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: AssetApi, useValue: { cache: mockCache, getNetWorth$ } },
      ],
    }).compileComponents();
  });

  const render = async (
    direction: AssetDirection,
    value: string | null = null,
    kind: TransactionKind | null = null,
  ): Promise<ComponentFixture<AssetPickerField>> => {
    const fixture = TestBed.createComponent(AssetPickerField);
    fixture.componentRef.setInput('direction', direction);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    return fixture;
  };

  const openAndReadOptions = async (
    fixture: ComponentFixture<AssetPickerField>,
  ): Promise<string[]> => {
    fixture.nativeElement
      .querySelector('.mat-mdc-select-trigger')
      .dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await settle();
    return Array.from(
      document.querySelectorAll('.cdk-overlay-container mat-option'),
    ).map((option) => (option.textContent ?? '').replace(/\s+/g, ' ').trim());
  };

  const label = (fixture: ComponentFixture<AssetPickerField>): string =>
    fixture.nativeElement.querySelector('mat-label').textContent.trim();

  it('offers « Aucun » first, then only the active assets owned, each with its category', async () => {
    getNetWorth$.mockReturnValue(
      of(netWorth([livret, oldLivret, leasing, placement])),
    );
    const fixture = await render('own');

    expect(label(fixture)).toBe('Versée sur');
    expect(await openAndReadOptions(fixture)).toEqual([
      'Aucun',
      'Livret · Épargne',
      '3e pilier · Épargne',
    ]);
  });

  it('offers only the debts for the owe direction, with the debt label', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret, leasing])));
    const fixture = await render('owe');

    expect(label(fixture)).toBe('Dette remboursée');
    expect(await openAndReadOptions(fixture)).toEqual([
      'Aucun',
      'Leasing · Dettes',
    ]);
  });

  it('keeps the linked asset listed once archived, so the select does not look empty', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret, oldLivret])));
    const fixture = await render('own', oldLivret.id);

    expect(await openAndReadOptions(fixture)).toEqual([
      'Aucun',
      'Livret · Épargne',
      'Ancien livret · Épargne',
    ]);
  });

  it('emits the picked asset id, and null for « Aucun »', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret])));
    const fixture = await render('own');
    const emitted = vi.spyOn(fixture.componentInstance.valueChanged, 'emit');

    pickInSelect(fixture, livret.id);
    pickInSelect(fixture, null);

    expect(emitted).toHaveBeenNthCalledWith(1, livret.id);
    expect(emitted).toHaveBeenNthCalledWith(2, null);
  });

  it('shows only the asset name in the closed field, without its category', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret])));
    const fixture = await render('own', livret.id);

    expect(
      fixture.nativeElement
        .querySelector('.mat-mdc-select-value')
        .textContent.trim(),
    ).toBe('Livret');
  });

  it('shows the repayment hint only once a debt is chosen', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([leasing])));
    const fixture = await render('owe');
    const hint = () =>
      fixture.debugElement.query(By.css('[data-testid="asset-picker-hint"]'));

    expect(hint()).toBeNull();

    fixture.componentRef.setInput('value', leasing.id);
    fixture.detectChanges();

    expect(hint().nativeElement.textContent.trim()).toBe(
      "Une fois pointée, je te propose de baisser ce qu'il reste dû sur Leasing.",
    );
  });

  it('never shows the repayment hint for an owned asset', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret])));
    const fixture = await render('own', livret.id);

    expect(
      fixture.debugElement.query(By.css('[data-testid="asset-picker-hint"]')),
    ).toBeNull();
  });

  it('labels the field « Tiré de » for a Revenu, over the owned assets only', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret, oldLivret, leasing])));
    const fixture = await render('own', null, 'income');

    expect(label(fixture)).toBe('Tiré de');
    expect(await openAndReadOptions(fixture)).toEqual([
      'Aucun',
      'Livret · Épargne',
    ]);
  });

  it('shows the value hint for a Revenu only once an asset is chosen', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret])));
    const fixture = await render('own', null, 'income');
    const hint = () =>
      fixture.debugElement.query(By.css('[data-testid="asset-picker-hint"]'));

    expect(hint()).toBeNull();

    fixture.componentRef.setInput('value', livret.id);
    fixture.detectChanges();

    expect(hint().nativeElement.textContent.trim()).toBe(
      'Une fois pointé, je te propose de baisser la valeur de Livret.',
    );
  });

  it('renders nothing when no asset fits the direction', async () => {
    getNetWorth$.mockReturnValue(of(netWorth([livret, oldLivret])));
    const fixture = await render('owe');

    expect(fixture.debugElement.query(By.directive(MatSelect))).toBeNull();
  });

  it('renders nothing when the read fails', async () => {
    getNetWorth$.mockReturnValue(throwError(() => new Error('network')));
    const fixture = await render('own');

    expect(fixture.debugElement.query(By.directive(MatSelect))).toBeNull();
  });
});

describe('assetDirectionForKind', () => {
  it.each([
    ['saving', 'own'],
    ['expense', 'owe'],
    ['income', null],
  ] as const)('maps %s to %s', (kind, direction) => {
    expect(assetDirectionForKind(kind)).toBe(direction);
  });
});
