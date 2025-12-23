import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import type {
  BudgetLineWithConsumption,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';
import {
  AllocatedTransactionFormDialog,
  type AllocatedTransactionFormDialogData,
  type AllocatedTransactionFormResult,
} from './allocated-transaction-form-dialog';
import { ConfirmationDialog } from '../../../../ui/dialogs/confirmation-dialog';

export interface AllocatedTransactionsDialogData {
  budgetLine: BudgetLineWithConsumption;
  transactions: Transaction[];
  onCreateTransaction?: (data: TransactionCreate) => Promise<void>;
  onUpdateTransaction?: (
    transactionId: string,
    data: TransactionUpdate,
    budgetLineId: string,
    originalAmount: number,
  ) => Promise<void>;
  onDeleteTransaction?: (
    transactionId: string,
    budgetLineId: string,
    amount: number,
  ) => Promise<void>;
}

@Component({
  selector: 'pulpe-allocated-transactions-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    CurrencyPipe,
    DatePipe,
  ],
  template: `
    <div
      role="dialog"
      [attr.aria-label]="'Transactions allouées à ' + data.budgetLine.name"
    >
      <h2 mat-dialog-title data-testid="dialog-header">
        {{ data.budgetLine.name }}
      </h2>

      <mat-dialog-content>
        <div data-testid="consumption-stats" class="consumption-stats">
          <span class="stat">
            {{ data.budgetLine.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
            prévus
          </span>
          <span class="stat-separator">·</span>
          <span class="stat consumed">
            {{
              data.budgetLine.consumedAmount
                | currency: 'CHF' : 'symbol' : '1.0-0'
            }}
            dépensés
          </span>
          <span class="stat-separator">·</span>
          <span
            class="stat remaining"
            [class.negative]="data.budgetLine.remainingAmount < 0"
          >
            {{
              data.budgetLine.remainingAmount
                | currency: 'CHF' : 'symbol' : '1.0-0'
            }}
            restants
          </span>
        </div>

        @if (sortedTransactions().length > 0) {
          <mat-list
            data-testid="transaction-list"
            role="list"
            class="transaction-list"
          >
            @for (tx of sortedTransactions(); track tx.id) {
              <mat-list-item [attr.data-testid]="'transaction-item-' + tx.id">
                <div class="transaction-item">
                  <div class="transaction-info">
                    <span class="transaction-date">
                      {{ tx.transactionDate | date: 'dd.MM.yyyy' }}
                    </span>
                    <span class="transaction-name">{{ tx.name }}</span>
                  </div>
                  <div class="transaction-actions">
                    <span class="transaction-amount">
                      {{ tx.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
                    </span>
                    @if (hasCrudCallbacks()) {
                      <button
                        mat-icon-button
                        [attr.data-testid]="'edit-transaction-' + tx.id"
                        (click)="openEditDialog(tx)"
                        aria-label="Modifier la transaction"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        [attr.data-testid]="'delete-transaction-' + tx.id"
                        (click)="confirmDelete(tx)"
                        aria-label="Supprimer la transaction"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              </mat-list-item>
            }
          </mat-list>
        } @else {
          <div data-testid="empty-state-message" class="empty-state">
            <mat-icon>inbox</mat-icon>
            <p>Aucune transaction enregistrée</p>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button
          mat-button
          data-testid="add-transaction-button"
          [disabled]="!hasCrudCallbacks()"
          (click)="openAddDialog()"
          [attr.aria-label]="
            hasCrudCallbacks()
              ? 'Ajouter une transaction'
              : 'Ajouter une transaction (bientôt disponible)'
          "
        >
          <mat-icon>add</mat-icon>
          Ajouter
        </button>
        <button
          mat-flat-button
          data-testid="close-button"
          (click)="close()"
          aria-label="Fermer le dialog"
        >
          Fermer
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    .consumption-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      padding: 0.75rem 0;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .stat-separator {
      color: var(--mat-sys-outline);
    }

    .stat.consumed {
      color: var(--mat-sys-error);
    }

    .stat.remaining {
      color: var(--mat-sys-tertiary);
    }

    .stat.remaining.negative {
      color: var(--mat-sys-error);
      font-weight: 500;
    }

    .transaction-list {
      margin-top: 0.5rem;
    }

    .transaction-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0.5rem 0;
    }

    .transaction-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }

    .transaction-date {
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .transaction-name {
      font-weight: 500;
    }

    .transaction-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .transaction-amount {
      font-weight: 500;
      color: var(--mat-sys-on-surface);
      margin-right: 0.5rem;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }

    .empty-state mat-icon {
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    .empty-state p {
      margin: 0;
    }
  `,
})
export class AllocatedTransactionsDialog {
  readonly #dialogRef = inject(MatDialogRef<AllocatedTransactionsDialog>);
  readonly #matDialog = inject(MatDialog);
  readonly data = inject<AllocatedTransactionsDialogData>(MAT_DIALOG_DATA);

  /**
   * Check if CRUD callbacks are provided
   */
  readonly hasCrudCallbacks = computed(
    () =>
      !!this.data.onCreateTransaction &&
      !!this.data.onUpdateTransaction &&
      !!this.data.onDeleteTransaction,
  );

  /**
   * Transactions sorted by date DESC (most recent first)
   */
  readonly sortedTransactions = computed(() => {
    return [...this.data.transactions].sort((a, b) => {
      const dateA = new Date(a.transactionDate).getTime();
      const dateB = new Date(b.transactionDate).getTime();
      return dateB - dateA;
    });
  });

  close(): void {
    this.#dialogRef.close();
  }

  /**
   * Open dialog to add a new transaction
   */
  async openAddDialog(): Promise<void> {
    if (!this.data.onCreateTransaction) return;

    const dialogData: AllocatedTransactionFormDialogData = {
      budgetLineId: this.data.budgetLine.id,
      budgetId: this.data.budgetLine.budgetId,
      kind: this.data.budgetLine.kind,
    };

    const dialogRef = this.#matDialog.open(AllocatedTransactionFormDialog, {
      data: dialogData,
      width: '400px',
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    if (result?.mode === 'create') {
      await this.data.onCreateTransaction(result.data);
    }
  }

  /**
   * Open dialog to edit an existing transaction
   */
  async openEditDialog(transaction: Transaction): Promise<void> {
    if (!this.data.onUpdateTransaction) return;

    const dialogData: AllocatedTransactionFormDialogData = {
      budgetLineId: this.data.budgetLine.id,
      budgetId: this.data.budgetLine.budgetId,
      kind: this.data.budgetLine.kind,
      transaction,
    };

    const dialogRef = this.#matDialog.open(AllocatedTransactionFormDialog, {
      data: dialogData,
      width: '400px',
    });

    const result: AllocatedTransactionFormResult | undefined =
      await firstValueFrom(dialogRef.afterClosed());

    if (result?.mode === 'update') {
      await this.data.onUpdateTransaction(
        result.transactionId,
        result.data,
        this.data.budgetLine.id,
        result.originalAmount,
      );
    }
  }

  /**
   * Show confirmation dialog and delete transaction if confirmed
   */
  async confirmDelete(transaction: Transaction): Promise<void> {
    if (!this.data.onDeleteTransaction) return;

    const dialogRef = this.#matDialog.open(ConfirmationDialog, {
      data: {
        title: 'Supprimer la transaction',
        message: `Voulez-vous vraiment supprimer "${transaction.name}" ?`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (confirmed) {
      await this.data.onDeleteTransaction(
        transaction.id,
        transaction.budgetLineId!,
        transaction.amount,
      );
    }
  }
}
