import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
  linkedSignal,
} from '@angular/core';
import {
  Field,
  form,
  required,
  minLength,
  maxLength,
  validate,
  customError,
  submit,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { type Transaction, type TransactionKind } from 'pulpe-shared';
import { type TransactionUpdateFormValue } from './edit-transaction-form.schema';
import { startOfMonth, endOfMonth } from 'date-fns';
import { FeatureFlagsService } from '@core/feature-flags';
import {
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
  submitWithConversion,
} from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { touchedFieldErrors } from '@core/validators';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { formatLocalDate } from '@core/date/format-local-date';
import { Logger } from '@core/logging/logger';

export type HideableField = 'kind' | 'category';

interface EditTransactionModel {
  name: string;
  money: AmountFormSlice;
  kind: TransactionKind;
  transactionDate: Date;
  category: string;
}

interface DateOutOfRangeError {
  kind: 'dateOutOfRange';
  min: string;
  max: string;
}

@Component({
  selector: 'pulpe-edit-transaction-form',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    TransactionLabelPipe,
    TranslocoPipe,
    Field,
    AmountInput,
  ],

  template: `
    <form
      (ngSubmit)="onSubmit()"
      class="flex flex-col gap-6 min-w-0 px-1"
      novalidate
      [attr.aria-label]="'transactionForm.formAriaLabel' | transloco"
    >
      <!-- Transaction Name Field -->
      <mat-form-field subscriptSizing="dynamic" class="w-full">
        <mat-label>{{ 'transactionForm.nameLabel' | transloco }}</mat-label>
        <input
          matInput
          [field]="transactionForm.name"
          [placeholder]="'transactionForm.namePlaceholder' | transloco"
          aria-describedby="name-hint"
        />
        <mat-hint id="name-hint" align="end"
          >{{ model().name.length || 0 }}/100</mat-hint
        >
        @if (nameErrors().required) {
          <mat-error>
            {{ 'transactionForm.nameRequired' | transloco }}
          </mat-error>
        }
        @if (nameErrors().minLength) {
          <mat-error>
            {{ 'transactionForm.nameMinLength' | transloco }}
          </mat-error>
        }
        @if (nameErrors().maxLength) {
          <mat-error>
            {{ 'transactionForm.nameMaxLength' | transloco }}
          </mat-error>
        }
      </mat-form-field>

      <!-- Amount Field -->
      <pulpe-amount-input
        [control]="transactionForm.money"
        mode="edit"
        [originalCurrency]="originalCurrency()"
      />

      <!-- Type Field -->
      @if (!isFieldHidden('kind')) {
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{ 'transactionForm.typeLabel' | transloco }}</mat-label>
          <mat-select
            [field]="transactionForm.kind"
            [attr.aria-label]="'transactionForm.typeLabel' | transloco"
          >
            <mat-option value="expense">
              <mat-icon class="mr-2 icon-filled">remove_circle</mat-icon>
              {{ 'expense' | transactionLabel }}
            </mat-option>
            <mat-option value="income">
              <mat-icon class="mr-2 icon-filled">add_circle</mat-icon>
              {{ 'income' | transactionLabel }}
            </mat-option>
            <mat-option value="saving">
              <mat-icon class="mr-2 icon-filled">savings</mat-icon>
              {{ 'saving' | transactionLabel }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      }

      <!-- Date Field -->
      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>{{ 'transactionForm.dateLabel' | transloco }}</mat-label>
        <input
          matInput
          [matDatepicker]="picker"
          [min]="minDate()"
          [max]="maxDate()"
          [field]="transactionForm.transactionDate"
          [placeholder]="'transactionForm.datePlaceholder' | transloco"
          aria-describedby="date-hint"
          readonly
        />
        <mat-datepicker-toggle
          matIconSuffix
          [for]="picker"
          [attr.aria-label]="'transactionForm.openCalendar' | transloco"
        ></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
        <mat-hint id="date-hint">{{
          minDateInput()
            ? ('transactionForm.dateHintBudget' | transloco)
            : ('transactionForm.dateHintMonth' | transloco)
        }}</mat-hint>
        @if (dateErrors().required) {
          <mat-error>
            {{ 'transactionForm.dateRequired' | transloco }}
          </mat-error>
        }
        @if (dateErrors().outOfRange; as range) {
          <mat-error>
            {{
              'transactionForm.dateOutOfRange'
                | transloco
                  : {
                      min: range.min,
                      max: range.max,
                    }
            }}
          </mat-error>
        }
      </mat-form-field>

      <!-- Category Field -->
      @if (!isFieldHidden('category')) {
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{ 'transactionForm.notesLabel' | transloco }}</mat-label>
          <input
            matInput
            [field]="transactionForm.category"
            [placeholder]="'transactionForm.notesPlaceholder' | transloco"
            aria-describedby="category-hint"
          />
          <mat-hint id="category-hint" align="end">
            {{ model().category.length || 0 }}/50
            {{ 'transactionForm.notesOptional' | transloco }}
          </mat-hint>
          @if (categoryErrors().maxLength) {
            <mat-error>
              {{ 'transactionForm.notesMaxLength' | transloco }}
            </mat-error>
          }
        </mat-form-field>
      }
    </form>
    @if (conversionError()) {
      <p class="text-error text-body-small px-1 pt-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTransactionForm {
  readonly #locale = inject(LOCALE_ID);
  readonly #flags = inject(FeatureFlagsService);
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);

  readonly transaction = input.required<Transaction>();

  readonly hiddenFields = input<HideableField[]>([]);
  readonly minDateInput = input<Date>();
  readonly maxDateInput = input<Date>();
  readonly updateTransaction = output<TransactionUpdateFormValue>();
  readonly cancelEdit = output<void>();

  readonly #isUpdating = signal(false);
  readonly isUpdating = this.#isUpdating.asReadonly();
  readonly canSubmit = computed(
    () => this.transactionForm().valid() && !this.#isUpdating(),
  );
  protected readonly conversionError = signal(false);

  protected readonly minDate = computed(
    () => this.minDateInput() ?? startOfMonth(new Date()),
  );
  protected readonly maxDate = computed(
    () => this.maxDateInput() ?? endOfMonth(new Date()),
  );

  protected readonly originalCurrency = computed(
    () => this.transaction().originalCurrency ?? null,
  );

  protected readonly showCurrencySelector = computed(
    () =>
      this.#flags.isMultiCurrencyEnabled() &&
      this.originalCurrency() !== null &&
      this.originalCurrency() !== this.#settings.currency(),
  );

  protected readonly model = linkedSignal({
    source: this.transaction,
    computation: (tx): EditTransactionModel => ({
      name: tx.name,
      money: createAmountSlice({
        initialCurrency: tx.originalCurrency ?? this.#settings.currency(),
        initialAmount:
          this.showCurrencySelector() && tx.originalAmount != null
            ? tx.originalAmount
            : tx.amount,
      }),
      kind: tx.kind,
      transactionDate: new Date(tx.transactionDate),
      category: tx.category ?? '',
    }),
  });

  protected readonly transactionForm = form(this.model, (path) => {
    required(path.name);
    minLength(path.name, 2);
    maxLength(path.name, 100);
    applyAmountValidators(path.money);
    required(path.kind);
    required(path.transactionDate);
    maxLength(path.category, 50);
    validate(path.transactionDate, ({ value }) => {
      const date = value();
      if (!date || !(date instanceof Date) || isNaN(date.getTime()))
        return null;
      const min = this.minDate();
      const max = this.maxDate();
      if (date < min || date > max) {
        return customError({
          kind: 'dateOutOfRange',
          min: min.toLocaleDateString(this.#locale),
          max: max.toLocaleDateString(this.#locale),
        });
      }
      return null;
    });
  });

  protected readonly nameErrors = touchedFieldErrors(
    () => this.transactionForm.name,
    'required',
    'minLength',
    'maxLength',
  );

  protected readonly dateErrors = computed(() => {
    const state = this.transactionForm.transactionDate();
    if (!state.touched())
      return {
        required: false,
        outOfRange: null as DateOutOfRangeError | null,
      };
    const errors = state.errors();
    const rangeErr = errors.find((e) => e.kind === 'dateOutOfRange') as
      | DateOutOfRangeError
      | undefined;
    return {
      required: errors.some((e) => e.kind === 'required'),
      outOfRange: rangeErr ?? null,
    };
  });

  protected readonly categoryErrors = touchedFieldErrors(
    () => this.transactionForm.category,
    'maxLength',
  );

  protected isFieldHidden(field: HideableField): boolean {
    return this.hiddenFields().includes(field);
  }

  async onSubmit(): Promise<void> {
    if (this.isUpdating()) return;
    await submit(this.transactionForm, async () => {
      this.conversionError.set(false);
      this.#isUpdating.set(true);
      try {
        const m = this.model();
        const { transactionDate, category } = m;
        const outcome = await submitWithConversion({
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata): TransactionUpdateFormValue => ({
            name: m.name,
            amount,
            kind: m.kind,
            transactionDate: formatLocalDate(transactionDate),
            category: category || null,
            conversion: metadata,
          }),
        });
        if (outcome.status === 'failed') {
          this.conversionError.set(true);
          return;
        }
        if (outcome.status === 'invalid') return;
        this.updateTransaction.emit(outcome.value);
      } finally {
        this.#isUpdating.set(false);
      }
    });
  }
}
