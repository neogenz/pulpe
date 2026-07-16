import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  minLength,
  required,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { SupportedCurrency, TransactionCreate } from 'pulpe-shared';

import { AmountInput } from '@app/pattern/amount-input/amount-input';
import {
  AppCurrencyPipe,
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
  runFormSubmit,
  StaleRateNotifier,
} from '@core/currency';
import { Logger } from '@core/logging/logger';
import { UserSettingsStore } from '@core/user-settings';
import { TransactionLabelPipe } from '@ui/transaction-display';

export type TransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category' | 'checkedAt'
> & {
  originalAmount?: number;
  originalCurrency?: SupportedCurrency;
  targetCurrency?: SupportedCurrency;
  exchangeRate?: number;
};

interface AddTransactionModel {
  name: string;
  money: AmountFormSlice;
  kind: 'expense' | 'income' | 'saving';
  category: string;
  isChecked: boolean;
}

@Component({
  selector: 'pulpe-add-transaction-form',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslocoPipe,
    TransactionLabelPipe,
    AppCurrencyPipe,
    FormField,
    AmountInput,
  ],
  template: `
    <form
      (ngSubmit)="submit()"
      class="add-transaction-form-grid grid grid-cols-1 gap-4"
      novalidate
      data-testid="transaction-form"
    >
      <div class="flex flex-col gap-4">
        <pulpe-amount-input
          [control]="transactionForm.money"
          class="block tabular-nums"
        />

        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium text-on-surface-variant">
            {{ 'currentMonth.addTransactionQuickAmounts' | transloco }}
          </div>
          <div class="grid grid-cols-4 gap-2">
            @for (amount of predefinedAmounts; track amount) {
              <button
                matButton="tonal"
                type="button"
                (click)="selectPredefinedAmount(amount)"
                class="min-h-11 min-w-0 px-2 tabular-nums transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none"
              >
                {{ amount | appCurrency: currency() : '1.0-0' }}
              </button>
            }
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionDescription' | transloco
          }}</mat-label>
          <input
            matInput
            [formField]="transactionForm.name"
            data-testid="transaction-description-input"
            placeholder="Ex: Courses chez Migros"
          />
          @if (nameRequiredError()) {
            <mat-error>{{
              'currentMonth.addTransactionDescriptionRequired' | transloco
            }}</mat-error>
          }
          @if (nameMinLengthError()) {
            <mat-error>{{
              'currentMonth.addTransactionDescriptionMin' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionType' | transloco
          }}</mat-label>
          <mat-select
            [formField]="transactionForm.kind"
            [attr.aria-label]="'currentMonth.addTransactionType' | transloco"
            data-testid="transaction-type-select"
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

        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionNotes' | transloco
          }}</mat-label>
          <input
            matInput
            [formField]="transactionForm.category"
            [placeholder]="
              'currentMonth.addTransactionNotesPlaceholder' | transloco
            "
            aria-describedby="category-hint"
          />
          <mat-hint id="category-hint" align="end"
            >{{ model().category.length }}/50
            {{
              'currentMonth.addTransactionNotesOptional' | transloco
            }}</mat-hint
          >
          @if (categoryMaxLengthError()) {
            <mat-error>{{
              'currentMonth.addTransactionNotesMaxLength' | transloco
            }}</mat-error>
          }
        </mat-form-field>
      </div>

      <div class="add-transaction-form-meta grid grid-cols-1 gap-3">
        <div
          class="flex items-center gap-2 p-3 bg-surface-container rounded-lg text-on-surface-variant"
        >
          <mat-icon>event</mat-icon>
          <span>{{ 'currentMonth.addTransactionToday' | transloco }}</span>
        </div>

        <div class="flex items-center justify-between py-2 px-1">
          <span class="text-body-medium text-on-surface">{{
            'transactionForm.checkedToggle' | transloco
          }}</span>
          <mat-slide-toggle
            [formField]="transactionForm.isChecked"
            [attr.aria-label]="'transactionForm.checkedToggle' | transloco"
          />
        </div>
      </div>
    </form>

    @if (conversionError()) {
      <p role="alert" class="text-error text-body-small pt-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
  `,
  styles: `
    @media (width >= 48rem) {
      :host(.add-transaction-form-wide) .add-transaction-form-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 1.5rem;
      }

      :host(.add-transaction-form-wide) .add-transaction-form-meta {
        grid-column: span 2 / span 2;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionForm {
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #staleRateNotifier = inject(StaleRateNotifier);

  readonly created = output<TransactionFormData>();
  readonly isSubmitting = signal(false);
  private readonly amountInput = viewChild(AmountInput);

  protected readonly currency = this.#userSettings.currency;
  protected readonly predefinedAmounts = [10, 15, 20, 30] as const;
  protected readonly conversionError = signal(false);

  protected readonly model = signal<AddTransactionModel>({
    name: this.#transloco.translate('currentMonth.addTransactionDefaultName'),
    money: createAmountSlice({
      initialCurrency: this.#userSettings.currency(),
    }),
    kind: 'expense',
    category: '',
    isChecked: true,
  });

  protected readonly transactionForm = form(this.model, (path) => {
    required(path.name, {
      message: 'currentMonth.addTransactionDescriptionRequired',
    });
    minLength(path.name, 2, {
      message: 'currentMonth.addTransactionDescriptionMin',
    });
    maxLength(path.name, 100);
    applyAmountValidators(path.money);
    required(path.kind);
    maxLength(path.category, 50, {
      message: 'currentMonth.addTransactionNotesMaxLength',
    });
  });

  readonly canSubmit = computed(
    () => this.transactionForm().valid() && !this.isSubmitting(),
  );

  protected readonly nameRequiredError = computed(
    () =>
      this.transactionForm.name().touched() &&
      this.transactionForm
        .name()
        .errors()
        .some((e) => e.kind === 'required'),
  );
  protected readonly nameMinLengthError = computed(
    () =>
      this.transactionForm.name().touched() &&
      this.transactionForm
        .name()
        .errors()
        .some((e) => e.kind === 'minLength'),
  );
  protected readonly categoryMaxLengthError = computed(
    () =>
      this.transactionForm.category().touched() &&
      this.transactionForm
        .category()
        .errors()
        .some((e) => e.kind === 'maxLength'),
  );

  protected selectPredefinedAmount(amount: number): void {
    const amountField = this.transactionForm.money.amount();
    amountField.value.set(amount);
    amountField.markAsTouched();
  }

  focusAmount(): void {
    this.amountInput()?.focus();
  }

  async submit(): Promise<void> {
    await runFormSubmit({
      form: this.transactionForm,
      isSubmitting: this.isSubmitting,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        return {
          amountSlice: m.money,
          targetCurrency: this.#userSettings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata): TransactionFormData => ({
            name: m.name,
            amount,
            kind: m.kind,
            category: m.category || null,
            checkedAt: m.isChecked ? new Date().toISOString() : null,
            ...metadata,
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
