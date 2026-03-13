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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import type { TransactionCreate } from 'pulpe-shared';
import { formatLocalDate } from '@core/date/format-local-date';
import type { CreateAllocatedTransactionDialogData } from './create-allocated-transaction-dialog';
import {
  computeBudgetPeriodDateConstraints,
  createDateRangeValidator,
} from './budget-period-date-constraints';

@Component({
  selector: 'pulpe-create-allocated-transaction-bottom-sheet',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
    TranslocoPipe,
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
          {{
            'budget.newTransactionTitle'
              | transloco: { name: data.budgetLine.name }
          }}
        </h2>
        <button
          matIconButton
          (click)="close()"
          [attr.aria-label]="'common.close' | transloco"
        >
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
          <mat-label>{{ 'budget.tableDescription' | transloco }}</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'transactionForm.namePlaceholder' | transloco"
          />
          @if (
            form.get('name')?.hasError('required') && form.get('name')?.touched
          ) {
            <mat-error>{{
              'budget.descriptionRequired' | transloco
            }}</mat-error>
          }
          @if (
            form.get('name')?.hasError('maxlength') && form.get('name')?.touched
          ) {
            <mat-error>{{
              'budget.descriptionMaxLength' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ph-no-capture"
        >
          <mat-label>{{ 'transactionForm.amountLabel' | transloco }}</mat-label>
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
            <mat-error>{{
              'transactionForm.amountRequired' | transloco
            }}</mat-error>
          }
          @if (
            form.get('amount')?.hasError('min') && form.get('amount')?.touched
          ) {
            <mat-error>{{ 'budget.amountMinError' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'budget.dateLabel' | transloco }}</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            [min]="minDate"
            [max]="maxDate"
            formControlName="transactionDate"
            readonly
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          <mat-hint>{{
            'transactionForm.dateHintBudget' | transloco
          }}</mat-hint>
          @if (
            form.get('transactionDate')?.hasError('required') &&
            form.get('transactionDate')?.touched
          ) {
            <mat-error>{{
              'transactionForm.dateRequired' | transloco
            }}</mat-error>
          }
          @if (
            form.get('transactionDate')?.hasError('dateOutOfRange') &&
            form.get('transactionDate')?.touched
          ) {
            <mat-error>{{
              'budget.dateOutOfBudgetPeriod' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <div class="flex items-center justify-between py-2 px-1">
          <span class="text-body-medium text-on-surface">{{
            'transactionForm.checkedToggle' | transloco
          }}</span>
          <mat-slide-toggle
            formControlName="isChecked"
            [attr.aria-label]="'transactionForm.checkedToggle' | transloco"
          />
        </div>
      </form>

      <!-- Action buttons -->
      <div class="flex gap-3 pt-2">
        <button matButton (click)="close()" class="flex-1">
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          matButton="filled"
          (click)="submit()"
          [disabled]="form.invalid"
          class="flex-2"
        >
          <mat-icon>add</mat-icon>
          {{ 'budget.transactionCreateButton' | transloco }}
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
  protected readonly data = inject<CreateAllocatedTransactionDialogData>(
    MAT_BOTTOM_SHEET_DATA,
  );
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<CreateAllocatedTransactionBottomSheet, TransactionCreate>,
  );
  readonly #fb = inject(FormBuilder);

  readonly #dateConstraints = computeBudgetPeriodDateConstraints(
    this.data.budgetMonth,
    this.data.budgetYear,
    this.data.payDayOfMonth,
  );
  protected readonly minDate = this.#dateConstraints.minDate;
  protected readonly maxDate = this.#dateConstraints.maxDate;

  protected readonly form = this.#fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    transactionDate: [
      this.#dateConstraints.defaultDate,
      [
        Validators.required,
        createDateRangeValidator(this.minDate, this.maxDate),
      ],
    ],
    isChecked: [false],
  });

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }

  protected submit(): void {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();

    const transaction: TransactionCreate = {
      budgetId: this.data.budgetLine.budgetId,
      budgetLineId: this.data.budgetLine.id,
      name: formValue.name!.trim(),
      amount: Math.abs(formValue.amount!),
      kind: this.data.budgetLine.kind,
      transactionDate: formatLocalDate(formValue.transactionDate!),
      category: null,
      checkedAt: formValue.isChecked ? new Date().toISOString() : null,
    };

    this.#bottomSheetRef.dismiss(transaction);
  }
}
