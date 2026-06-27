import { inject, Injectable, Injector } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type {
  BudgetLine,
  BudgetLineUpdate,
  SupportedCurrency,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from 'pulpe-shared';
import type { BudgetLineConsumption } from '@core/budget';
import { AppCurrencyPipe } from '@core/currency';
import {
  ProcessingDialog,
  type ProcessingDialogData,
} from '@ui/dialogs/processing-dialog';
import {
  AddBudgetLineDialog,
  type BudgetLineDialogData,
} from './budget-line/create/dialog';
import type { AddBudgetLineDialogResult } from './budget-line/create/dialog-result';
import {
  AllocatedTransactionsDialog,
  type AllocatedTransactionsDialogData,
  type AllocatedTransactionsDialogResult,
} from './allocated-transactions/details-dialog/dialog';
import { AllocatedTransactionsBottomSheet } from './allocated-transactions/details-dialog/bottom-sheet';
import {
  CreateAllocatedTransactionDialog,
  type CreateAllocatedTransactionDialogData,
} from './allocated-transactions/create-dialog/dialog';
import { computeBudgetPeriodDateConstraints } from './allocated-transactions/create-dialog/budget-period-date-constraints';
import { CreateAllocatedTransactionBottomSheet } from './allocated-transactions/create-dialog/bottom-sheet';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { EditBudgetLineDialog } from './budget-line/edit/dialog';
import {
  EditTransactionDialog,
  type EditTransactionDialogData,
} from './components/edit-transaction-form';
import { SpreadOccurrencesPanel } from './spread-occurrences/spread-occurrences-panel';
import { SpreadOccurrencesBottomSheet } from './spread-occurrences/spread-occurrences-bottom-sheet';
import { SpreadExistingDialog } from './budget-line/spread-existing/dialog';
import type {
  SpreadExistingDialogData,
  SpreadExistingDialogResult,
} from './budget-line/spread-existing/dialog-result';

export interface ConfirmDeleteOptions {
  title: string;
  message: string;
}

export interface SpreadProcessingEcho {
  amount: number;
  monthCount: number;
  currency: SupportedCurrency;
}

/**
 * PUL-17 — minimum on-screen time for the spread processing dialog. A spread
 * over a few months resolves in well under a second; without a floor the dialog
 * would flash. The dialog stays at least this long, then closes as soon as the
 * (possibly multi-second) server fan-out resolves.
 */
const SPREAD_PROCESSING_MIN_VISIBLE_MS = 700;

@Injectable()
export class BudgetDetailsDialogService {
  readonly #dialog = inject(MatDialog);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #injector = inject(Injector);
  readonly #transloco = inject(TranslocoService);
  readonly #currencyPipe = new AppCurrencyPipe();

  async openAddBudgetLineDialog(budget: {
    id: string;
    month: number;
    year: number;
  }): Promise<AddBudgetLineDialogResult | undefined> {
    const dialogRef = this.#dialog.open(AddBudgetLineDialog, {
      data: {
        budgetId: budget.id,
        budgetMonth: budget.month,
        budgetYear: budget.year,
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
    budgetPeriod: {
      budgetMonth: number;
      budgetYear: number;
      payDayOfMonth: number | null;
    },
  ): Promise<TransactionCreate | undefined> {
    const data: CreateAllocatedTransactionDialogData = {
      budgetLine,
      ...budgetPeriod,
    };

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

  async openEditAllocatedTransactionDialog(
    transaction: Transaction,
    budgetPeriod: {
      budgetMonth: number;
      budgetYear: number;
      payDayOfMonth: number | null;
    },
  ): Promise<{ id: string; update: TransactionUpdate } | undefined> {
    const { minDate, maxDate } = computeBudgetPeriodDateConstraints(
      budgetPeriod.budgetMonth,
      budgetPeriod.budgetYear,
      budgetPeriod.payDayOfMonth,
    );

    const dialogRef = this.#dialog.open(EditTransactionDialog, {
      data: {
        transaction,
        hiddenFields: ['kind', 'category'],
        minDate,
        maxDate,
      } satisfies EditTransactionDialogData,
      width: '500px',
      maxWidth: '90vw',
    });

    const result = await firstValueFrom<TransactionUpdate | undefined>(
      dialogRef.afterClosed(),
    );
    return result ? { id: transaction.id, update: result } : undefined;
  }

  async openSpreadExisting(
    data: SpreadExistingDialogData,
  ): Promise<SpreadExistingDialogResult | undefined> {
    const dialogRef = this.#dialog.open(SpreadExistingDialog, {
      data,
      width: '600px',
      maxWidth: '90vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  openSpreadOccurrences(isMobile: boolean): void {
    if (isMobile) {
      this.#bottomSheet.open(SpreadOccurrencesBottomSheet, {
        injector: this.#injector,
      });
      return;
    }

    this.#dialog.open(SpreadOccurrencesPanel, {
      injector: this.#injector,
      panelClass: 'side-sheet-panel',
      position: { right: '0', top: '0' },
      height: '100vh',
      width: '480px',
      maxWidth: '90vw',
      autoFocus: false,
      closeOnNavigation: true,
    });
  }

  /**
   * PUL-17 — wrap a slow spread mutation in a non-dismissable processing dialog.
   *
   * The input dialog closes before the server fan-out starts (it only returns a
   * DTO), so the spread runs with nothing on screen. This opens a blocking
   * "Lissage en cours" dialog around the awaited mutation and guarantees a
   * minimum visible time so quick spreads don't flash. `run` is whatever store
   * mutation the caller awaits; its result is returned unchanged. The dialog is
   * always closed in `finally`, even when the mutation throws.
   */
  async runSpreadProcessing<T>(
    run: () => Promise<T>,
    echo: SpreadProcessingEcho,
  ): Promise<T> {
    const dialogRef = this.#dialog.open(ProcessingDialog, {
      data: {
        title: this.#transloco.translate('budgetLine.spread.processingTitle'),
        detail: this.#transloco.translate(
          'budgetLine.spread.processingDetail',
          {
            amount: this.#currencyPipe.transform(
              Math.abs(echo.amount),
              echo.currency,
              '1.0-0',
            ),
            count: echo.monthCount,
          },
        ),
        hint: this.#transloco.translate('budgetLine.spread.processingHint'),
      } satisfies ProcessingDialogData,
      disableClose: true,
      width: '360px',
      maxWidth: '90vw',
      autoFocus: 'dialog',
    });

    const startedAt = performance.now();
    try {
      return await run();
    } finally {
      // Load-bearing: awaiting the floor here is what holds the dialog (and the
      // caller, hence the success/error snackbar) until the minimum visible time
      // has elapsed. Don't hoist this out of `finally` — it must run on both the
      // resolve and throw paths.
      const remaining =
        SPREAD_PROCESSING_MIN_VISIBLE_MS - (performance.now() - startedAt);
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
      dialogRef.close();
    }
  }

  async confirmDelete(options: ConfirmDeleteOptions): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: options.title,
        message: options.message,
        confirmText: this.#transloco.translate('common.delete'),
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    return confirmed === true;
  }

  async confirmCheckAllocatedTransactions(): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('budget.checkTransactionsTitle'),
        message: this.#transloco.translate('budget.checkAllTransactions'),
        confirmText: this.#transloco.translate('budget.checkAllConfirm'),
        cancelText: this.#transloco.translate('budget.checkOnlyEnvelope'),
      } satisfies ConfirmationDialogData,
      width: '500px',
      maxWidth: '90vw',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    return confirmed === true;
  }
}
