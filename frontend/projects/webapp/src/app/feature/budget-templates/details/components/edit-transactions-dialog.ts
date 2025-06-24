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
import {
  TransactionFormService,
  TransactionFormData,
  TransactionFormControls,
} from '../../services/transaction-form';
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
    TransactionFormRow,
  ],
  template: `
    <h2 mat-dialog-title class="flex gap-2 items-center">
      <mat-icon class="text-primary">edit</mat-icon>
      <span>Éditer les transactions - {{ data.templateName }}</span>
    </h2>

    <mat-dialog-content class="!p-0 flex flex-col h-[60vh]">
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

      <!-- Table Header -->
      <div class="sticky top-[73px] bg-surface-container z-40 px-4 py-2 border-b border-outline-variant">
        <div class="grid grid-cols-12 gap-4 items-center">
          <div class="col-span-5">
            <span class="text-label-large font-medium text-on-surface">Description</span>
          </div>
          <div class="col-span-3">
            <span class="text-label-large font-medium text-on-surface">Montant</span>
          </div>
          <div class="col-span-3">
            <span class="text-label-large font-medium text-on-surface">Type</span>
          </div>
          <div class="col-span-1 flex justify-center">
            <span class="text-label-large font-medium text-on-surface">Actions</span>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        @for (
          formGroup of transactionsDataSource();
          track trackByIndex($index);
          let i = $index
        ) {
          <pulpe-transaction-form-row
            [formGroup]="formGroup"
            [rowIndex]="i"
            [canRemove]="transactionsDataSource().length > 1"
            (removeClicked)="removeTransaction(i)"
          />
        }
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
}
