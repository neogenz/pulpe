import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import type { TransactionCreate } from 'pulpe-shared';
import type { CreateAllocatedTransactionDialogData } from './create-allocated-transaction-dialog';

@Component({
  selector: 'pulpe-create-allocated-transaction-bottom-sheet',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    ReactiveFormsModule,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6">
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-title-large text-on-surface m-0">
          Nouvelle transaction - {{ data.budgetLine.name }}
        </h2>
        <button matIconButton (click)="close()" aria-label="Fermer">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form -->
      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="flex flex-col gap-4"
        novalidate
      >
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Description</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Ex: Restaurant, Courses..."
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

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Montant</mat-label>
          <input
            matInput
            type="number"
            inputmode="decimal"
            formControlName="amount"
            step="0.01"
            min="0.01"
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

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Date</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            formControlName="transactionDate"
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

      <!-- Action buttons -->
      <div class="flex gap-3 pt-2">
        <button matButton (click)="close()" class="flex-1">Annuler</button>
        <button
          matButton="filled"
          (click)="submit()"
          [disabled]="form.invalid"
          class="flex-2"
        >
          <mat-icon>add</mat-icon>
          Créer
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAllocatedTransactionBottomSheet {
  readonly data = inject<CreateAllocatedTransactionDialogData>(
    MAT_BOTTOM_SHEET_DATA,
  );
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<CreateAllocatedTransactionBottomSheet, TransactionCreate>,
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

  close(): void {
    this.#bottomSheetRef.dismiss();
  }

  submit(): void {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();
    const transactionDate =
      formValue.transactionDate instanceof Date
        ? formValue.transactionDate.toISOString()
        : new Date().toISOString();

    const transaction: TransactionCreate = {
      budgetId: this.data.budgetLine.budgetId,
      budgetLineId: this.data.budgetLine.id,
      name: formValue.name!.trim(),
      amount: formValue.amount!,
      kind: this.data.budgetLine.kind,
      transactionDate,
      category: null,
    };

    this.#bottomSheetRef.dismiss(transaction);
  }
}
