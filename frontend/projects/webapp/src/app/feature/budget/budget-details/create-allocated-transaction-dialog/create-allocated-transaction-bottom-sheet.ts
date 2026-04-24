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
import { CurrencySuffix } from '@ui/currency-suffix';
import { TranslocoPipe } from '@jsverse/transloco';
import type { TransactionCreate } from 'pulpe-shared';
import { formatLocalDate } from '@core/date/format-local-date';
import type { CurrencyConverterService } from '@core/currency';
import {
  injectCurrencyFormConfig,
  injectLiveConversionPreview,
} from '@core/currency';
import { toSignal } from '@angular/core/rxjs-interop';
import { ConversionPreviewLine } from '@ui/conversion-preview-line';
import type { CreateAllocatedTransactionDialogData } from './create-allocated-transaction-dialog';
import {
  computeBudgetPeriodDateConstraints,
  createDateRangeValidator,
} from './budget-period-date-constraints';
import { UserSettingsStore } from '@core/user-settings';

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
    CurrencySuffix,
    ConversionPreviewLine,
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

        <div class="flex flex-col">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="ph-no-capture"
          >
            <mat-label>{{
              'transactionForm.amountLabel' | transloco
            }}</mat-label>
            <input
              matInput
              type="number"
              inputmode="decimal"
              formControlName="amount"
              step="0.01"
              min="0.01"
            />
            <pulpe-currency-suffix
              matTextSuffix
              [showSelector]="showCurrencySelector()"
              [currency]="inputCurrency()"
              (currencyChange)="inputCurrency.set($event)"
            />
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

          <pulpe-conversion-preview-line
            [amount]="preview().convertedAmount ?? null"
            [inputCurrency]="inputCurrency()"
            [displayCurrency]="currency()"
            [rate]="preview().rate ?? null"
            [cachedDate]="preview().cachedDate ?? null"
            [status]="preview().status"
          />
        </div>

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

      @if (conversionError()) {
        <p class="text-error text-body-small pb-2">
          {{ 'common.conversionError' | transloco }}
        </p>
      }

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
  readonly #userSettings = inject(UserSettingsStore);
  readonly #currencyConfig = injectCurrencyFormConfig();
  protected readonly currency = this.#userSettings.currency;
  protected readonly showCurrencySelector =
    this.#currencyConfig.showCurrencySelector;
  protected readonly inputCurrency = this.#currencyConfig.inputCurrency;
  protected readonly conversionError = this.#currencyConfig.conversionError;
  readonly data = inject<CreateAllocatedTransactionDialogData>(
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
  readonly minDate = this.#dateConstraints.minDate;
  readonly maxDate = this.#dateConstraints.maxDate;

  readonly form = this.#fb.group({
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

  readonly #amountValue = toSignal(this.form.controls.amount.valueChanges, {
    initialValue: this.form.controls.amount.value,
  });
  protected readonly preview = injectLiveConversionPreview(
    this.#amountValue,
    this.inputCurrency,
    this.currency,
  );

  close(): void {
    this.#bottomSheetRef.dismiss();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();

    this.conversionError.set(false);
    let convertedAmount: number;
    let metadata: Awaited<
      ReturnType<CurrencyConverterService['convertWithMetadata']>
    >['metadata'];
    try {
      ({ convertedAmount, metadata } =
        await this.#currencyConfig.converter.convertWithMetadata(
          formValue.amount!,
          this.inputCurrency(),
          this.currency(),
        ));
    } catch {
      this.conversionError.set(true);
      return;
    }

    const transaction: TransactionCreate = {
      budgetId: this.data.budgetLine.budgetId,
      budgetLineId: this.data.budgetLine.id,
      name: formValue.name!.trim(),
      amount: convertedAmount,
      kind: this.data.budgetLine.kind,
      transactionDate: formatLocalDate(formValue.transactionDate!),
      category: null,
      checkedAt: formValue.isChecked ? new Date().toISOString() : null,
      ...metadata,
    };

    this.#bottomSheetRef.dismiss(transaction);
  }
}
