import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, map } from 'rxjs';
import type {
  BudgetLine,
  BudgetLineCreate,
  TransactionCreate,
} from 'pulpe-shared';
import type { BudgetLineConsumption } from '@core/budget';
import {
  AddBudgetLineDialog,
  type BudgetLineDialogData,
} from './create-budget-line/add-budget-line-dialog';
import {
  AllocatedTransactionsDialog,
  type AllocatedTransactionsDialogData,
  type AllocatedTransactionsDialogResult,
} from './allocated-transactions-dialog/allocated-transactions-dialog';
import { AllocatedTransactionsBottomSheet } from './allocated-transactions-dialog/allocated-transactions-bottom-sheet';
import {
  CreateAllocatedTransactionDialog,
  type CreateAllocatedTransactionDialogData,
} from './create-allocated-transaction-dialog/create-allocated-transaction-dialog';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';

export interface ConfirmDeleteOptions {
  title: string;
  message: string;
}

@Injectable()
export class BudgetDetailsDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #breakpointObserver = inject(BreakpointObserver);

  readonly #isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  async openAddBudgetLineDialog(
    budgetId: string,
  ): Promise<BudgetLineCreate | undefined> {
    const dialogRef = this.#dialog.open(AddBudgetLineDialog, {
      data: {
        budgetId,
      } satisfies BudgetLineDialogData,
      width: '600px',
      maxWidth: '90vw',
    });

    return firstValueFrom(dialogRef.afterClosed());
  }

  async openAllocatedTransactionsDialog(event: {
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }): Promise<AllocatedTransactionsDialogResult | undefined> {
    const data: AllocatedTransactionsDialogData = {
      budgetLine: event.budgetLine,
      consumption: event.consumption,
    };

    if (this.#isMobile()) {
      const bottomSheetRef = this.#bottomSheet.open(
        AllocatedTransactionsBottomSheet,
        { data },
      );
      return firstValueFrom(bottomSheetRef.afterDismissed());
    }

    const dialogRef = this.#dialog.open(AllocatedTransactionsDialog, {
      data,
      width: '800px',
      maxWidth: '95vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openCreateAllocatedTransactionDialog(
    budgetLine: BudgetLine,
  ): Promise<TransactionCreate | undefined> {
    const dialogRef = this.#dialog.open(CreateAllocatedTransactionDialog, {
      data: {
        budgetLine,
      } satisfies CreateAllocatedTransactionDialogData,
      width: '600px',
      maxWidth: '90vw',
    });

    return firstValueFrom(dialogRef.afterClosed());
  }

  async confirmDelete(options: ConfirmDeleteOptions): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: options.title,
        message: options.message,
        confirmText: 'Supprimer',
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    return confirmed === true;
  }
}
