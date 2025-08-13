import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import {
  TransactionFormData,
  TRANSACTION_TYPES,
} from '../../services/transaction-form';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TemplateLine } from '@pulpe/shared';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmationDialogComponent,
  type ConfirmationDialogData,
} from '../../../../ui/dialogs/confirmation-dialog';
import { EditTransactionsStore } from '../services/edit-transactions-store';
import type { EditableTransaction } from '../services/edit-transactions-state';
import { firstValueFrom } from 'rxjs';

interface EditTransactionsDialogData {
  transactions: TransactionFormData[];
  templateName: string;
  templateId: string;
  originalTemplateLines: TemplateLine[];
}

interface EditTransactionsDialogResult {
  saved: boolean;
  updatedLines?: TemplateLine[];
  error?: string;
}

@Component({
  selector: 'pulpe-edit-transactions-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  providers: [EditTransactionsStore],
  template: `
    <h2 mat-dialog-title class="flex gap-2 items-center">
      <mat-icon class="text-primary">edit</mat-icon>
      <span>Éditer les transactions - {{ data.templateName }}</span>
    </h2>

    <mat-dialog-content class="!p-0">
      <!-- Progress bar at the top when loading -->
      @if (isLoading()) {
        <mat-progress-bar
          mode="indeterminate"
          class="!h-1"
          aria-label="Sauvegarde en cours"
        ></mat-progress-bar>
      }

      <div class="flex flex-col h-full">
        <!-- Fixed header -->
        <div class="flex-shrink-0 p-4 border-b border-outline-variant">
          <div class="flex justify-between items-center">
            <p class="text-body-large">
              {{ transactions().length }} transaction(s)
            </p>
            <button
              matButton="tonal"
              (click)="addNewTransaction()"
              [disabled]="isLoading()"
              class="items-center"
            >
              <mat-icon>add</mat-icon>
              Ajouter une transaction
            </button>
          </div>
        </div>

        <!-- Table container with fixed height -->
        <div class="overflow-auto flex-1 relative">
          <!-- Subtle loading overlay that preserves data visibility -->
          @if (isLoading()) {
            <div
              class="absolute inset-0 bg-surface/20 z-10"
              aria-hidden="true"
            ></div>
          }

          <table
            mat-table
            [dataSource]="transactions()"
            [trackBy]="trackByTransactionId"
            class="w-full"
            [class.pointer-events-none]="isLoading()"
          >
            <!-- Description Column -->
            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Description</th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    [value]="transaction.formData.description"
                    (input)="updateDescription(transaction.id, $event)"
                    placeholder="Description de la transaction"
                    [attr.id]="'desc-' + transaction.id"
                  />
                  @if (!transaction.formData.description?.trim()) {
                    <mat-error>La description est requise</mat-error>
                  }
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Amount Column -->
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Montant</th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    type="number"
                    step="0.01"
                    min="0"
                    max="999999"
                    [value]="transaction.formData.amount"
                    (input)="updateAmount(transaction.id, $event)"
                    placeholder="0.00"
                    [attr.id]="'amount-' + transaction.id"
                  />
                  <span matTextSuffix>CHF</span>
                  @if (transaction.formData.amount < 0) {
                    <mat-error>Le montant doit être positif</mat-error>
                  }
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Type Column -->
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <mat-select
                    [value]="transaction.formData.type"
                    (selectionChange)="updateType(transaction.id, $event.value)"
                    [attr.id]="'type-' + transaction.id"
                  >
                    @for (type of transactionTypes; track type.value) {
                      <mat-option [value]="type.value">
                        {{ type.label }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Total Column -->
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4 text-right"
              >
                <span
                  [class.text-financial-income]="runningTotals()[i] >= 0"
                  [class.text-financial-negative]="runningTotals()[i] < 0"
                  class="font-medium"
                >
                  {{
                    runningTotals()[i]
                      | currency: 'CHF' : 'symbol' : '1.2-2' : 'fr-CH'
                  }}
                </span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-center">
                Actions
              </th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <button
                  matIconButton
                  color="warn"
                  (click)="removeTransaction(transaction.id)"
                  [disabled]="!canRemoveTransaction() || isLoading()"
                  [attr.aria-disabled]="!canRemoveTransaction() || isLoading()"
                  [matTooltip]="
                    !canRemoveTransaction()
                      ? 'Au moins une ligne est requise'
                      : 'Supprimer cette ligne'
                  "
                  matTooltipPosition="left"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr
              mat-header-row
              *matHeaderRowDef="displayedColumns; sticky: true"
            ></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: displayedColumns; let odd = odd"
              [class.!bg-surface-container-highest]="odd"
            ></tr>
          </table>
        </div>

        <!-- Error message display -->
        @if (errorMessage(); as error) {
          <div
            class="p-4 mt-4 bg-error-container rounded-lg"
            role="alert"
            aria-live="polite"
          >
            <div class="flex items-center gap-2">
              <mat-icon class="text-error" aria-hidden="true">error</mat-icon>
              <span class="text-on-error-container">{{ error }}</span>
            </div>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" [disabled]="isLoading()">
        Annuler
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="save()"
        [disabled]="!isValid() || isLoading()"
      >
        <div class="flex items-center gap-2">
          @if (isLoading()) {
            <mat-spinner
              diameter="16"
              strokeWidth="2"
              aria-hidden="true"
            ></mat-spinner>
          }
          <span>Enregistrer</span>
        </div>
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      --mat-table-background-color: var(--mat-sys-surface-container-high);
      .mat-mdc-dialog-content {
        max-height: unset;
      }
    }

    /* Clean Mat-Table styling - let Material handle sticky headers */
    .mat-column-description {
      width: 100%;
    }
    .mat-column-amount {
      width: min-content;
    }
    .mat-column-type {
      width: min-content;
    }
    .mat-column-total {
      width: min-content;
      text-align: right;
    }
    .mat-column-actions {
      width: min-content;
    }

    /* Properly align spinner and text in Material button */
    .save-button {
      .mdc-button__label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class EditTransactionsDialog {
  readonly #dialogRef = inject(MatDialogRef<EditTransactionsDialog>);
  readonly #dialog = inject(MatDialog);
  readonly #state = inject(EditTransactionsStore);
  readonly data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  // Expose state signals directly
  readonly isLoading = this.#state.isLoading;
  readonly errorMessage = this.#state.error;
  readonly hasUnsavedChanges = this.#state.hasUnsavedChanges;
  readonly canRemoveTransaction = this.#state.canRemoveTransaction;
  readonly isValid = this.#state.isValid;

  // Get active (non-deleted) transactions from state
  readonly transactions = this.#state.activeTransactions;

  protected readonly displayedColumns: readonly string[] = [
    'description',
    'amount',
    'type',
    'total',
    'actions',
  ];
  protected readonly transactionTypes = TRANSACTION_TYPES;

  constructor() {
    // Initialize the state service
    this.#state.initialize(
      this.data.originalTemplateLines,
      this.data.transactions,
    );

    // Configure dialog to prevent closing during loading
    this.#dialogRef.disableClose = true;
  }

  async removeTransaction(transactionId: string): Promise<void> {
    if (!this.canRemoveTransaction()) {
      return;
    }

    // Show confirmation dialog
    const confirmed = await this.#showConfirmationDialog();
    if (!confirmed) {
      return;
    }

    this.#state.removeTransaction(transactionId);
  }

  addNewTransaction(): void {
    this.#state.addTransaction({
      description: '',
      amount: 0,
      type: 'expense',
    });
  }

  async save(): Promise<void> {
    if (this.isLoading() || !this.isValid()) return;

    // Perform save - no sync needed as state is already up-to-date
    const result = await this.#state.saveChanges(this.data.templateId);

    if (!result.success) return;

    this.#dialogRef.close({
      saved: true,
      updatedLines: result.updatedLines,
    } as EditTransactionsDialogResult);
  }

  cancel(): void {
    if (this.isLoading()) return;

    this.#dialogRef.close({ saved: false } as EditTransactionsDialogResult);
  }

  protected readonly runningTotals = computed(() => {
    let runningTotal = 0;
    return this.transactions().map((transaction) => {
      const amount = transaction.formData.amount;
      const type = transaction.formData.type;

      switch (type) {
        case 'income':
        case 'saving':
          runningTotal += amount;
          break;
        case 'expense':
          runningTotal -= amount;
          break;
      }

      return runningTotal;
    });
  });

  updateDescription(transactionId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.#state.updateTransaction(transactionId, { description: value });
  }

  updateAmount(transactionId: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.#state.updateTransaction(transactionId, { amount: value });
  }

  updateType(transactionId: string, value: TransactionFormData['type']): void {
    this.#state.updateTransaction(transactionId, { type: value });
  }

  protected trackByTransactionId = (
    _index: number,
    transaction: EditableTransaction,
  ): string => {
    return transaction.id;
  };

  /**
   * Show confirmation dialog for transaction removal
   */
  async #showConfirmationDialog(): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Confirmer la suppression',
        message: 'Êtes-vous sûr de vouloir supprimer cette ligne ?',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        confirmColor: 'warn',
      } as ConfirmationDialogData,
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result || false;
  }
}
