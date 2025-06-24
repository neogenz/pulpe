import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatOptionModule } from '@angular/material/core';
import { CurrencyPipe, CommonModule } from '@angular/common';

interface TransactionFormData {
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'SAVING';
}

interface TransactionFormGroup {
  description: FormControl<string>;
  amount: FormControl<number>;
  type: FormControl<'INCOME' | 'EXPENSE' | 'SAVING'>;
}

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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatOptionModule,
    CurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title class="flex gap-2 items-center">
      <mat-icon class="text-primary">edit</mat-icon>
      <span>Éditer les transactions - {{ data.templateName }}</span>
    </h2>

    <mat-dialog-content>
      <div
        class="sticky top-0 z-10 pb-4 mb-4 border-b bg-surface border-outline-variant"
      >
        <div class="flex justify-between items-center">
          <p class="text-body-large">
            {{ transactionsDataSource().length }} transaction(s)
          </p>
          <button
            mat-raised-button
            color="primary"
            (click)="addNewTransaction()"
            class="flex gap-2 items-center"
          >
            <mat-icon>add</mat-icon>
            Ajouter une transaction
          </button>
        </div>
      </div>

      <div class="overflow-auto">
        <table mat-table [dataSource]="transactionsDataSource()" class="w-full">
          <!-- Description Column -->
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef class="font-medium">
              Description
            </th>
            <td
              mat-cell
              *matCellDef="let formGroup; let i = index"
              class="py-2"
            >
              <mat-form-field appearance="outline" class="w-full">
                <input
                  matInput
                  [formControl]="getFormControl(i, 'description')"
                  placeholder="Description de la transaction"
                />
                @if (getFormControl(i, 'description').hasError('required')) {
                  <mat-error>La description est requise</mat-error>
                }
                @if (getFormControl(i, 'description').hasError('maxlength')) {
                  <mat-error>Maximum 100 caractères</mat-error>
                }
              </mat-form-field>
            </td>
          </ng-container>

          <!-- Amount Column -->
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="font-medium">
              Montant (CHF)
            </th>
            <td
              mat-cell
              *matCellDef="let formGroup; let i = index"
              class="py-2"
            >
              <mat-form-field appearance="outline" class="w-full">
                <input
                  matInput
                  type="number"
                  step="0.01"
                  min="0"
                  [formControl]="getFormControl(i, 'amount')"
                  placeholder="0.00"
                />
                <span matTextSuffix>CHF</span>
                @if (getFormControl(i, 'amount').hasError('required')) {
                  <mat-error>Le montant est requis</mat-error>
                }
                @if (getFormControl(i, 'amount').hasError('min')) {
                  <mat-error>Le montant doit être positif</mat-error>
                }
              </mat-form-field>
            </td>
          </ng-container>

          <!-- Type Column -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef class="font-medium">Type</th>
            <td
              mat-cell
              *matCellDef="let formGroup; let i = index"
              class="py-2"
            >
              <mat-form-field appearance="outline" class="w-full">
                <mat-select [formControl]="getFormControl(i, 'type')">
                  @for (type of transactionTypes; track type.value) {
                    <mat-option [value]="type.value">
                      {{ type.label }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="w-16 font-medium">
              Actions
            </th>
            <td
              mat-cell
              *matCellDef="let formGroup; let i = index"
              class="py-2"
            >
              <button
                mat-icon-button
                color="warn"
                (click)="removeTransaction(i)"
                [disabled]="transactionsDataSource().length <= 1"
                aria-label="Supprimer la transaction"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Annuler</button>
      <button
        mat-raised-button
        color="primary"
        (click)="save()"
        [disabled]="transactionsForm.invalid"
      >
        Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .mat-mdc-form-field {
      width: 100%;
    }

    .mat-mdc-table {
      background: transparent;
    }

    .mat-mdc-header-cell {
      background-color: var(--mat-sys-surface-container-low);
    }

    /* Header sticky avec background et séparation visuelle */
    .sticky {
      position: sticky;
      top: 0;
      background-color: var(--mat-sys-surface);
      z-index: 10;
    }

    .border-outline-variant {
      border-color: var(--mat-sys-outline-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTransactionsDialog {
  #dialogRef = inject(MatDialogRef<EditTransactionsDialog>);
  data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  readonly transactionTypes = [
    { value: 'INCOME', label: 'Revenu' },
    { value: 'EXPENSE', label: 'Dépense' },
    { value: 'SAVING', label: 'Économie' },
  ] as const;

  readonly displayedColumns = [
    'description',
    'amount',
    'type',
    'actions',
  ] as const;

  transactionsForm = new FormArray<FormGroup<TransactionFormGroup>>([]);
  transactionsDataSource = signal<FormGroup<TransactionFormGroup>[]>([]);

  constructor() {
    this.#initializeForm();
  }

  #initializeForm() {
    this.data.transactions.forEach((transaction) => {
      this.#addTransaction(transaction);
    });

    // Ajouter au moins une transaction vide si aucune n'existe
    if (this.transactionsForm.length === 0) {
      this.#addTransaction();
    }

    this.#updateDataSource();
  }

  #addTransaction(transaction?: TransactionFormData) {
    const formGroup = new FormGroup<TransactionFormGroup>({
      description: new FormControl(transaction?.description ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      amount: new FormControl(transaction?.amount ?? 0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0.01)],
      }),
      type: new FormControl(transaction?.type ?? 'EXPENSE', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });

    this.transactionsForm.push(formGroup);
  }

  #updateDataSource() {
    this.transactionsDataSource.set([...this.transactionsForm.controls]);
  }

  removeTransaction(index: number) {
    if (this.transactionsForm.length > 1) {
      this.transactionsForm.removeAt(index);
      this.#updateDataSource();
    }
  }

  addNewTransaction() {
    this.#addTransaction();
    this.#updateDataSource();
  }

  save() {
    if (this.transactionsForm.valid) {
      const transactions = this.transactionsForm.value as TransactionFormData[];
      this.#dialogRef.close({ transactions, saved: true });
    }
  }

  cancel() {
    this.#dialogRef.close({ saved: false });
  }

  getFormControl(
    index: number,
    field: keyof TransactionFormGroup,
  ): FormControl {
    return this.transactionsForm.at(index).get(field) as FormControl;
  }
}
