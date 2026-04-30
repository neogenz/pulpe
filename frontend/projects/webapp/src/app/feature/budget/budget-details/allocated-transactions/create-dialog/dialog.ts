import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import {
  Field,
  customError,
  form,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { type BudgetLine, type TransactionCreate } from 'pulpe-shared';
import { transactionCreateFromFormSchema } from '../../components/edit-transaction-form';
import { formatLocalDate } from '@core/date/format-local-date';
import {
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
} from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { touchedFieldErrors } from '@core/validators';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { computeBudgetPeriodDateConstraints } from './budget-period-date-constraints';

export interface CreateAllocatedTransactionDialogData {
  budgetLine: BudgetLine;
  budgetMonth: number;
  budgetYear: number;
  payDayOfMonth: number | null;
}

interface CreateAllocatedTransactionModel {
  name: string;
  money: AmountFormSlice;
  transactionDate: Date;
  isChecked: boolean;
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
    MatSlideToggleModule,
    TranslocoPipe,
    Field,
    AmountInput,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{
        'budget.newTransactionTitle' | transloco: { name: data.budgetLine.name }
      }}
    </h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-4">
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>{{ 'budget.tableDescription' | transloco }}</mat-label>
          <input
            matInput
            [field]="transactionForm.name"
            [placeholder]="'transactionForm.namePlaceholder' | transloco"
            data-testid="transaction-name"
          />
          @if (nameErrors().required) {
            <mat-error>{{
              'budget.descriptionRequired' | transloco
            }}</mat-error>
          }
          @if (nameErrors().maxLength) {
            <mat-error>{{
              'budget.descriptionMaxLength' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <pulpe-amount-input [control]="transactionForm.money" />

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'budget.dateLabel' | transloco }}</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            [min]="minDate"
            [max]="maxDate"
            [field]="transactionForm.transactionDate"
            data-testid="transaction-date"
            readonly
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          <mat-hint>{{
            'transactionForm.dateHintBudget' | transloco
          }}</mat-hint>
          @if (dateErrors().required) {
            <mat-error>{{
              'transactionForm.dateRequired' | transloco
            }}</mat-error>
          }
          @if (dateErrors().dateOutOfRange) {
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
            [field]="transactionForm.isChecked"
            [attr.aria-label]="'transactionForm.checkedToggle' | transloco"
          />
        </div>
      </div>
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
        [disabled]="!canSubmit()"
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
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #dialogRef = inject(
    MatDialogRef<CreateAllocatedTransactionDialog, TransactionCreate>,
  );
  readonly data = inject<CreateAllocatedTransactionDialogData>(MAT_DIALOG_DATA);

  readonly #dateConstraints = computeBudgetPeriodDateConstraints(
    this.data.budgetMonth,
    this.data.budgetYear,
    this.data.payDayOfMonth,
  );
  readonly minDate = this.#dateConstraints.minDate;
  readonly maxDate = this.#dateConstraints.maxDate;

  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);

  protected readonly model = signal<CreateAllocatedTransactionModel>({
    name: '',
    money: createAmountSlice({ initialCurrency: this.#settings.currency() }),
    transactionDate: this.#dateConstraints.defaultDate,
    isChecked: false,
  });

  protected readonly transactionForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 100);
    applyAmountValidators(path.money);
    required(path.transactionDate);
    validate(path.transactionDate, ({ value }) => {
      if (!value || !(value instanceof Date) || isNaN(value.getTime()))
        return null;
      const time = value.getTime();
      if (time < this.minDate.getTime() || time > this.maxDate.getTime())
        return customError({ kind: 'dateOutOfRange' });
      return null;
    });
  });

  protected readonly canSubmit = computed(
    () => this.transactionForm().valid() && !this.isSubmitting(),
  );

  protected readonly nameErrors = touchedFieldErrors(
    () => this.transactionForm.name,
    'required',
    'maxLength',
  );
  protected readonly dateErrors = touchedFieldErrors(
    () => this.transactionForm.transactionDate,
    'required',
    'dateOutOfRange',
  );

  cancel(): void {
    this.#dialogRef.close();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.conversionError.set(false);
    this.isSubmitting.set(true);
    try {
      const m = this.model();
      const { convertedAmount, metadata } =
        await this.#converter.convertWithMetadata(
          m.money.amount!,
          m.money.inputCurrency,
          this.#settings.currency(),
        );

      const transaction = transactionCreateFromFormSchema.parse({
        budgetId: this.data.budgetLine.budgetId,
        budgetLineId: this.data.budgetLine.id,
        name: m.name.trim(),
        amount: convertedAmount,
        kind: this.data.budgetLine.kind,
        transactionDate: formatLocalDate(m.transactionDate),
        category: null,
        isChecked: m.isChecked,
        conversion: metadata ?? null,
      });

      this.#dialogRef.close(transaction);
    } catch {
      this.conversionError.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
