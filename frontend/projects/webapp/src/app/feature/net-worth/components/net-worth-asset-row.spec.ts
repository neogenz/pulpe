import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import type { Asset } from 'pulpe-shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { type AssetRowEvent, NetWorthAssetRow } from './net-worth-asset-row';

const asset: Asset = {
  id: '22222222-2222-4222-8222-222222222222',
  categoryId: '11111111-1111-4111-8111-111111111111',
  name: 'UBS',
  currency: 'CHF',
  direction: 'own',
  inPulpe: false,
  archivedAt: null,
  latestValue: 1234.5,
  latestRecordedAt: new Date().toISOString(),
  convertedValue: 1234.5,
};

@Component({
  imports: [NetWorthAssetRow],
  template: `
    <ul>
      <li>
        <pulpe-net-worth-asset-row
          [asset]="asset()"
          baseCurrency="CHF"
          [categoryName]="categoryName()"
          (action)="events.push($event)"
        />
      </li>
    </ul>
  `,
})
class HostComponent {
  readonly asset = signal<Asset>(asset);
  readonly categoryName = signal<string | null>(null);
  readonly events: AssetRowEvent[] = [];
}

describe('NetWorthAssetRow', () => {
  let fixture: ComponentFixture<HostComponent>;

  const render = (overrides: Partial<Asset> = {}, categoryName?: string) => {
    fixture.componentInstance.asset.set({ ...asset, ...overrides });
    fixture.componentInstance.categoryName.set(categoryName ?? null);
    fixture.detectChanges();
  };
  const text = (id: string) =>
    fixture.nativeElement
      .querySelector(`[data-testid="${id}"]`)
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ?? null;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
  });

  it('shows the signed latest value with two decimals and no conversion in the base currency', () => {
    render();

    expect(text('asset-row-name')).toBe('UBS');
    expect(text('asset-row-value')).toContain('1’234.50');
    expect(text('asset-row-converted')).toBeNull();
    expect(text('asset-overdraft-chip')).toBeNull();
  });

  it('flags an overdrawn own account and keeps its negative value', () => {
    render({ latestValue: -300, convertedValue: -300 });

    expect(text('asset-overdraft-chip')).toBe('Découvert');
    expect(text('asset-row-value')).toContain('-300.00');
  });

  it('does not flag an owe asset as an overdraft', () => {
    render({ direction: 'owe', latestValue: 300, convertedValue: 300 });

    expect(text('asset-overdraft-chip')).toBeNull();
  });

  it('shows the Pulpe link chip', () => {
    render({ inPulpe: true });

    expect(text('asset-in-pulpe-chip')).toBe('Dans Pulpe');
  });

  it('shows the converted value of a foreign asset, or says it is left out of the total', () => {
    render({ currency: 'EUR', latestValue: 1000, convertedValue: 950 });
    expect(text('asset-row-converted')).toContain('950.00');

    render({ currency: 'EUR', convertedValue: null });
    expect(text('asset-row-converted')).toBe('Hors total');
  });

  it('says nothing about the total on an archived foreign asset without conversion', () => {
    render({
      currency: 'EUR',
      convertedValue: null,
      archivedAt: '2026-10-01T00:00:00.000Z',
    });

    expect(text('asset-row-converted')).toBe('');
  });

  it('names the category in the meta line when asked to', () => {
    render({ direction: 'owe' }, 'Prêts');

    expect(text('asset-row-meta')).toContain('Prêts');
  });

  it('emits the chosen menu action with its asset', () => {
    render();

    fixture.nativeElement
      .querySelector('[data-testid="asset-row-menu-button"]')
      .click();
    fixture.detectChanges();
    document
      .querySelector<HTMLElement>('[data-testid="asset-update-value-action"]')!
      .click();

    expect(fixture.componentInstance.events).toEqual([
      { asset, action: 'updateValue' },
    ]);
  });

  it('offers unarchive instead of edit actions on an archived asset', () => {
    render({ archivedAt: '2026-10-01T00:00:00.000Z' });

    fixture.nativeElement
      .querySelector('[data-testid="asset-row-menu-button"]')
      .click();
    fixture.detectChanges();

    expect(
      document.querySelector('[data-testid="asset-unarchive-action"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-testid="asset-edit-action"]'),
    ).toBeNull();
  });
});
