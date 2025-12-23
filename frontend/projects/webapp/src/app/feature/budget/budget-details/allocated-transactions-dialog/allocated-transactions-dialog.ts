import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialog,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetLine, type Transaction } from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { TransactionApi } from '@core/transaction';
import { AllocatedTransactionFormDialog } from './allocated-transaction-form-dialog';

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
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  providers: [BudgetLineApi],
  template: `
    <h2 mat-dialog-title class="text-headline-small flex items-center gap-2">
      <mat-icon aria-hidden="true">receipt_long</mat-icon>
      Transactions allouées
    </h2>

    <mat-dialog-content class="min-w-[400px]">
      <div class="mb-4 p-4 bg-surface-container rounded-lg">
        <h3 class="text-title-medium mb-2">{{ data.budgetLine.name }}</h3>
        <div class="grid grid-cols-3 gap-4 text-body-medium">
          <div>
            <span class="text-on-surface-variant">Prévu</span>
            <div class="text-title-small">
              {{
                data.budgetLine.amount
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
          <div>
            <span class="text-on-surface-variant">Consommé</span>
            <div
              class="text-title-small"
              [class.text-error]="consumedAmount() > data.budgetLine.amount"
            >
              {{
                consumedAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
          <div>
            <span class="text-on-surface-variant">Restant</span>
            <div
              class="text-title-small"
              [class.text-error]="remainingAmount() < 0"
              [class.text-tertiary]="remainingAmount() >= 0"
            >
              {{
                remainingAmount()
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </div>
          </div>
        </div>
      </div>

      @if (transactionsResource.isLoading()) {
        <div class="flex justify-center items-center py-8">
          <mat-spinner diameter="40" />
        </div>
      } @else if (transactionsResource.error()) {
        <div class="text-error text-center py-8">
          <mat-icon aria-hidden="true">error_outline</mat-icon>
          <p>Erreur lors du chargement des transactions</p>
        </div>
      } @else if (transactions().length === 0) {
        <div class="text-center py-8 text-on-surface-variant">
          <mat-icon aria-hidden="true" class="text-5xl mb-2">inbox</mat-icon>
          <p>Aucune transaction allouée à cette prévision</p>
        </div>
      } @else {
        <table mat-table [dataSource]="transactions()" class="w-full">
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let transaction">
              {{ transaction.transactionDate | date: 'dd/MM/yyyy' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nom</th>
            <td mat-cell *matCellDef="let transaction">
              {{ transaction.name }}
            </td>
          </ng-container>

          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">
              Montant
            </th>
            <td mat-cell *matCellDef="let transaction" class="text-right">
              {{
                transaction.amount
                  | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
              }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="w-16"></th>
            <td mat-cell *matCellDef="let transaction" class="text-right">
              <button
                mat-icon-button
                matTooltip="Modifier"
                (click)="editTransaction(transaction)"
                [disabled]="isProcessing()"
              >
                <mat-icon aria-hidden="true">edit</mat-icon>
              </button>
              <button
                mat-icon-button
                matTooltip="Supprimer"
                (click)="deleteTransaction(transaction)"
                [disabled]="isProcessing()"
              >
                <mat-icon aria-hidden="true">delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton="tonal"
        type="button"
        (click)="addTransaction()"
        [disabled]="isProcessing()"
      >
        <mat-icon aria-hidden="true">add</mat-icon>
        Ajouter une transaction
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

  protected readonly displayedColumns = ['date', 'name', 'amount', 'actions'];

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
