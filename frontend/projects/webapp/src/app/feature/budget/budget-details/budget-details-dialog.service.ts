import { inject, Injectable, Injector } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import type {
  BudgetLine,
  BudgetLineCreate,
  BudgetLineUpdate,
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
import { CreateAllocatedTransactionBottomSheet } from './create-allocated-transaction-dialog/create-allocated-transaction-bottom-sheet';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { EditBudgetLineDialog } from './edit-budget-line/edit-budget-line-dialog';

export interface ConfirmDeleteOptions {
  title: string;
  message: string;
}

@Injectable()
export class BudgetDetailsDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #injector = inject(Injector);

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

  async openAllocatedTransactionsDialog(
    event: {
      budgetLine: BudgetLine;
      consumption: BudgetLineConsumption;
    },
    isMobile: boolean,
    callbacks?: { onToggleTransactionCheck?: (id: string) => void },
  ): Promise<AllocatedTransactionsDialogResult | undefined> {
    const data: AllocatedTransactionsDialogData = {
      budgetLine: event.budgetLine,
      consumption: event.consumption,
      onToggleTransactionCheck: callbacks?.onToggleTransactionCheck,
    };

    if (isMobile) {
      const bottomSheetRef = this.#bottomSheet.open(
        AllocatedTransactionsBottomSheet,
        { data, injector: this.#injector },
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
    isMobile: boolean,
  ): Promise<TransactionCreate | undefined> {
    const data: CreateAllocatedTransactionDialogData = { budgetLine };

    if (isMobile) {
      const bottomSheetRef = this.#bottomSheet.open(
        CreateAllocatedTransactionBottomSheet,
        { data, injector: this.#injector },
      );
      return firstValueFrom(bottomSheetRef.afterDismissed());
    }

    const dialogRef = this.#dialog.open(CreateAllocatedTransactionDialog, {
      data,
      width: '600px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async openEditBudgetLineDialog(
    budgetLine: BudgetLine,
  ): Promise<BudgetLineUpdate | undefined> {
    const dialogRef = this.#dialog.open(EditBudgetLineDialog, {
      data: { budgetLine },
      width: '400px',
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
