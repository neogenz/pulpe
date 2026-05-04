import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  Field,
  form,
  maxLength,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { SupportedCurrency, TransactionCreate } from 'pulpe-shared';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { UserSettingsStore } from '@core/user-settings';
import {
  AppCurrencyPipe,
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
  submitWithConversion,
} from '@core/currency';
import { Logger } from '@core/logging/logger';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { BlurOnVisibilityResumeDirective } from '@ui/blur-on-visibility-resume/blur-on-visibility-resume.directive';

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
  selector: 'pulpe-add-transaction-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatSlideToggleModule,
    TranslocoPipe,
    TransactionLabelPipe,
    AppCurrencyPipe,
    Field,
    AmountInput,
    BlurOnVisibilityResumeDirective,
  ],
  template: `
    <div class="flex flex-col gap-4" pulpeBlurOnVisibilityResume>
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-title-large text-on-surface m-0">
            {{ 'currentMonth.addTransactionTitle' | transloco }}
          </h2>
          <p class="text-body-small text-on-surface-variant mt-0.5 mb-0">
            {{ 'currentMonth.addTransactionSubtitle' | transloco }}
          </p>
        </div>
        <button
          matIconButton
          (click)="close()"
          [attr.aria-label]="'currentMonth.addTransactionClose' | transloco"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form -->
      <form
        (ngSubmit)="onSubmit()"
        class="flex flex-col gap-4"
        novalidate
        data-testid="transaction-form"
      >
        <!-- Amount Field -->
        <pulpe-amount-input [control]="transactionForm.money" />

        <!-- Predefined Amounts -->
        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium text-on-surface-variant">
            {{ 'currentMonth.addTransactionQuickAmounts' | transloco }}
          </div>
          <div class="flex flex-wrap gap-2">
            @for (amount of predefinedAmounts; track amount) {
              <button
                matButton="tonal"
                type="button"
                (click)="selectPredefinedAmount(amount)"
                class="min-w-20 h-10"
              >
                {{ amount | appCurrency: currency() : '1.0-0' }}
              </button>
            }
          </div>
        </div>

        <!-- Name Field -->
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionDescription' | transloco
          }}</mat-label>
          <input
            matInput
            [field]="transactionForm.name"
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

        <!-- Type Field -->
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionType' | transloco
          }}</mat-label>
          <mat-select
            [field]="transactionForm.kind"
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

        <!-- Category/Notes Field -->
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionNotes' | transloco
          }}</mat-label>
          <input
            matInput
            [field]="transactionForm.category"
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

        <!-- Date display (today by default) -->
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
            [field]="transactionForm.isChecked"
            [attr.aria-label]="'transactionForm.checkedToggle' | transloco"
          />
        </div>
      </form>

      @if (conversionError()) {
        <p role="alert" class="text-error text-body-small pb-2">
          {{ 'common.conversionError' | transloco }}
        </p>
      }

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-4 pb-6 px-6 border-t border-outline-variant">
        <button
          matButton
          (click)="close()"
          class="flex-1"
          data-testid="transaction-cancel-button"
        >
          {{ 'currentMonth.addTransactionCancel' | transloco }}
        </button>
        <button
          matButton="outlined"
          (click)="onSubmit()"
          [disabled]="!canSubmit()"
          data-testid="transaction-submit-button"
          class="flex-2"
        >
          {{ 'currentMonth.addTransactionSubmit' | transloco }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionBottomSheet {
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<AddTransactionBottomSheet>,
  );
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);

  protected readonly amountInput = viewChild(AmountInput);

  constructor() {
    this.#bottomSheetRef.afterOpened().subscribe(() => {
      this.amountInput()?.focus();
    });
  }

  protected readonly currency = this.#userSettings.currency;
  protected readonly predefinedAmounts = [10, 15, 20, 30] as const;
  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);

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

  protected readonly canSubmit = computed(
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

  protected async onSubmit(): Promise<void> {
    await submit(this.transactionForm, async () => {
      this.conversionError.set(false);
      this.isSubmitting.set(true);
      try {
        const m = this.model();
        const outcome = await submitWithConversion({
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
        });
        if (
          outcome.status === 'failed-conversion' ||
          outcome.status === 'failed-build'
        ) {
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

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }
}
