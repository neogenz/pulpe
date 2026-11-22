import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  ReconcileStartingAmountSheet,
  type StartingAmountSheetData,
} from './reconcile-starting-amount-sheet';

const DATA: StartingAmountSheetData = { amount: 3100, currency: 'CHF' };

async function setup(frame: 'dialog' | 'sheet' = 'dialog') {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      ...(frame === 'dialog'
        ? [
            { provide: MAT_DIALOG_DATA, useValue: DATA },
            { provide: MatDialogRef, useValue: { close } },
          ]
        : [
            { provide: MAT_BOTTOM_SHEET_DATA, useValue: DATA },
            { provide: MatBottomSheetRef, useValue: { dismiss: close } },
          ]),
    ],
  });
  const fixture = TestBed.createComponent(ReconcileStartingAmountSheet);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(id: string) =>
    host.querySelector<T>(`[data-testid="${id}"]`)!;
  const type = async (value: string) => {
    const input = q<HTMLInputElement>('reconcile-starting-amount-input');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  return { host, q, type, close };
}

describe('ReconcileStartingAmountSheet', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('should open on the stored amount and save what is typed', async () => {
    const view = await setup();

    expect(
      view.q<HTMLInputElement>('reconcile-starting-amount-input').value,
    ).toBe('3100.00');
    await view.type('2999,50');
    view.q('reconcile-starting-save-button').click();

    expect(view.close).toHaveBeenCalledExactlyOnceWith(2999.5);
  });

  it('should reset to 0, or leave with nothing to write', async () => {
    const view = await setup();

    view.q('reconcile-starting-reset-button').click();
    view.q('reconcile-starting-close-button').click();

    expect(view.close.mock.calls).toEqual([[0], [undefined]]);
  });

  it('should not save a blank or unreadable amount', async () => {
    const view = await setup();
    const save = view.q<HTMLButtonElement>('reconcile-starting-save-button');

    for (const text of ['', '12.', 'abc']) {
      await view.type(text);
      expect(save.disabled).toBe(true);
    }
    expect(view.close).not.toHaveBeenCalled();
  });

  it('should answer through the bottom sheet on a phone', async () => {
    const view = await setup('sheet');

    view.q('reconcile-starting-reset-button').click();

    expect(view.close).toHaveBeenCalledExactlyOnceWith(0);
  });

  // posthog-privacy: the field blurs with « Masquer les montants », never the buttons.
  it('should mask the amount field only', async () => {
    const view = await setup();

    expect(
      view.q('reconcile-starting-amount-input').closest('mat-form-field')
        ?.classList,
    ).toContain('ph-no-capture');
    expect(
      view.q('reconcile-starting-save-button').closest('.ph-no-capture'),
    ).toBeNull();
  });
});
