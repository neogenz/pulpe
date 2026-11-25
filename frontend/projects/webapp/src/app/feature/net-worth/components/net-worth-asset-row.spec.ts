import {
  Component,
  LOCALE_ID,
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
  recordedValue: 1234.5,
  latestValue: 1234.5,
  latestRecordedAt: new Date().toISOString(),
  convertedValue: 1234.5,
  suggestion: null,
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
          [busy]="busy()"
          [isDefault]="isDefault()"
          (action)="events.push($event)"
        />
      </li>
    </ul>
  `,
})
class HostComponent {
  readonly asset = signal<Asset>(asset);
  readonly categoryName = signal<string | null>(null);
  readonly busy = signal(false);
  readonly isDefault = signal(false);
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
        { provide: LOCALE_ID, useValue: 'fr-FR' },
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

  it('tells which account the reconciliation follows', () => {
    render({ inPulpe: true });

    expect(text('asset-linked-note')).toBe('· à la comparaison');
  });

  it('CA1: opens the detail from a tap on the row, beside the menu and never around it', () => {
    render();
    const row = fixture.nativeElement.querySelector(
      '[data-testid="asset-row-open-button"]',
    ) as HTMLButtonElement;

    expect(row.querySelector('button')).toBeNull();
    row.click();

    expect(fixture.componentInstance.events).toEqual([
      { asset, action: 'open' },
    ]);
  });

  it('CA15: leaves an archived row untappable', () => {
    render({ archivedAt: '2026-10-01T00:00:00.000Z' });

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="asset-row-open-button"]',
      ),
    ).toBeNull();
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

  describe('what moved since my last entry', () => {
    const livret = {
      name: 'Livret',
      recordedValue: 10_000,
      latestValue: 10_500,
      latestRecordedAt: `${new Date().getFullYear()}-11-03T10:00:00.000Z`,
    };

    it('replaces « Mis à jour » with the signed amount and the date of my entry', () => {
      render(livret);

      expect(text('asset-row-value')).toContain('10’500.00');
      expect(text('asset-row-meta')).toBe(
        '+500.00 CHF depuis ta saisie du 3 novembre',
      );
      // The date never wraps between the day and the month on a phone.
      expect(
        fixture.nativeElement.querySelector('[data-testid="asset-row-meta"]')
          .textContent,
      ).toContain('3 novembre');
    });

    it('should write an entry of the first of the month as « 1er » in French', () => {
      render({
        ...livret,
        latestRecordedAt: `${new Date().getFullYear()}-11-01T10:00:00.000Z`,
      });

      expect(text('asset-row-meta')).toBe(
        '+500.00 CHF depuis ta saisie du 1er novembre',
      );
    });

    it('keeps the category of a debt and signs what was repaid', () => {
      render(
        {
          direction: 'owe',
          recordedValue: 8000,
          latestValue: 7700,
          latestRecordedAt: livret.latestRecordedAt,
        },
        'Leasing',
      );

      expect(text('asset-row-meta')).toBe(
        'Leasing · −300.00 CHF depuis ta saisie du 3 novembre',
      );
    });

    it('names the year of an entry made in an earlier year', () => {
      render({ ...livret, latestRecordedAt: '2020-11-03T10:00:00.000Z' });

      expect(text('asset-row-meta')).toBe(
        '+500.00 CHF depuis ta saisie du 3 novembre 2020',
      );
    });

    it('keeps the comparison suffix of a followed account', () => {
      render({ ...livret, inPulpe: true });

      expect(text('asset-row-meta')).toBe(
        '+500.00 CHF depuis ta saisie du 3 novembre · à la comparaison',
      );
    });

    it('says only when it was updated once nothing moved', () => {
      render({ recordedValue: 10_000, latestValue: 10_000 });

      expect(text('asset-row-meta')).toMatch(/^Mis à jour aujourd.hui$/);
    });

    it('never offers a proposal, even from a payload that still carries one', () => {
      render({ ...livret, suggestion: { delta: 500, proposedValue: 10_500 } });

      const row = fixture.nativeElement.textContent;
      expect(row).not.toContain('Je propose');
      expect(row).not.toContain('Appliquer');
      expect(row).not.toContain('Écarter');
    });
  });

  it('emits the chosen menu action with its asset', () => {
    render();

    fixture.nativeElement
      .querySelector('[data-testid="asset-row-menu-button"]')
      .click();
    fixture.detectChanges();
    document
      .querySelector<HTMLElement>('[data-testid="asset-edit-action"]')!
      .click();

    expect(fixture.componentInstance.events).toEqual([
      { asset, action: 'edit' },
    ]);
  });

  it('locks the actions menu while a write is running', () => {
    fixture.componentInstance.busy.set(true);
    render();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="asset-row-menu-button"]',
      ).disabled,
    ).toBe(true);
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
  // Large text (200 %) left one letter of the name beside the amount.
  it('keeps a few letters of the name, the amount wrapping below instead', () => {
    render();

    const name = fixture.nativeElement.querySelector(
      '[data-testid="asset-row-name"]',
    ) as HTMLElement;
    expect(name.parentElement?.classList).toContain('min-w-[8ch]');
  });

  describe('default account (PUL-378)', () => {
    const openMenu = () => {
      fixture.nativeElement
        .querySelector('[data-testid="asset-row-menu-button"]')
        .click();
      fixture.detectChanges();
    };
    const defaultEntry = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="asset-default-action"]',
      );

    it('CA47: the default account carries the badge, the others do not', () => {
      render({ name: 'Compte courant' });
      expect(text('asset-default-chip')).toBeNull();

      fixture.componentInstance.isDefault.set(true);
      fixture.detectChanges();

      expect(text('asset-default-chip')).toBe('Par défaut');
    });

    it('CA47: offers « Utiliser par défaut dans le budget » and emits setDefault', () => {
      render({ name: 'Revolut' });

      openMenu();

      expect(defaultEntry()!.textContent).toContain(
        'Utiliser par défaut dans le budget',
      );
      defaultEntry()!.click();
      expect(fixture.componentInstance.events.at(-1)).toEqual({
        asset: { ...asset, name: 'Revolut' },
        action: 'setDefault',
      });
    });

    it('CA34, CA47: on the default account the entry becomes « Ne plus utiliser par défaut »', () => {
      fixture.componentInstance.isDefault.set(true);
      render({ name: 'Compte courant' });

      openMenu();

      expect(defaultEntry()!.textContent).toContain(
        'Ne plus utiliser par défaut',
      );
      defaultEntry()!.click();
      expect(fixture.componentInstance.events.at(-1)?.action).toBe(
        'unsetDefault',
      );
    });

    it('offers no default entry on an archived item', () => {
      render({ archivedAt: '2026-10-01T08:00:00.000Z' });

      openMenu();

      expect(defaultEntry()).toBeNull();
    });
  });
});
