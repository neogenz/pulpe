import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { CdkTableModule } from '@angular/cdk/table';
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
import TransactionFormRow from './transaction-form-row';

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
    CdkTableModule,
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
      <div class="sticky top-0 bg-surface z-50 p-4 border-b border-outline-variant">
        <div class="flex justify-between items-center">
          <p class="text-body-large">{{ transactionsDataSource().length }} transaction(s)</p>
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

      <div class="max-h-[50vh] overflow-auto">
        <cdk-table [dataSource]="transactionsDataSource()" class="w-full">
          <!-- Description Column -->
          <ng-container cdkColumnDef="description">
            <cdk-header-cell *cdkHeaderCellDef class="sticky top-0 z-40 bg-surface border-b border-outline-variant p-4 font-medium">
              Description
            </cdk-header-cell>
            <cdk-cell *cdkCellDef="let formGroup; let i = index" class="p-4 border-b border-outline-variant">
              <mat-form-field appearance="outline" class="w-full">
                <input
                  matInput
                  [formControl]="getFormControl(formGroup, 'description')"
                  placeholder="Description de la transaction"
                />
                @if (getFormControl(formGroup, 'description').hasError('required')) {
                  <mat-error>La description est requise</mat-error>
                }
                @if (getFormControl(formGroup, 'description').hasError('maxlength')) {
                  <mat-error>Maximum 100 caractères</mat-error>
                }
              </mat-form-field>
            </cdk-cell>
          </ng-container>

          <!-- Amount Column -->
          <ng-container cdkColumnDef="amount">
            <cdk-header-cell *cdkHeaderCellDef class="sticky top-0 z-40 bg-surface border-b border-outline-variant p-4 font-medium">
              Montant
            </cdk-header-cell>
            <cdk-cell *cdkCellDef="let formGroup; let i = index" class="p-4 border-b border-outline-variant">
              <mat-form-field appearance="outline" class="w-full">
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
                @if (getFormControl(formGroup, 'amount').hasError('required')) {
                  <mat-error>Le montant est requis</mat-error>
                }
                @if (getFormControl(formGroup, 'amount').hasError('min')) {
                  <mat-error>Le montant doit être positif</mat-error>
                }
                @if (getFormControl(formGroup, 'amount').hasError('max')) {
                  <mat-error>Le montant ne peut pas dépasser 999'999 CHF</mat-error>
                }
              </mat-form-field>
            </cdk-cell>
          </ng-container>

          <!-- Type Column -->
          <ng-container cdkColumnDef="type">
            <cdk-header-cell *cdkHeaderCellDef class="sticky top-0 z-40 bg-surface border-b border-outline-variant p-4 font-medium">
              Type
            </cdk-header-cell>
            <cdk-cell *cdkCellDef="let formGroup; let i = index" class="p-4 border-b border-outline-variant">
              <mat-form-field appearance="outline" class="w-full">
                <mat-select [formControl]="getFormControl(formGroup, 'type')">
                  @for (type of transactionTypes; track type.value) {
                    <mat-option [value]="type.value">
                      {{ type.label }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </cdk-cell>
          </ng-container>

          <!-- Actions Column -->
          <ng-container cdkColumnDef="actions">
            <cdk-header-cell *cdkHeaderCellDef class="sticky top-0 z-40 bg-surface border-b border-outline-variant p-4 font-medium text-center">
              Actions
            </cdk-header-cell>
            <cdk-cell *cdkCellDef="let formGroup; let i = index" class="p-4 border-b border-outline-variant text-center">
              <button
                mat-icon-button
                color="warn"
                (click)="removeTransaction(i)"
                [disabled]="transactionsDataSource().length <= 1"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </cdk-cell>
          </ng-container>

          <cdk-header-row *cdkHeaderRowDef="displayedColumns" class="flex"></cdk-header-row>
          <cdk-row *cdkRowDef="let row; columns: displayedColumns;" class="flex border-b border-outline-variant"></cdk-row>
        </cdk-table>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Annuler</button>
      <button
        mat-raised-button
        color="primary"
        (click)="save()"
        [disabled]="!isFormValid()"
      >
        Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class EditTransactionsDialog {
  readonly #dialogRef = inject(MatDialogRef<EditTransactionsDialog>);
  readonly #transactionFormService = inject(TransactionFormService);
  readonly data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  readonly transactionsForm: FormArray<FormGroup<TransactionFormControls>>;
  readonly #updateTrigger = signal(0);

  readonly transactionsDataSource = computed(() => {
    this.#updateTrigger(); // Subscribe to trigger
    return [...this.transactionsForm.controls];
  });

  protected readonly displayedColumns = ['description', 'amount', 'type', 'actions'];
  protected readonly transactionTypes = TRANSACTION_TYPES;

  constructor() {
    this.transactionsForm =
      this.#transactionFormService.createTransactionsFormArray(
        this.data.transactions,
      );
  }

  removeTransaction(index: number): void {
    this.#transactionFormService.removeTransactionFromFormArray(
      this.transactionsForm,
      index,
    );
    this.#updateTrigger.update(v => v + 1);
  }

  addNewTransaction(): void {
    this.#transactionFormService.addTransactionToFormArray(
      this.transactionsForm,
    );
    this.#updateTrigger.update(v => v + 1);
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

  protected getFormControl(formGroup: FormGroup<TransactionFormControls>, field: keyof TransactionFormControls): FormControl {
    return formGroup.get(field) as FormControl;
  }
}
