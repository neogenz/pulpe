import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from './confirmation-dialog';

// eslint-disable-next-line boundaries/no-unknown -- JSON asset, not a layer import
import en from '../../../../public/i18n/en.json';

async function render(data: ConfirmationDialogData) {
  TestBed.configureTestingModule({
    imports: [ConfirmationDialog],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest({ en }),
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  TestBed.inject(TranslocoService).setActiveLang('en');

  const fixture = TestBed.createComponent(ConfirmationDialog);
  fixture.detectChanges();
  await fixture.whenStable();

  const label = (testId: string): string | undefined =>
    fixture.nativeElement
      .querySelector(`[data-testid="${testId}"]`)
      ?.textContent.trim();

  return {
    cancel: label('confirmation-cancel-button'),
    confirm: label('confirmation-confirm-button'),
  };
}

describe('ConfirmationDialog', () => {
  it('should label the buttons in the active language when the caller passes none', async () => {
    const labels = await render({ title: 'Delete?', message: 'Sure?' });

    expect(labels).toEqual({ cancel: 'Cancel', confirm: 'Confirm' });
  });

  it('should keep the labels the caller passes', async () => {
    const labels = await render({
      title: 'Delete?',
      message: 'Sure?',
      cancelText: 'Keep',
      confirmText: 'Delete',
    });

    expect(labels).toEqual({ cancel: 'Keep', confirm: 'Delete' });
  });
});
