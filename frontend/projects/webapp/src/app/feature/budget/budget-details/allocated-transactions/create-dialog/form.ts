import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
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
  runFormSubmit,
  StaleRateNotifier,
} from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { touchedFieldErrors } from '@core/validators';
import { Logger } from '@core/logging/logger';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { computeBudgetPeriodDateConstraints } from './budget-period-date-constraints';

export interface CreateAllocatedTransactionFormData {
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
  selector: 'pulpe-create-allocated-transaction-form',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    TranslocoPipe,
    Field,
    AmountInput,
  ],
  template: `
    <form
      (ngSubmit)="submit()"
      class="flex flex-col gap-4"
      novalidate
      [attr.aria-label]="'transactionForm.formAriaLabel' | transloco"
    >
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
          <mat-error>{{ 'budget.descriptionRequired' | transloco }}</mat-error>
        } @else if (nameErrors().maxLength) {
          <mat-error>{{ 'budget.descriptionMaxLength' | transloco }}</mat-error>
        }
      </mat-form-field>

      <pulpe-amount-input [control]="transactionForm.money" />

      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{ 'budget.dateLabel' | transloco }}</mat-label>
        <input
          matInput
          [matDatepicker]="picker"
          [min]="minDate()"
          [max]="maxDate()"
          [field]="transactionForm.transactionDate"
          data-testid="transaction-date"
          readonly
        />
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-datepicker #picker />
        <mat-hint>{{ 'transactionForm.dateHintBudget' | transloco }}</mat-hint>
        @if (dateErrors().required) {
          <mat-error>{{
            'transactionForm.dateRequired' | transloco
          }}</mat-error>
        } @else if (dateErrors().dateOutOfRange) {
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
    </form>

    @if (conversionError()) {
      <p role="alert" class="text-error text-body-small pt-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAllocatedTransactionForm {
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #staleRateNotifier = inject(StaleRateNotifier);

  readonly data = input.required<CreateAllocatedTransactionFormData>();
  readonly created = output<TransactionCreate>();

  readonly #dateConstraints = computed(() =>
    computeBudgetPeriodDateConstraints(
      this.data().budgetMonth,
      this.data().budgetYear,
      this.data().payDayOfMonth,
    ),
  );
  protected readonly minDate = computed(() => this.#dateConstraints().minDate);
  protected readonly maxDate = computed(() => this.#dateConstraints().maxDate);

  protected readonly conversionError = signal(false);
  readonly #isSubmitting = signal(false);

  // `data` is dialog/sheet-injected (MAT_DIALOG_DATA / MAT_BOTTOM_SHEET_DATA) and
  // immutable per instance, so `previous?.value` always wins after the first build —
  // user edits are preserved across any incidental re-runs.
  protected readonly model = linkedSignal<
    CreateAllocatedTransactionFormData,
    CreateAllocatedTransactionModel
  >({
    source: this.data,
    computation: (_data, previous) =>
      untracked(
        () =>
          previous?.value ?? {
            name: '',
            money: createAmountSlice({
              initialCurrency: this.#settings.currency(),
            }),
            transactionDate: this.#dateConstraints().defaultDate,
            isChecked: false,
          },
      ),
  });

  protected readonly transactionForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 100);
    applyAmountValidators(path.money);
    required(path.transactionDate);
    validate(path.transactionDate, ({ value }) => {
      const date = value();
      if (!date || !(date instanceof Date) || isNaN(date.getTime()))
        return null;
      const time = date.getTime();
      if (time < this.minDate().getTime() || time > this.maxDate().getTime())
        return customError({ kind: 'dateOutOfRange' });
      return null;
    });
  });

  readonly canSubmit = computed(
    () => this.transactionForm().valid() && !this.#isSubmitting(),
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

  async submit(): Promise<void> {
    await runFormSubmit({
      form: this.transactionForm,
      isSubmitting: this.#isSubmitting,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        const { budgetLine } = this.data();
        return {
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata) =>
            transactionCreateFromFormSchema.parse({
              budgetId: budgetLine.budgetId,
              budgetLineId: budgetLine.id,
              name: m.name.trim(),
              amount,
              kind: budgetLine.kind,
              transactionDate: formatLocalDate(m.transactionDate),
              category: null,
              isChecked: m.isChecked,
              conversion: metadata ?? null,
            }),
        };
      },
      onSuccess: (value, outcome) => {
        this.#staleRateNotifier.notify(outcome);
        this.created.emit(value);
      },
    });
  }
}
