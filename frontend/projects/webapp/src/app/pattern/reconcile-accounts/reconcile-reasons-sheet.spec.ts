import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { money } from './reconcile-compare-step';
import {
  ReconcileReasonsSheet,
  type ReasonsSheetData,
} from './reconcile-reasons-sheet';

const GROCERIES = { name: 'Courses', amount: 600, spent: 200, left: 400 };
const DATA: ReasonsSheetData = {
  gap: 6000,
  currency: 'CHF',
  hasOwe: false,
  partlySpent: null,
  note: { before: 900, after: 6900 },
};

async function setup(
  data: Partial<ReasonsSheetData> = {},
  frame: 'dialog' | 'sheet' = 'dialog',
) {
  const close = vi.fn();
  const value = { ...DATA, ...data };
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: LOCALE_ID, useValue: 'fr-CH' },
      ...(frame === 'dialog'
        ? [
            { provide: MAT_DIALOG_DATA, useValue: value },
            { provide: MatDialogRef, useValue: { close } },
          ]
        : [
            { provide: MAT_BOTTOM_SHEET_DATA, useValue: value },
            { provide: MatBottomSheetRef, useValue: { dismiss: close } },
          ]),
    ],
  });
  const fixture = TestBed.createComponent(ReconcileReasonsSheet);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const q = (id: string) =>
    host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const reasons = () =>
    Array.from(
      host.querySelectorAll<HTMLElement>('[data-testid="reconcile-reason"]'),
      (section) => section.dataset['reason'],
    );
  return { host, q, reasons, close };
}

describe('ReconcileReasonsSheet', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should title the gap and keep the reasons in their fixed order, three at most', async () => {
    const view = await setup({ partlySpent: GROCERIES });

    expect(
      view
        .q('reconcile-reasons-sheet')
        ?.querySelector('h2')
        ?.textContent?.trim(),
      // Only the currency may go to the next line: the figure stays whole.
    ).toBe(`D'où viennent ces ${money(6000, 'CHF').replace('\u00a0', ' ')} ?`);
    expect(view.reasons()).toEqual(['card', 'partlySpent', 'income']);
  });

  it('should drop the card once a « Je dois » row is in the list, and the partly spent line when there is none', async () => {
    expect((await setup({ hasOwe: true })).reasons()).toEqual([
      'income',
      'savings',
    ]);
    TestBed.resetTestingModule();
    expect((await setup()).reasons()).toEqual(['card', 'income', 'savings']);
    TestBed.resetTestingModule();
    expect(
      (await setup({ hasOwe: true, partlySpent: GROCERIES })).reasons(),
    ).toEqual(['partlySpent', 'income', 'savings']);
  });

  it('should show what the prévision spent and what is still there, with nothing to do', async () => {
    const view = await setup({ hasOwe: true, partlySpent: GROCERIES });

    expect(view.q('reconcile-reason-spent')?.textContent).toBe(
      `${money(200, 'CHF')} dépensés`,
    );
    expect(view.q('reconcile-reason-left')?.textContent).toBe(
      `${money(400, 'CHF')} encore là`,
    );
    expect(view.host.textContent).toContain('Normal, rien à faire');
  });

  it('should answer with the reason acted on, or nothing when closed', async () => {
    const view = await setup();

    for (const id of [
      'reconcile-reasons-owe-button',
      'reconcile-reasons-income-button',
      'reconcile-reasons-accounts-button',
      'reconcile-reasons-leave-button',
      'reconcile-reasons-close-button',
    ]) {
      view.q(id)?.click();
    }

    expect(view.close.mock.calls).toEqual([
      ['addOwe'],
      ['noteIncome'],
      ['reviewAccounts'],
      ['leave'],
      [undefined],
    ]);
  });

  it('should say what noting the income does to « Disponible »', async () => {
    const view = await setup();

    expect(view.q('reconcile-reasons-income-button')?.textContent?.trim()).toBe(
      `Noter un revenu de ${money(6000, 'CHF')}`,
    );
    expect(view.host.textContent).toContain(
      `Disponible : ${money(900, 'CHF')} → ${money(6900, 'CHF')}`,
    );
  });

  it('should answer through the bottom sheet on a phone', async () => {
    const view = await setup({}, 'sheet');

    view.q('reconcile-reasons-leave-button')?.click();

    expect(view.close).toHaveBeenCalledExactlyOnceWith('leave');
  });

  // posthog-privacy: amounts and the prévision's name blur, never the words or the buttons.
  it('should mask the amounts and the name only', async () => {
    const view = await setup({ partlySpent: GROCERIES });
    const masked = Array.from(
      view.host.querySelectorAll('.ph-no-capture'),
      (element) => element.textContent?.trim(),
    );

    expect(masked).toEqual([
      money(6000, 'CHF').replace('\u00a0', ' '),
      'Courses',
      money(600, 'CHF'),
      // The bar: its width is the share spent.
      '',
      money(200, 'CHF'),
      money(400, 'CHF'),
      `+${money(6000, 'CHF')}`,
      money(6000, 'CHF'),
      money(900, 'CHF'),
      money(6900, 'CHF'),
    ]);
    expect(view.host.querySelector('button.ph-no-capture')).toBeNull();
  });
});
