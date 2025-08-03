import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
  TransactionFormService,
  TransactionFormData,
  TransactionFormControls,
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
import { EditTransactionsState } from '../services/edit-transactions-state';
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
    ReactiveFormsModule,
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
  providers: [EditTransactionsState],
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
              {{ transactionsDataSource().length }} transaction(s)
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
            [dataSource]="transactionsDataSource()"
            class="w-full"
            [class.pointer-events-none]="isLoading()"
          >
            <!-- Description Column -->
            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Description</th>
              <td
                mat-cell
                *matCellDef="let formGroup; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    [formControl]="formGroup.controls.description"
                    placeholder="Description de la transaction"
                  />
                  @if (
                    formGroup.controls.description.touched &&
                    formGroup.controls.description.hasError('required')
                  ) {
                    <mat-error>La description est requise</mat-error>
                  }
                  @if (
                    formGroup.controls.description.touched &&
                    formGroup.controls.description.hasError('maxlength')
                  ) {
                    <mat-error>Maximum 100 caractères</mat-error>
                  }
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Amount Column -->
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Montant</th>
              <td
                mat-cell
                *matCellDef="let formGroup; let i = index"
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
                    [formControl]="formGroup.controls.amount"
                    placeholder="0.00"
                  />
                  <span matTextSuffix>CHF</span>
                  @if (
                    formGroup.controls.amount.touched &&
                    formGroup.controls.amount.hasError('required')
                  ) {
                    <mat-error>Le montant est requis</mat-error>
                  }
                  @if (
                    formGroup.controls.amount.touched &&
                    formGroup.controls.amount.hasError('min')
                  ) {
                    <mat-error>Le montant doit être positif</mat-error>
                  }
                  @if (
                    formGroup.controls.amount.touched &&
                    formGroup.controls.amount.hasError('max')
                  ) {
                    <mat-error
                      >Le montant ne peut pas dépasser 999'999 CHF</mat-error
                    >
                  }
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Type Column -->
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td
                mat-cell
                *matCellDef="let formGroup; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <mat-select [formControl]="formGroup.controls.type">
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
                *matCellDef="let formGroup; let i = index"
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
                *matCellDef="let formGroup; let i = index"
                class="!p-4"
              >
                <button
                  matIconButton
                  color="warn"
                  (click)="removeTransaction(i)"
                  [disabled]="
                    transactionsDataSource().length <= 1 || isLoading()
                  "
                  [attr.aria-disabled]="
                    transactionsDataSource().length <= 1 || isLoading()
                  "
                  [matTooltip]="
                    transactionsDataSource().length <= 1
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
        [disabled]="!isFormValid() || isLoading()"
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
  readonly #transactionFormService = inject(TransactionFormService);
  readonly #dialog = inject(MatDialog);
  readonly #state = inject(EditTransactionsState);
  readonly data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  // Form array for reactive forms integration
  readonly transactionsForm!: FormArray<FormGroup<TransactionFormControls>>;

  // Expose state signals directly
  readonly isLoading = this.#state.isLoading;
  readonly errorMessage = this.#state.error;
  readonly hasUnsavedChanges = this.#state.hasUnsavedChanges;
  readonly canRemoveTransaction = this.#state.canRemoveTransaction;

  // Create form array that reflects current state
  readonly transactionsDataSource = computed(() => {
    const transactions = this.#state.transactions().filter((t) => !t.isDeleted);
    return transactions.map((t) => this.#createFormGroupFromTransaction(t));
  });

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

  async removeTransaction(index: number): Promise<void> {
    if (!this.canRemoveTransaction()) {
      return;
    }

    // Show confirmation dialog
    const confirmed = await this.#showConfirmationDialog();
    if (!confirmed) {
      return;
    }

    // Get the transaction ID from the state
    const transactions = this.#state.transactions().filter((t) => !t.isDeleted);
    const transaction = transactions[index];
    if (transaction) {
      this.#state.removeTransaction(transaction.id);
    }
  }

  addNewTransaction(): void {
    this.#state.addTransaction({
      description: '',
      amount: 0,
      type: 'FIXED_EXPENSE',
    });
  }

  async save(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    // Sync current form values to state before saving
    this.#syncFormValuesToState();

    // Perform save
    const result = await this.#state.saveChanges(this.data.templateId);

    if (result.success) {
      this.#dialogRef.close({
        saved: true,
        updatedLines: result.updatedLines,
      } as EditTransactionsDialogResult);
    }
    // Errors are handled by the state service and displayed via errorMessage signal
  }

  cancel(): void {
    if (this.isLoading()) {
      return;
    }
    this.#dialogRef.close({ saved: false } as EditTransactionsDialogResult);
  }

  readonly isFormValid = computed(() => {
    // For now, use simple validation - could be enhanced to sync with state
    return this.transactionsDataSource().every((formGroup) => formGroup.valid);
  });

  protected readonly runningTotals = computed(() => {
    const formGroups = this.transactionsDataSource();
    let runningTotal = 0;

    return formGroups.map((formGroup) => {
      const amount = formGroup.get('amount')?.value ?? 0;
      const type = formGroup.get('type')?.value ?? 'FIXED_EXPENSE';

      switch (type) {
        case 'INCOME':
        case 'SAVINGS_CONTRIBUTION':
          runningTotal += amount;
          break;
        case 'FIXED_EXPENSE':
          runningTotal -= amount;
          break;
      }

      return runningTotal;
    });
  });

  /**
   * Create a reactive form group from a transaction state
   */
  #createFormGroupFromTransaction(transaction: {
    formData: TransactionFormData;
  }): FormGroup<TransactionFormControls> {
    return this.#transactionFormService.createTransactionFormGroup(
      transaction.formData,
    );
  }

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

    return firstValueFrom(dialogRef.afterClosed()) || false;
  }

  /**
   * Sync current form values back to the state
   * This is called before saving to ensure the state is up-to-date
   */
  #syncFormValuesToState(): void {
    const formGroups = this.transactionsDataSource();
    const activeTransactions = this.#state
      .transactions()
      .filter((t) => !t.isDeleted);

    formGroups.forEach((formGroup, index) => {
      const transaction = activeTransactions[index];
      if (transaction && formGroup.value) {
        const formData = formGroup.value as TransactionFormData;
        this.#state.updateTransaction(transaction.id, formData);
      }
    });
  }
}
