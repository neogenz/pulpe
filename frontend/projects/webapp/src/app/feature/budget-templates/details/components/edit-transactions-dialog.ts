import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Signal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { BudgetTemplatesApi } from '../../services/budget-templates-api';
import { firstValueFrom } from 'rxjs';
import {
  TemplateLine,
  type TemplateLineUpdateWithId,
  type TemplateLinesBulkOperations,
  type TemplateLineCreateWithoutTemplateId,
} from '@pulpe/shared';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmationDialogComponent,
  type ConfirmationDialogData,
} from '../../../../ui/dialogs/confirmation-dialog';

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
  ],
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
                  @if (formGroup.controls.description.hasError('required')) {
                    <mat-error>La description est requise</mat-error>
                  }
                  @if (formGroup.controls.description.hasError('maxlength')) {
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
                  @if (formGroup.controls.amount.hasError('required')) {
                    <mat-error>Le montant est requis</mat-error>
                  }
                  @if (formGroup.controls.amount.hasError('min')) {
                    <mat-error>Le montant doit être positif</mat-error>
                  }
                  @if (formGroup.controls.amount.hasError('max')) {
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
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #dialog = inject(MatDialog);
  readonly data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  // Track new lines and deleted lines
  readonly #newLineIds = new Set<string>();
  readonly #deletedLineIds = new Set<string>();
  readonly #lineIdToOriginalLine = new Map<string, TemplateLine>();
  // Map form index to line ID
  readonly #formIndexToLineId = new Map<number, string>();

  // Loading state management with signals
  readonly #isLoading = signal(false);
  readonly isLoading = this.#isLoading.asReadonly();
  readonly #errorMessage = signal<string | null>(null);
  readonly errorMessage = this.#errorMessage.asReadonly();

  readonly transactionsForm!: FormArray<FormGroup<TransactionFormControls>>;
  #formValuesSignal!: Signal<Partial<TransactionFormData>[]>;
  readonly #formArraySignal = signal<FormArray<
    FormGroup<TransactionFormControls>
  > | null>(null);

  readonly transactionsDataSource = computed(() => {
    const formArray = this.#formArraySignal();
    return formArray ? [...formArray.controls] : [];
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
    // Initialize the ID mapping for original lines
    this.data.originalTemplateLines.forEach((line) => {
      this.#lineIdToOriginalLine.set(line.id, line);
    });

    this.transactionsForm =
      this.#transactionFormService.createTransactionsFormArray(
        this.data.transactions,
      );

    // Map form index to line IDs
    this.transactionsForm.controls.forEach((_, index) => {
      const originalLine = this.data.originalTemplateLines[index];
      if (originalLine) {
        this.#formIndexToLineId.set(index, originalLine.id);
      }
    });

    // Update signal with the created form
    this.#formArraySignal.set(this.transactionsForm);

    this.#formValuesSignal = toSignal(this.transactionsForm.valueChanges, {
      initialValue: this.transactionsForm.value,
    });

    // Configure dialog to prevent closing during loading
    this.#dialogRef.disableClose = true;
  }

  async removeTransaction(index: number): Promise<void> {
    // Prevent removing the last transaction
    if (this.transactionsForm.length <= 1) {
      return;
    }

    const lineId = this.#formIndexToLineId.get(index);

    // If this is an existing line, confirm deletion
    if (lineId && !this.#newLineIds.has(lineId)) {
      const dialogRef = this.#dialog.open(ConfirmationDialogComponent, {
        data: {
          title: 'Confirmer la suppression',
          message: 'Êtes-vous sûr de vouloir supprimer cette prévision ?',
          confirmText: 'Supprimer',
          cancelText: 'Annuler',
          confirmColor: 'warn',
        } as ConfirmationDialogData,
      });

      const result = await firstValueFrom(dialogRef.afterClosed());
      if (!result) {
        return;
      }

      // Track the deletion
      this.#deletedLineIds.add(lineId);
    } else if (lineId && this.#newLineIds.has(lineId)) {
      // If it's a new line, just remove it from the new lines set
      this.#newLineIds.delete(lineId);
    }

    this.#transactionFormService.removeTransactionFromFormArray(
      this.transactionsForm,
      index,
    );

    // Rebuild the index mapping after removal
    this.#rebuildFormIndexMapping();

    // Trigger reactivity by updating the signal
    this.#formArraySignal.set(this.transactionsForm);
  }

  addNewTransaction(): void {
    // Generate a temporary ID for the new line
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create a new form group
    const newFormGroup =
      this.#transactionFormService.createTransactionFormGroup();

    // Track this as a new line
    this.#newLineIds.add(tempId);
    const newIndex = this.transactionsForm.length;
    this.#formIndexToLineId.set(newIndex, tempId);

    // Add to form array
    this.transactionsForm.push(newFormGroup);

    // Trigger reactivity by updating the signal
    this.#formArraySignal.set(this.transactionsForm);
  }

  async save(): Promise<void> {
    if (!this.isFormValid() || this.isLoading()) {
      return;
    }

    this.#isLoading.set(true);
    this.#errorMessage.set(null);

    try {
      const bulkOperations: TemplateLinesBulkOperations = {
        create: [],
        update: [],
        delete: Array.from(this.#deletedLineIds),
      };

      // Process each form group
      this.transactionsForm.controls.forEach((formGroup, index) => {
        const lineId = this.#formIndexToLineId.get(index);
        if (!lineId) return;

        const formData = formGroup.value as TransactionFormData;

        if (this.#newLineIds.has(lineId)) {
          // This is a new line to create
          const createData: TemplateLineCreateWithoutTemplateId = {
            name: formData.description,
            amount: formData.amount,
            kind: formData.type,
            recurrence: 'fixed', // Default recurrence
            description: '', // Default empty description
          };
          bulkOperations.create.push(createData);
        } else if (!this.#deletedLineIds.has(lineId)) {
          // This is an existing line to update (not deleted)
          const originalLine = this.#lineIdToOriginalLine.get(lineId);
          if (originalLine) {
            const updateData: TemplateLineUpdateWithId = {
              id: lineId,
              name: formData.description,
              amount: formData.amount,
              kind: formData.type,
              recurrence: originalLine.recurrence,
              description: originalLine.description,
            };
            bulkOperations.update.push(updateData);
          }
        }
      });

      // Call API to save changes
      const response = await firstValueFrom(
        this.#budgetTemplatesApi.bulkOperationsTemplateLines$(
          this.data.templateId,
          bulkOperations,
        ),
      );

      // Combine all lines for the result
      const allLines = [...response.data.created, ...response.data.updated];

      // Close dialog with updated data
      this.#dialogRef.close({
        saved: true,
        updatedLines: allLines,
      } as EditTransactionsDialogResult);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      this.#errorMessage.set(
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la sauvegarde',
      );
    } finally {
      this.#isLoading.set(false);
    }
  }

  cancel(): void {
    if (this.isLoading()) {
      return; // Prevent closing during loading
    }
    this.#dialogRef.close({ saved: false } as EditTransactionsDialogResult);
  }

  #rebuildFormIndexMapping(): void {
    const oldMapping = new Map(this.#formIndexToLineId);
    this.#formIndexToLineId.clear();

    // Rebuild mapping by finding the lineId for each current form based on values
    this.transactionsForm.controls.forEach((formGroup, newIndex) => {
      const formData = formGroup.value as TransactionFormData;

      // Try to find the matching lineId from the old mapping
      for (const [, lineId] of oldMapping) {
        const originalLine = this.#lineIdToOriginalLine.get(lineId);
        if (
          originalLine &&
          originalLine.name === formData.description &&
          originalLine.amount === formData.amount &&
          originalLine.kind === formData.type
        ) {
          this.#formIndexToLineId.set(newIndex, lineId);
          break;
        } else if (this.#newLineIds.has(lineId)) {
          // For new lines, we need to match by the form data
          // This is a bit fragile but works for this use case
          this.#formIndexToLineId.set(newIndex, lineId);
          break;
        }
      }
    });
  }

  readonly isFormValid = computed(() =>
    this.#transactionFormService.validateTransactionsForm(
      this.transactionsForm,
    ),
  );

  protected readonly runningTotals = computed(() => {
    this.#formValuesSignal(); // Subscribe to form changes
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
}
