import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Asset } from 'pulpe-shared';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  ReconcileAccountsStep,
  summarizeRows,
  type AccountRow,
} from './reconcile-accounts-step';

const FREE = { kind: 'free' } as const;
const row = (id: number, over: Partial<AccountRow> = {}): AccountRow => ({
  id,
  label: `Compte ${id}`,
  amountText: '',
  side: 'own',
  account: FREE,
  ...over,
});
const asset = (id: string, over: Partial<Asset> = {}): Asset => ({
  id,
  categoryId: 'cat',
  name: id,
  currency: 'CHF',
  direction: 'own',
  inPulpe: false,
  archivedAt: null,
  recordedValue: 0,
  latestValue: 0,
  latestRecordedAt: '2026-11-01T00:00:00.000Z',
  convertedValue: 0,
  suggestion: null,
  ...over,
});

describe('summarizeRows', () => {
  it('should subtract what I owe and wait for every amount to read', () => {
    const rows = [
      row(0, { amountText: '3000' }),
      row(1, { amountText: '1000' }),
      row(2, { amountText: '800', side: 'owe' }),
    ];

    expect(summarizeRows(rows)).toMatchObject({
      totalCents: 320000,
      ownCents: 400000,
      oweCents: 80000,
      hasOwe: true,
    });
    expect(
      summarizeRows([...rows, row(3, { amountText: '12abc' })]).totalCents,
    ).toBeNull();
  });

  it('should count what I owe against the total whatever sign was typed', () => {
    const total = (owe: string) =>
      summarizeRows([
        row(0, { amountText: '3000' }),
        row(1, { amountText: owe, side: 'owe' }),
      ]);

    expect(total('-800')).toMatchObject({
      totalCents: 220000,
      oweCents: 80000,
    });
    expect(total('800').totalCents).toBe(220000);
    expect(
      summarizeRows([
        row(0, { amountText: '3000' }),
        row(1, { amountText: '800', side: 'owe' }),
        row(2, { amountText: '-200', side: 'owe' }),
      ]),
    ).toMatchObject({ totalCents: 200000, oweCents: 100000 });
  });
});

@Component({
  imports: [ReconcileAccountsStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<pulpe-reconcile-accounts-step
    [(accounts)]="rows"
    currency="CHF"
    [items]="items"
    [offers]="offers"
    [categories]="categories"
  />`,
})
class Host {
  readonly rows = signal<AccountRow[]>([]);
  items: Asset[] = [];
  offers: Asset[] = [];
  readonly categories = [{ id: 'cat', name: 'Comptes', total: 0 }];
}

describe('ReconcileAccountsStep', () => {
  let opened: unknown;
  let choice: unknown;
  let handset: boolean;

  const setup = async (
    rows: AccountRow[],
    offers: Asset[] = [],
    items: Asset[] = offers,
  ) => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        {
          provide: MatDialog,
          useValue: {
            open: (_c: unknown, config: unknown) => {
              opened = { frame: 'dialog', config };
              return { afterClosed: () => of(choice) };
            },
          },
        },
        {
          provide: MatBottomSheet,
          useValue: {
            open: (_c: unknown, config: unknown) => {
              opened = { frame: 'sheet', config };
              return { afterDismissed: () => of(choice) };
            },
          },
        },
        { provide: BreakpointObserver, useValue: { isMatched: () => handset } },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.rows.set(rows);
    fixture.componentInstance.offers = offers;
    fixture.componentInstance.items = items;
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const q = (id: string) =>
      host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const settle = async () => {
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, host, q, settle, rows: fixture.componentInstance.rows };
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    opened = undefined;
    choice = undefined;
    handset = false;
  });

  // A saving target of the month is never offered, yet its row still shows its value.
  it('should give a followed item its up-to-date value, not only my last entry', async () => {
    const livret = asset('livret', {
      name: 'Livret',
      recordedValue: 10_000,
      latestValue: 10_500,
    });
    const view = await setup(
      [row(0, { account: { kind: 'asset', id: 'livret' } })],
      [],
      [livret],
    );

    expect(view.q('reconcile-linked-caption')!.textContent).toContain(
      "Mis à jour dans Mon patrimoine, où il vaut aujourd'hui 10’500.00 CHF.",
    );
  });

  it('should open the add dialog on desktop, listing no item already on the list', async () => {
    const view = await setup(
      [row(0, { account: { kind: 'asset', id: 'a' } })],
      [asset('a'), asset('b')],
    );

    view.q('reconcile-add-account-button')!.click();
    await view.settle();

    const { frame, config } = opened as {
      frame: string;
      config: { ariaLabel: string; data: { groups: unknown[] } };
    };
    expect(frame).toBe('dialog');
    expect(config.ariaLabel).toBe('Ajouter un compte');
    expect(config.data.groups).toEqual([
      { name: 'Comptes', items: [expect.objectContaining({ id: 'b' })] },
    ]);
  });

  it('should open a bottom sheet on a phone and add the picked item as a fixed row', async () => {
    handset = true;
    const card = asset('b', { direction: 'owe', name: 'Carte' });
    choice = { kind: 'asset', asset: card };
    const view = await setup([row(0)], [card]);
    // A category must exist for the item to be grouped.
    view.fixture.componentRef.changeDetectorRef.detectChanges();

    view.q('reconcile-add-account-button')!.click();
    await view.settle();

    expect(opened).toMatchObject({
      frame: 'sheet',
      config: { ariaLabel: 'Ajouter un compte' },
    });
    expect(view.rows().at(-1)).toMatchObject({
      label: 'Carte',
      side: 'owe',
      account: { kind: 'asset', id: 'b' },
    });
    expect(view.q('reconcile-card-help')).toBeNull();
  });

  it('should add a free « Je dois » row from the card help and focus its name', async () => {
    const view = await setup([row(0)]);

    view.q('reconcile-add-owe-help-button')!.click();
    await view.settle();

    expect(view.rows()).toHaveLength(2);
    expect(view.rows()[1]).toMatchObject({ side: 'owe', account: FREE });
    expect(document.activeElement).toBe(
      view.host.querySelectorAll('[data-testid="reconcile-label-input"]')[1],
    );
  });

  it('should keep the remove button and the side control usable with amounts hidden', async () => {
    const view = await setup([row(0)]);

    for (const control of [
      view.q('reconcile-remove-button'),
      view.host.querySelector('[role="radiogroup"]'),
    ]) {
      expect(control?.classList.contains('ph-no-capture')).toBe(true);
      expect(control?.classList.contains('amounts-visible')).toBe(true);
    }
  });

  // Every field shows « Solde »: a screen reader names the account it belongs to.
  it('should name each balance field after its account, unnamed ones by number', async () => {
    const view = await setup([row(0, { label: 'UBS' }), row(1, { label: '' })]);

    expect(
      [
        ...view.host.querySelectorAll('[data-testid="reconcile-amount-input"]'),
      ].map((input) => input.getAttribute('aria-label')),
    ).toEqual(['Solde de UBS', 'Solde de Compte 2']);
  });

  it('should keep a segment of the side control at least 44px high', async () => {
    const view = await setup([row(0)]);

    const label = view.host.querySelector(
      'input[type="radio"]',
    )!.parentElement!;
    expect(label.className).toContain('min-h-11');
  });

  it('should leave Mon patrimoine rows with a fixed side and no radio', async () => {
    const view = await setup([
      row(0, { account: { kind: 'asset', id: 'a' }, side: 'owe' }),
    ]);

    expect(view.host.querySelector('input[type="radio"]')).toBeNull();
    expect(view.q('reconcile-row-side')?.textContent).toContain('Je dois');
  });
});
