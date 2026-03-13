import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  type BudgetLine,
  type TransactionCreate,
  type SupportedCurrency,
} from 'pulpe-shared';
import { formatLocalDate } from '@core/date/format-local-date';
import { CurrencyConverterService } from '@core/currency';
import {
  computeBudgetPeriodDateConstraints,
  createDateRangeValidator,
} from './budget-period-date-constraints';
import { UserSettingsStore } from '@core/user-settings';

export interface CreateAllocatedTransactionDialogData {
  budgetLine: BudgetLine;
  budgetMonth: number;
  budgetYear: number;
  payDayOfMonth: number | null;
}

@Component({
  selector: 'pulpe-create-allocated-transaction-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{
        'budget.newTransactionTitle' | transloco: { name: data.budgetLine.name }
      }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="flex flex-col gap-4 pt-4">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'budget.tableDescription' | transloco }}</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'transactionForm.namePlaceholder' | transloco"
            data-testid="transaction-name"
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

        <mat-form-field appearance="outline" class="w-full ph-no-capture">
          <mat-label>{{ 'transactionForm.amountLabel' | transloco }}</mat-label>
          <input
            matInput
            type="number"
            formControlName="amount"
            step="0.01"
            min="0.01"
            inputmode="decimal"
            data-testid="transaction-amount"
          />
          @if (showCurrencySelector()) {
            <mat-select
              matTextSuffix
              [value]="inputCurrency()"
              (selectionChange)="inputCurrency.set($event.value)"
              class="!w-[70px] text-on-surface-variant font-medium"
              aria-label="Devise"
            >
              <mat-option value="CHF">CHF</mat-option>
              <mat-option value="EUR">EUR</mat-option>
            </mat-select>
          } @else {
            <span matTextSuffix>{{ currency() }}</span>
          }
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

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'budget.dateLabel' | transloco }}</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            [min]="minDate"
            [max]="maxDate"
            formControlName="transactionDate"
            data-testid="transaction-date"
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
      </form>
    </mat-dialog-content>

    @if (conversionError()) {
      <p class="text-error text-body-small px-6 pb-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" data-testid="cancel-transaction">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="submit()"
        [disabled]="form.invalid"
        data-testid="save-transaction"
      >
        <mat-icon>add</mat-icon>
        {{ 'budget.transactionCreateButton' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAllocatedTransactionDialog {
  readonly #userSettings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  protected readonly currency = this.#userSettings.currency;
  protected readonly showCurrencySelector =
    this.#userSettings.showCurrencySelector;
  protected readonly inputCurrency = signal<SupportedCurrency>(this.currency());
  readonly data = inject<CreateAllocatedTransactionDialogData>(MAT_DIALOG_DATA);
  readonly #dialogRef = inject(
    MatDialogRef<CreateAllocatedTransactionDialog, TransactionCreate>,
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
  });

  protected readonly conversionError = signal(false);

  cancel(): void {
    this.#dialogRef.close();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();

    let convertedAmount: number;
    let metadata: Awaited<
      ReturnType<CurrencyConverterService['convertWithMetadata']>
    >['metadata'];
    try {
      ({ convertedAmount, metadata } =
        await this.#converter.convertWithMetadata(
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
      ...metadata,
    };

    this.#dialogRef.close(transaction);
  }
}
