import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddTransactionBottomSheet } from '../components/add-transaction-bottom-sheet';
import { AddTransactionDialog } from '../components/add-transaction-dialog';
import { AddTransactionDialogService } from './add-transaction-dialog.service';

describe('AddTransactionDialogService', () => {
  let service: AddTransactionDialogService;
  let breakpointObserver: { isMatched: ReturnType<typeof vi.fn> };
  let bottomSheet: { open: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    breakpointObserver = { isMatched: vi.fn() };
    bottomSheet = { open: vi.fn() };
    dialog = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AddTransactionDialogService,
        { provide: BreakpointObserver, useValue: breakpointObserver },
        { provide: MatBottomSheet, useValue: bottomSheet },
        { provide: MatDialog, useValue: dialog },
      ],
    });

    service = TestBed.inject(AddTransactionDialogService);
  });

  it('uses the bottom sheet on handsets', async () => {
    const transaction = { name: 'Courses', amount: 50, kind: 'expense' };
    breakpointObserver.isMatched.mockReturnValue(true);
    bottomSheet.open.mockReturnValue({
      afterDismissed: () => of(transaction),
    });

    await expect(service.open()).resolves.toBe(transaction);

    expect(breakpointObserver.isMatched).toHaveBeenCalledWith(
      Breakpoints.Handset,
    );
    expect(bottomSheet.open).toHaveBeenCalledWith(AddTransactionBottomSheet, {
      autoFocus: '[data-testid="amount-input-value"]',
      disableClose: false,
    });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('uses a constrained dialog on tablet and desktop', async () => {
    breakpointObserver.isMatched.mockReturnValue(false);
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

    await expect(service.open()).resolves.toBeUndefined();

    expect(dialog.open).toHaveBeenCalledWith(AddTransactionDialog, {
      width: '720px',
      maxWidth: 'calc(100vw - 48px)',
      panelClass: 'add-transaction-dialog',
      autoFocus: '[data-testid="amount-input-value"]',
      disableClose: false,
    });
    expect(bottomSheet.open).not.toHaveBeenCalled();
  });
});
