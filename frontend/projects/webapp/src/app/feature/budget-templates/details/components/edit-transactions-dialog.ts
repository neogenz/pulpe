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
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import {
  TransactionFormService,
  TransactionFormData,
  TransactionFormControls,
  TRANSACTION_TYPES,
} from '../../services/transaction-form';
import { FormControl } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

interface EditTransactionsDialogData {
  transactions: TransactionFormData[];
  templateName: string;
}

@Component({
  selector: 'pulpe-edit-transactions-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
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
              class="items-center"
            >
              <mat-icon>add</mat-icon>
              Ajouter une transaction
            </button>
          </div>
        </div>

        <!-- Table container with fixed height -->
        <div class="overflow-auto flex-1">
          <table
            mat-table
            [dataSource]="transactionsDataSource()"
            class="w-full"
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
                    [formControl]="getFormControl(formGroup, 'description')"
                    placeholder="Description de la transaction"
                  />
                  @if (
                    getFormControl(formGroup, 'description').hasError(
                      'required'
                    )
                  ) {
                    <mat-error>La description est requise</mat-error>
                  }
                  @if (
                    getFormControl(formGroup, 'description').hasError(
                      'maxlength'
                    )
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
                    [formControl]="getFormControl(formGroup, 'amount')"
                    placeholder="0.00"
                  />
                  <span matTextSuffix>CHF</span>
                  @if (
                    getFormControl(formGroup, 'amount').hasError('required')
                  ) {
                    <mat-error>Le montant est requis</mat-error>
                  }
                  @if (getFormControl(formGroup, 'amount').hasError('min')) {
                    <mat-error>Le montant doit être positif</mat-error>
                  }
                  @if (getFormControl(formGroup, 'amount').hasError('max')) {
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
                  <mat-select [formControl]="getFormControl(formGroup, 'type')">
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
                  [class.text-green-600]="runningTotals()[i] >= 0"
                  [class.text-red-600]="runningTotals()[i] < 0"
                  class="font-medium"
                >
                  {{ runningTotals()[i] | currency: 'CHF':'symbol':'1.2-2':'fr-CH' }}
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
                  [disabled]="transactionsDataSource().length <= 1"
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
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()">Annuler</button>
      <button matButton="filled" (click)="save()" [disabled]="!isFormValid()">
        Enregistrer
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class EditTransactionsDialog {
  readonly #dialogRef = inject(MatDialogRef<EditTransactionsDialog>);
  readonly #transactionFormService = inject(TransactionFormService);
  readonly data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  readonly transactionsForm: FormArray<FormGroup<TransactionFormControls>>;
  readonly #updateTrigger = signal(0);
  readonly #formValuesSignal: Signal<Partial<TransactionFormData>[]>;

  readonly transactionsDataSource = computed(() => {
    this.#updateTrigger(); // Subscribe to trigger
    return [...this.transactionsForm.controls];
  });

  protected readonly displayedColumns = [
    'description',
    'amount',
    'type',
    'total',
    'actions',
  ];
  protected readonly transactionTypes = TRANSACTION_TYPES;

  constructor() {
    this.transactionsForm =
      this.#transactionFormService.createTransactionsFormArray(
        this.data.transactions,
      );
    
    this.#formValuesSignal = toSignal(this.transactionsForm.valueChanges, {
      initialValue: this.transactionsForm.value,
    });
  }

  removeTransaction(index: number): void {
    this.#transactionFormService.removeTransactionFromFormArray(
      this.transactionsForm,
      index,
    );
    this.#updateTrigger.update((v) => v + 1);
  }

  addNewTransaction(): void {
    this.#transactionFormService.addTransactionToFormArray(
      this.transactionsForm,
    );
    this.#updateTrigger.update((v) => v + 1);
  }

  trackByIndex(index: number): number {
    return index;
  }

  save(): void {
    if (this.isFormValid()) {
      const transactions = this.#transactionFormService.getTransactionFormData(
        this.transactionsForm,
      );
      this.#dialogRef.close({ transactions, saved: true });
    }
  }

  cancel(): void {
    this.#dialogRef.close({ saved: false });
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
    
    return formGroups.map(formGroup => {
      const amount = formGroup.get('amount')?.value ?? 0;
      const type = formGroup.get('type')?.value ?? 'EXPENSE';
      
      switch (type) {
        case 'INCOME':
        case 'SAVING':
          runningTotal += amount;
          break;
        case 'EXPENSE':
          runningTotal -= amount;
          break;
      }
      
      return runningTotal;
    });
  });

  protected getFormControl(
    formGroup: FormGroup<TransactionFormControls>,
    field: keyof TransactionFormControls,
  ): FormControl {
    return formGroup.get(field) as FormControl;
  }
}
