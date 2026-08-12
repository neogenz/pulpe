import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from './recovery-key-dialog';

describe('RecoveryKeyDialog', () => {
  const recoveryKey = 'ABCD-EFGH-IJKL-MNOP';
  let fixture: ComponentFixture<RecoveryKeyDialog>;
  let component: RecoveryKeyDialog;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await TestBed.configureTestingModule({
      imports: [RecoveryKeyDialog],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { recoveryKey } satisfies RecoveryKeyDialogData,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecoveryKeyDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('marks the key as copied after a successful clipboard write', async () => {
    await component.copyToClipboard();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(recoveryKey);
    expect(component['isCopied']()).toBe(true);
    expect(component['copyFailed']()).toBe(false);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="copy-recovery-key-error"]',
      ),
    ).toBeNull();
  });

  it('keeps the key visible and explains manual recovery when copying fails', async () => {
    writeText.mockRejectedValue(new Error('Clipboard unavailable'));

    await component.copyToClipboard();
    fixture.detectChanges();

    expect(component['isCopied']()).toBe(false);
    expect(component['copyFailed']()).toBe(true);
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="recovery-key-display"]')
        ?.textContent.trim(),
    ).toBe(recoveryKey);
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="copy-recovery-key-error"]')
        ?.textContent.trim(),
    ).toBe(
      'La copie a échoué. Sélectionne la clé ci-dessus et copie-la manuellement.',
    );
  });

  it('clears the error after a successful retry', async () => {
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    await component.copyToClipboard();

    writeText.mockResolvedValueOnce(undefined);
    await component.copyToClipboard();

    expect(component['isCopied']()).toBe(true);
    expect(component['copyFailed']()).toBe(false);
  });
});
