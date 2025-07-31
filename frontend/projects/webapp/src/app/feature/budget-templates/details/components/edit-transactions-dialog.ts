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
      <button
        matButton="filled"
        color="primary"
        (click)="save()"
        [disabled]="!isFormValid()"
      >
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
    this.transactionsForm =
      this.#transactionFormService.createTransactionsFormArray(
        this.data.transactions,
      );

    // Update signal with the created form
    this.#formArraySignal.set(this.transactionsForm);

    this.#formValuesSignal = toSignal(this.transactionsForm.valueChanges, {
      initialValue: this.transactionsForm.value,
    });
  }

  removeTransaction(index: number): void {
    this.#transactionFormService.removeTransactionFromFormArray(
      this.transactionsForm,
      index,
    );
    // Trigger reactivity by updating the signal
    this.#formArraySignal.set(this.transactionsForm);
  }

  addNewTransaction(): void {
    this.#transactionFormService.addTransactionToFormArray(
      this.transactionsForm,
    );
    // Trigger reactivity by updating the signal
    this.#formArraySignal.set(this.transactionsForm);
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
