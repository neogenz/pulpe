import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddTransactionBottomSheet } from '../components/add-transaction-bottom-sheet';
import { AddTransactionDialog } from '../components/add-transaction-dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { AddTransactionDialogService } from './add-transaction-dialog.service';

describe('AddTransactionDialogService', () => {
  let service: AddTransactionDialogService;
  let breakpointObserver: { isMatched: ReturnType<typeof vi.fn> };
  let bottomSheet: { open: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  // La coque reçoit de quoi enregistrer : c'est elle qui garde la saisie
  // jusqu'à ce que l'écriture soit acceptée.
  const persist = async (): Promise<string | null> => null;

  beforeEach(() => {
    breakpointObserver = { isMatched: vi.fn() };
    bottomSheet = { open: vi.fn() };
    dialog = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        AddTransactionDialogService,
        { provide: BreakpointObserver, useValue: breakpointObserver },
        { provide: MatBottomSheet, useValue: bottomSheet },
        { provide: MatDialog, useValue: dialog },
      ],
    });

    service = TestBed.inject(AddTransactionDialogService);
  });

  it('should use the bottom sheet on handsets', async () => {
    const transaction = { name: 'Courses', amount: 50, kind: 'expense' };
    breakpointObserver.isMatched.mockReturnValue(true);
    bottomSheet.open.mockReturnValue({
      afterDismissed: () => of(transaction),
    });

    await expect(service.open(persist)).resolves.toBe(transaction);

    expect(breakpointObserver.isMatched).toHaveBeenCalledWith(
      Breakpoints.Handset,
    );
    expect(bottomSheet.open).toHaveBeenCalledWith(AddTransactionBottomSheet, {
      data: { persist },
      autoFocus: '[inputmode="decimal"]',
      disableClose: true,
      injector: expect.anything(),
    });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('should use a constrained dialog on tablet and desktop', async () => {
    breakpointObserver.isMatched.mockReturnValue(false);
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

    await expect(service.open(persist)).resolves.toBeUndefined();

    expect(dialog.open).toHaveBeenCalledWith(AddTransactionDialog, {
      data: { persist },
      width: '720px',
      maxWidth: 'calc(100vw - 48px)',
      panelClass: 'add-transaction-dialog',
      autoFocus: '[inputmode="decimal"]',
      disableClose: true,
      injector: expect.anything(),
    });
    expect(bottomSheet.open).not.toHaveBeenCalled();
  });

  it('should treat anything but an explicit yes as keeping the transaction', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

    await expect(service.confirmDiscard()).resolves.toBe(false);
  });
});
