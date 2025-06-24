import {
  ChangeDetectionStrategy,
  Component,
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
            aria-label="Ajouter une nouvelle transaction"
          >
            <mat-icon>add</mat-icon>
            Ajouter une transaction
          </button>
        </div>
      </div>

      <div class="space-y-4 overflow-auto max-h-[60vh]">
        @for (
          formGroup of transactionsDataSource();
          track trackByIndex($index, formGroup);
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
  styles: `
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
export default class EditTransactionsDialog {
  readonly #dialogRef = inject(MatDialogRef<EditTransactionsDialog>);
  readonly #transactionFormService = inject(TransactionFormService);
  readonly data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  readonly transactionsForm: FormArray<FormGroup<TransactionFormControls>>;

  readonly transactionsDataSource = signal<
    FormGroup<TransactionFormControls>[]
  >([]);

  constructor() {
    this.transactionsForm =
      this.#transactionFormService.createTransactionsFormArray(
        this.data.transactions,
      );
    this.#updateDataSource();
  }

  #updateDataSource(): void {
    this.transactionsDataSource.set([...this.transactionsForm.controls]);
  }

  removeTransaction(index: number): void {
    const success = this.#transactionFormService.removeTransactionFromFormArray(
      this.transactionsForm,
      index,
    );

    if (success) {
      this.#updateDataSource();
    }
  }

  addNewTransaction(): void {
    this.#transactionFormService.addTransactionToFormArray(
      this.transactionsForm,
    );
    this.#updateDataSource();
  }

  trackByIndex(
    index: number,
    item: FormGroup<TransactionFormControls>,
  ): FormGroup<TransactionFormControls> {
    return item;
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

  isFormValid(): boolean {
    return this.#transactionFormService.validateTransactionsForm(
      this.transactionsForm,
    );
  }
}
