import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
  untracked,
  type OnInit,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { type Transaction, type TransactionCreate } from 'pulpe-shared';
import { startOfMonth, endOfMonth } from 'date-fns';
import type { CurrencyConverterService } from '@core/currency';
import { CURRENCY_CONFIG, injectCurrencyFormConfig } from '@core/currency';
import { TransactionValidators } from '@core/transaction';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { CurrencySuffix } from '@ui/currency-suffix';
import { Logger } from '@core/logging/logger';
import { formatLocalDate } from '@core/date/format-local-date';

export type HideableField = 'kind' | 'category';

export type EditTransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category'
> & {
  transactionDate: string;
  originalAmount?: number;
  originalCurrency?: string;
  targetCurrency?: string;
  exchangeRate?: number;
};

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
    ReactiveFormsModule,
    TransactionLabelPipe,
    TranslocoPipe,
    CurrencySuffix,
  ],

  template: `
    <form
      [formGroup]="transactionForm"
      (ngSubmit)="onSubmit()"
      class="flex flex-col gap-6 min-w-0 px-1"
      novalidate
      [attr.aria-label]="formAriaLabel"
    >
      <!-- Transaction Name Field -->
      <mat-form-field subscriptSizing="dynamic" class="w-full">
        <mat-label>{{ 'transactionForm.nameLabel' | transloco }}</mat-label>
        <input
          matInput
          formControlName="name"
          [placeholder]="'transactionForm.namePlaceholder' | transloco"
          aria-describedby="name-hint"
          maxlength="100"
        />
        <mat-hint id="name-hint" align="end"
          >{{ transactionForm.get('name')?.value?.length || 0 }}/100</mat-hint
        >
        @if (
          transactionForm.get('name')?.hasError('required') &&
          transactionForm.get('name')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{ 'transactionForm.nameRequired' | transloco }}
          </mat-error>
        }
        @if (
          transactionForm.get('name')?.hasError('minlength') &&
          transactionForm.get('name')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{ 'transactionForm.nameMinLength' | transloco }}
          </mat-error>
        }
        @if (
          transactionForm.get('name')?.hasError('maxlength') &&
          transactionForm.get('name')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{ 'transactionForm.nameMaxLength' | transloco }}
          </mat-error>
        }
      </mat-form-field>

      <!-- Amount Field -->
      <mat-form-field class="w-full ph-no-capture" subscriptSizing="dynamic">
        <mat-label class="ph-no-capture">{{
          'transactionForm.amountLabel' | transloco
        }}</mat-label>
        <mat-icon matIconPrefix class="text-on-surface-variant"
          >payments</mat-icon
        >
        <input
          matInput
          type="number"
          inputmode="decimal"
          formControlName="amount"
          placeholder="0.00"
          step="0.01"
          min="0.01"
          max="999999.99"
          aria-describedby="amount-hint"
        />
        <pulpe-currency-suffix
          matTextSuffix
          [showSelector]="showCurrencySelector()"
          [currency]="inputCurrency()"
          (currencyChange)="inputCurrency.set($event)"
        />
        <mat-hint id="amount-hint" class="ph-no-capture">
          {{ 'transactionForm.amountHint' | transloco }}
        </mat-hint>
        @if (
          transactionForm.get('amount')?.hasError('required') &&
          transactionForm.get('amount')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{ 'transactionForm.amountRequired' | transloco }}
          </mat-error>
        }
        @if (
          transactionForm.get('amount')?.hasError('min') &&
          transactionForm.get('amount')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{ 'transactionForm.amountMin' | transloco }}
          </mat-error>
        }
        @if (
          transactionForm.get('amount')?.hasError('max') &&
          transactionForm.get('amount')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{ 'transactionForm.amountMax' | transloco }}
          </mat-error>
        }
      </mat-form-field>

      <!-- Type Field -->
      @if (!isFieldHidden('kind')) {
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{ 'transactionForm.typeLabel' | transloco }}</mat-label>
          <mat-select
            formControlName="kind"
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
          formControlName="transactionDate"
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
        @if (
          transactionForm.get('transactionDate')?.hasError('required') &&
          transactionForm.get('transactionDate')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{ 'transactionForm.dateRequired' | transloco }}
          </mat-error>
        }
        @if (
          transactionForm.get('transactionDate')?.hasError('dateOutOfRange') &&
          transactionForm.get('transactionDate')?.touched
        ) {
          <mat-error role="alert" aria-live="assertive">
            {{
              'transactionForm.dateOutOfRange'
                | transloco
                  : {
                      min: transactionForm.get('transactionDate')?.errors?.[
                        'dateOutOfRange'
                      ]?.min,
                      max: transactionForm.get('transactionDate')?.errors?.[
                        'dateOutOfRange'
                      ]?.max,
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
            formControlName="category"
            [placeholder]="'transactionForm.notesPlaceholder' | transloco"
            maxlength="50"
            aria-describedby="category-hint"
          />
          <mat-hint id="category-hint" align="end">
            {{ transactionForm.get('category')?.value?.length || 0 }}/50
            {{ 'transactionForm.notesOptional' | transloco }}
          </mat-hint>
          @if (
            transactionForm.get('category')?.hasError('maxlength') &&
            transactionForm.get('category')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive">
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
export class EditTransactionForm implements OnInit {
  readonly #fb = inject(FormBuilder);
  readonly #locale = inject(LOCALE_ID);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);
  readonly #currencyConfig = injectCurrencyFormConfig();

  protected readonly formAriaLabel = this.#transloco.translate(
    'transactionForm.formAriaLabel',
  );

  protected readonly currency = this.#currencyConfig.currency;
  protected readonly showCurrencySelector =
    this.#currencyConfig.showCurrencySelector;
  protected readonly inputCurrency = this.#currencyConfig.inputCurrency;
  protected readonly conversionError = this.#currencyConfig.conversionError;
  protected readonly currencySymbol = computed(
    () => CURRENCY_CONFIG[this.currency()].symbol,
  );

  readonly transaction = input.required<Transaction>();
  readonly hiddenFields = input<HideableField[]>([]);
  readonly minDateInput = input<Date>();
  readonly maxDateInput = input<Date>();
  readonly updateTransaction = output<EditTransactionFormData>();
  readonly cancelEdit = output<void>();
  readonly #isUpdating = signal(false);
  readonly isUpdating = this.#isUpdating.asReadonly();

  // Date constraints — derived from inputs, falling back to current month
  protected readonly minDate = computed(
    () => this.minDateInput() ?? startOfMonth(new Date()),
  );
  protected readonly maxDate = computed(
    () => this.maxDateInput() ?? endOfMonth(new Date()),
  );

  // Custom validator for date range
  readonly #dateRangeValidator = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    if (!control.value) return null;

    const date = new Date(control.value);
    const min = this.minDate();
    const max = this.maxDate();

    if (date < min || date > max) {
      return {
        dateOutOfRange: {
          min: min.toLocaleDateString(this.#locale),
          max: max.toLocaleDateString(this.#locale),
        },
      };
    }

    return null;
  };

  readonly transactionForm = this.#fb.group({
    name: ['', TransactionValidators.name],
    amount: [null as number | null, TransactionValidators.amount],
    kind: [
      'expense' as 'expense' | 'income' | 'saving',
      TransactionValidators.kind,
    ],
    transactionDate: [
      null as Date | null,
      [Validators.required, this.#dateRangeValidator],
    ],
    category: ['', TransactionValidators.category],
  });

  constructor() {
    // Re-validate the date control when the budget period boundaries change,
    // since Angular validators don't re-run on external signal changes.
    effect(() => {
      this.minDate();
      this.maxDate();
      untracked(() =>
        this.transactionForm
          .get('transactionDate')
          ?.updateValueAndValidity({ emitEvent: false }),
      );
    });
  }

  protected isFieldHidden(field: HideableField): boolean {
    return this.hiddenFields().includes(field);
  }

  ngOnInit(): void {
    this.#initializeForm();
    this.transactionForm
      .get('transactionDate')
      ?.updateValueAndValidity({ emitEvent: false });
  }

  #initializeForm(): void {
    try {
      const transaction = this.transaction();

      // Use Date object directly for Material DatePicker
      const transactionDate = new Date(transaction.transactionDate);

      this.transactionForm.patchValue({
        name: transaction.name,
        amount: transaction.amount,
        kind: transaction.kind,
        transactionDate,
        category: transaction.category || '',
      });
    } catch (error) {
      this.#logger.warn(
        "Impossible d'initialiser le formulaire de transaction",
        { error },
      );
      this.cancelEdit.emit();
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.transactionForm.valid || this.isUpdating()) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const {
      name,
      amount: rawAmount,
      kind,
      transactionDate,
      category,
    } = this.transactionForm.getRawValue() as {
      name: string;
      amount: number | null;
      kind: 'expense' | 'income' | 'saving';
      transactionDate: Date | null;
      category: string | null;
    };

    // Form is valid so all required fields are guaranteed non-null
    if (!name || !rawAmount || !kind || !transactionDate) return;

    this.conversionError.set(false);
    let convertedAmount: number;
    let metadata: Awaited<
      ReturnType<CurrencyConverterService['convertWithMetadata']>
    >['metadata'];
    try {
      ({ convertedAmount, metadata } =
        await this.#currencyConfig.converter.convertWithMetadata(
          rawAmount,
          this.inputCurrency(),
          this.currency(),
        ));
    } catch {
      this.conversionError.set(true);
      return;
    }

    this.#isUpdating.set(true);

    const formData: EditTransactionFormData = {
      name,
      amount: convertedAmount,
      kind,
      transactionDate: formatLocalDate(transactionDate),
      category: category || null,
      ...metadata,
    };

    this.updateTransaction.emit(formData);
  }
}
