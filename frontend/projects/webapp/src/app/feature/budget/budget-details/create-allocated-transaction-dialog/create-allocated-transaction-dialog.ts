import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import type { BudgetLine, TransactionCreate } from 'pulpe-shared';
import { formatLocalDate } from '@core/date/format-local-date';

export interface CreateAllocatedTransactionDialogData {
  budgetLine: BudgetLine;
}

@Component({
  selector: 'pulpe-create-allocated-transaction-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      Nouvelle transaction - {{ data.budgetLine.name }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="flex flex-col gap-4 pt-4">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Description</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Ex: Restaurant, Courses..."
            data-testid="transaction-name"
          />
          @if (
            form.get('name')?.hasError('required') && form.get('name')?.touched
          ) {
            <mat-error>La description est requise</mat-error>
          }
          @if (
            form.get('name')?.hasError('maxlength') && form.get('name')?.touched
          ) {
            <mat-error>100 caractères maximum</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Montant</mat-label>
          <input
            matInput
            type="number"
            formControlName="amount"
            step="0.01"
            min="0.01"
            data-testid="transaction-amount"
          />
          <span matTextSuffix>CHF</span>
          @if (
            form.get('amount')?.hasError('required') &&
            form.get('amount')?.touched
          ) {
            <mat-error>Le montant est requis</mat-error>
          }
          @if (
            form.get('amount')?.hasError('min') && form.get('amount')?.touched
          ) {
            <mat-error>Le montant doit être supérieur à 0</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Date</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            formControlName="transactionDate"
            data-testid="transaction-date"
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (
            form.get('transactionDate')?.hasError('required') &&
            form.get('transactionDate')?.touched
          ) {
            <mat-error>La date est requise</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" data-testid="cancel-transaction">
        Annuler
      </button>
      <button
        matButton="filled"
        (click)="submit()"
        [disabled]="form.invalid"
        data-testid="save-transaction"
      >
        <mat-icon>add</mat-icon>
        Créer
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAllocatedTransactionDialog {
  readonly data = inject<CreateAllocatedTransactionDialogData>(MAT_DIALOG_DATA);
  readonly #dialogRef = inject(
    MatDialogRef<CreateAllocatedTransactionDialog, TransactionCreate>,
  );
  readonly #fb = inject(FormBuilder);

  readonly form = this.#fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    transactionDate: [new Date(), Validators.required],
  });

  cancel(): void {
    this.#dialogRef.close();
  }

  submit(): void {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();
    const transactionDate =
      formValue.transactionDate instanceof Date
        ? formatLocalDate(formValue.transactionDate)
        : formatLocalDate(new Date());

    const transaction: TransactionCreate = {
      budgetId: this.data.budgetLine.budgetId,
      budgetLineId: this.data.budgetLine.id,
      name: formValue.name!.trim(),
      amount: formValue.amount!,
      kind: this.data.budgetLine.kind,
      transactionDate,
      category: null,
    };

    this.#dialogRef.close(transaction);
  }
}
