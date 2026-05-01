import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import {
  Field,
  customError,
  form,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { type TransactionCreate } from 'pulpe-shared';
import { transactionCreateFromFormSchema } from '../../components/edit-transaction-form';
import { formatLocalDate } from '@core/date/format-local-date';
import {
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
  submitWithConversion,
} from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { touchedFieldErrors } from '@core/validators';
import { Logger } from '@core/logging/logger';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { BlurOnVisibilityResumeDirective } from '@ui/blur-on-visibility-resume/blur-on-visibility-resume.directive';
import type { CreateAllocatedTransactionDialogData } from './dialog';
import { computeBudgetPeriodDateConstraints } from './budget-period-date-constraints';

interface CreateAllocatedTransactionModel {
  name: string;
  money: AmountFormSlice;
  transactionDate: Date;
  isChecked: boolean;
}

@Component({
  selector: 'pulpe-create-allocated-transaction-bottom-sheet',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    TranslocoPipe,
    Field,
    AmountInput,
    BlurOnVisibilityResumeDirective,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6" pulpeBlurOnVisibilityResume>
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
      <form (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'budget.tableDescription' | transloco }}</mat-label>
          <input
            matInput
            [field]="transactionForm.name"
            [placeholder]="'transactionForm.namePlaceholder' | transloco"
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

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'budget.dateLabel' | transloco }}</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            [min]="minDate"
            [max]="maxDate"
            [field]="transactionForm.transactionDate"
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
          [disabled]="!canSubmit()"
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
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<CreateAllocatedTransactionBottomSheet, TransactionCreate>,
  );
  readonly data = inject<CreateAllocatedTransactionDialogData>(
    MAT_BOTTOM_SHEET_DATA,
  );

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
      const date = value();
      if (!date || !(date instanceof Date) || isNaN(date.getTime()))
        return null;
      const time = date.getTime();
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

  close(): void {
    this.#bottomSheetRef.dismiss();
  }

  async submit(): Promise<void> {
    await submit(this.transactionForm, async () => {
      this.conversionError.set(false);
      this.isSubmitting.set(true);
      try {
        const m = this.model();
        const outcome = await submitWithConversion({
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata) =>
            transactionCreateFromFormSchema.parse({
              budgetId: this.data.budgetLine.budgetId,
              budgetLineId: this.data.budgetLine.id,
              name: m.name.trim(),
              amount,
              kind: this.data.budgetLine.kind,
              transactionDate: formatLocalDate(m.transactionDate),
              category: null,
              isChecked: m.isChecked,
              conversion: metadata ?? null,
            }),
        });
        if (outcome.status === 'failed') {
          this.conversionError.set(true);
          return;
        }
        if (outcome.status === 'invalid') return;
        this.#bottomSheetRef.dismiss(outcome.value);
      } finally {
        this.isSubmitting.set(false);
      }
    });
  }
}
