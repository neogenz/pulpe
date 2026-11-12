import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RenameTypeDialog } from './rename-type-dialog';

describe('RenameTypeDialog', () => {
  const close = vi.fn();
  let fixture: ComponentFixture<RenameTypeDialog>;

  const byTestId = (id: string) =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement;

  function type(text: string): void {
    const input = byTestId('rename-type-input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function enter(): void {
    byTestId('rename-type-input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [RenameTypeDialog],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { name: 'Comptes' } },
      ],
    });
    fixture = TestBed.createComponent(RenameTypeDialog);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('does not close with a value when the name is unchanged', () => {
    type(' Comptes ');
    enter();

    expect(close).not.toHaveBeenCalled();
  });

  it('does not close with a value when the name is blank', () => {
    type('   ');
    enter();

    expect(close).not.toHaveBeenCalled();
  });

  it('closes with the trimmed name once it changed', () => {
    type('  Placements ');
    enter();

    expect(close).toHaveBeenCalledWith('Placements');
  });
});
