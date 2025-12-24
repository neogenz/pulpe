import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialog,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { type BudgetLine, type Transaction } from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { TransactionApi } from '@core/transaction';
import { AllocatedTransactionFormDialog } from './allocated-transaction-form-dialog';
import { TransactionCard } from '../budget-table/transaction-card';

export interface AllocatedTransactionsDialogData {
  budgetLine: BudgetLine;
}

export interface AllocatedTransactionsDialogResult {
  updated: boolean;
}

@Component({
  selector: 'pulpe-allocated-transactions-dialog',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TransactionCard,
  ],
  providers: [BudgetLineApi],
  template: `
    <h2 mat-dialog-title class="text-headline-small flex items-center gap-2">
      <mat-icon aria-hidden="true">receipt_long</mat-icon>
      Transactions allouées
    </h2>

    <mat-dialog-content class="!p-0">
      <!-- Budget Line Info -->
      <div class="px-6 py-4 bg-surface-container-lowest">
        <h3 class="text-title-medium mb-3">{{ data.budgetLine.name }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 bg-surface rounded-lg">
            <span class="text-label-small text-on-surface-variant block"
              >Prévu</span
            >
            <span class="text-title-small font-medium">
              {{
                data.budgetLine.amount
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </span>
          </div>
          <div class="p-3 bg-surface rounded-lg">
            <span class="text-label-small text-on-surface-variant block"
              >Consommé</span
            >
            <span
              class="text-title-small font-medium"
              [class.text-error]="consumedAmount() > data.budgetLine.amount"
            >
              {{
                consumedAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </span>
          </div>
          <div class="p-3 bg-surface rounded-lg">
            <span class="text-label-small text-on-surface-variant block"
              >Restant</span
            >
            <span
              class="text-title-small font-medium"
              [class.text-error]="remainingAmount() < 0"
              [class.text-pulpe-financial-savings]="remainingAmount() >= 0"
            >
              {{
                remainingAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Transaction List -->
      <div class="px-6 py-4 max-h-[400px] overflow-y-auto">
        @if (transactionsResource.isLoading()) {
          <div class="flex justify-center items-center py-8">
            <mat-spinner diameter="40" />
          </div>
        } @else if (transactionsResource.error()) {
          <div class="text-error text-center py-8">
            <mat-icon aria-hidden="true" class="text-4xl mb-2"
              >error_outline</mat-icon
            >
            <p class="text-body-medium">
              Erreur lors du chargement des transactions
            </p>
          </div>
        } @else if (transactions().length === 0) {
          <div class="text-center py-8 text-on-surface-variant">
            <mat-icon aria-hidden="true" class="text-5xl mb-2 opacity-50"
              >inbox</mat-icon
            >
            <p class="text-body-medium">
              Aucune transaction allouée à cette prévision
            </p>
          </div>
        } @else {
          <div class="flex flex-col gap-2">
            @for (tx of transactions(); track tx.id) {
              <pulpe-transaction-card
                [transaction]="tx"
                [kind]="data.budgetLine.kind"
                [isMobile]="false"
                (edit)="editTransaction(tx)"
                (delete)="deleteTransaction(tx)"
              />
            }
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2 px-6 py-4">
      <button
        matButton="tonal"
        type="button"
        (click)="addTransaction()"
        [disabled]="isProcessing()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        Ajouter
      </button>
      <button
        matButton="outlined"
        type="button"
        (click)="closeDialog()"
        [disabled]="isProcessing()"
      >
        Fermer
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsDialog {
  readonly #dialogRef = inject(
    MatDialogRef<
      AllocatedTransactionsDialog,
      AllocatedTransactionsDialogResult
    >,
  );
  readonly #dialog = inject(MatDialog);
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #transactionApi = inject(TransactionApi);

  protected readonly data =
    inject<AllocatedTransactionsDialogData>(MAT_DIALOG_DATA);

  readonly #hasUpdates = signal(false);
  readonly isProcessing = signal(false);

  readonly transactionsResource = resource({
    loader: async () => {
      const response = await firstValueFrom(
        this.#budgetLineApi.getAllocatedTransactions$(this.data.budgetLine.id),
      );
      return response.data;
    },
  });

  readonly transactions = computed<Transaction[]>(
    () => this.transactionsResource.value() ?? [],
  );

  readonly consumedAmount = computed(() =>
    this.transactions().reduce((sum, t) => sum + t.amount, 0),
  );

  readonly remainingAmount = computed(
    () => this.data.budgetLine.amount - this.consumedAmount(),
  );

  protected closeDialog(): void {
    this.#dialogRef.close({ updated: this.#hasUpdates() });
  }

  protected addTransaction(): void {
    const dialogRef = this.#dialog.open(AllocatedTransactionFormDialog, {
      data: {
        budgetLine: this.data.budgetLine,
        mode: 'create' as const,
      },
      width: '400px',
      maxWidth: '90vw',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.created) {
        this.#hasUpdates.set(true);
        this.transactionsResource.reload();
      }
    });
  }

  protected editTransaction(transaction: Transaction): void {
    const dialogRef = this.#dialog.open(AllocatedTransactionFormDialog, {
      data: {
        budgetLine: this.data.budgetLine,
        transaction,
        mode: 'edit' as const,
      },
      width: '400px',
      maxWidth: '90vw',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.updated) {
        this.#hasUpdates.set(true);
        this.transactionsResource.reload();
      }
    });
  }

  protected async deleteTransaction(transaction: Transaction): Promise<void> {
    if (!confirm(`Supprimer la transaction "${transaction.name}" ?`)) {
      return;
    }

    this.isProcessing.set(true);
    try {
      await firstValueFrom(this.#transactionApi.remove$(transaction.id));
      this.#hasUpdates.set(true);
      this.transactionsResource.reload();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
