import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject, Service } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AddTransactionBottomSheet } from '../components/add-transaction-bottom-sheet';
import { AddTransactionDialog } from '../components/add-transaction-dialog';
import type { TransactionFormData } from '../components/add-transaction-form';

@Service({ autoProvided: false })
export class AddTransactionDialogService {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #dialog = inject(MatDialog);

  async open(): Promise<TransactionFormData | undefined> {
    if (this.#breakpointObserver.isMatched(Breakpoints.Handset)) {
      const bottomSheetRef = this.#bottomSheet.open(AddTransactionBottomSheet, {
        autoFocus: '[inputmode="decimal"]',
        disableClose: false,
      });
      return firstValueFrom(bottomSheetRef.afterDismissed());
    }

    const dialogRef = this.#dialog.open(AddTransactionDialog, {
      width: '720px',
      maxWidth: 'calc(100vw - 48px)',
      panelClass: 'add-transaction-dialog',
      autoFocus: '[inputmode="decimal"]',
      disableClose: false,
    });
    return firstValueFrom(dialogRef.afterClosed());
  }
}
