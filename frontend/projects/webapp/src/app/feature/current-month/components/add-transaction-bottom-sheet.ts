import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  type FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { TransactionCreate, SupportedCurrency } from 'pulpe-shared';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TransactionValidators } from '@core/transaction';
import { TransactionLabelPipe } from '@pattern/transaction-display';
import { UserSettingsApi } from '@core/user-settings/user-settings-api';
import { CurrencyConverterService } from '@core/currency';

export type TransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category' | 'checkedAt'
> & {
  originalAmount?: number;
  originalCurrency?: string;
  targetCurrency?: string;
  exchangeRate?: number;
};

// Define the form structure type
interface TransactionFormControls {
  name: FormControl<string | null>;
  amount: FormControl<number | null>;
  kind: FormControl<'expense' | 'income' | 'saving' | null>;
  category: FormControl<string | null>;
  isChecked: FormControl<boolean>;
}

@Component({
  selector: 'pulpe-add-transaction-bottom-sheet',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatSlideToggleModule,
    TranslocoPipe,
    TransactionLabelPipe,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-title-large text-on-surface m-0">
          {{ 'currentMonth.addTransactionTitle' | transloco }}
        </h2>
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
        [formGroup]="transactionForm"
        (ngSubmit)="onSubmit()"
        class="flex flex-col gap-4"
        novalidate
        data-testid="transaction-form"
      >
        <!-- Amount Field -->
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ph-no-capture"
        >
          <mat-label>{{
            'currentMonth.addTransactionAmount' | transloco
          }}</mat-label>
          <input
            class="!text-xl !font-bold !text-center"
            matInput
            #amountInput
            type="number"
            inputmode="decimal"
            placeholder="0.00"
            formControlName="amount"
            data-testid="transaction-amount-input"
            step="0.01"
            min="0.01"
            max="999999.99"
            required
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
            transactionForm.get('amount')?.hasError('required') &&
            transactionForm.get('amount')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive">{{
              'currentMonth.addTransactionAmountRequired' | transloco
            }}</mat-error>
          }
          @if (
            transactionForm.get('amount')?.hasError('min') &&
            transactionForm.get('amount')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive">{{
              'currentMonth.addTransactionAmountMin' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <!-- Predefined Amounts -->
        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium text-on-surface-variant">
            {{ 'currentMonth.addTransactionQuickAmounts' | transloco }}
          </div>
          <div class="flex flex-wrap gap-2">
            @for (amount of predefinedAmounts(); track amount) {
              <button
                matButton="tonal"
                type="button"
                (click)="selectPredefinedAmount(amount)"
                class="!min-w-[80px] !h-[40px]"
              >
                {{ amount }} {{ currency() }}
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
            formControlName="name"
            data-testid="transaction-description-input"
            placeholder="Ex: Courses chez Migros"
          />
          @if (
            transactionForm.get('name')?.hasError('required') &&
            transactionForm.get('name')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive">{{
              'currentMonth.addTransactionDescriptionRequired' | transloco
            }}</mat-error>
          }
          @if (
            transactionForm.get('name')?.hasError('minlength') &&
            transactionForm.get('name')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive">{{
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
            formControlName="kind"
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
            formControlName="category"
            [placeholder]="
              'currentMonth.addTransactionNotesPlaceholder' | transloco
            "
            maxlength="50"
            aria-describedby="category-hint"
          />
          <mat-hint id="category-hint" align="end"
            >{{ transactionForm.get('category')?.value?.length || 0 }}/50
            {{
              'currentMonth.addTransactionNotesOptional' | transloco
            }}</mat-hint
          >
          @if (
            transactionForm.get('category')?.hasError('maxlength') &&
            transactionForm.get('category')?.touched
          ) {
            <mat-error role="alert" aria-live="assertive">{{
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
          [disabled]="transactionForm.invalid"
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
  readonly #fb = inject(FormBuilder);
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<AddTransactionBottomSheet>,
  );
  readonly #transloco = inject(TranslocoService);
  readonly #converter = inject(CurrencyConverterService);
  readonly #userSettings = inject(UserSettingsApi);
  protected readonly currency = this.#userSettings.currency;
  protected readonly showCurrencySelector =
    this.#userSettings.showCurrencySelector;
  protected readonly inputCurrency = signal<SupportedCurrency>(this.currency());

  // View child for focus management
  protected readonly amountInput =
    viewChild<ElementRef<HTMLInputElement>>('amountInput');

  // Predefined amounts for quick selection
  protected readonly predefinedAmounts = signal([10, 15, 20, 30]);
  protected readonly conversionError = signal(false);

  // Reactive form with shared validators for consistency
  protected readonly transactionForm: FormGroup<TransactionFormControls> =
    this.#fb.group({
      name: new FormControl<string | null>(
        this.#transloco.translate('currentMonth.addTransactionDefaultName'),
        [...TransactionValidators.name],
      ),
      amount: new FormControl<number | null>(null, [
        ...TransactionValidators.amount,
      ]),
      kind: new FormControl<'expense' | 'income' | 'saving' | null>(
        'expense',
        TransactionValidators.kind,
      ),
      category: new FormControl<string | null>('', [
        ...TransactionValidators.category,
      ]),
      isChecked: new FormControl<boolean>(true, { nonNullable: true }),
    });

  constructor() {
    this.#bottomSheetRef.afterOpened().subscribe(() => {
      this.amountInput()?.nativeElement?.focus();
    });
  }

  protected selectPredefinedAmount(amount: number): void {
    this.transactionForm.patchValue({ amount });
  }

  protected async onSubmit(): Promise<void> {
    if (!this.transactionForm.valid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const formValue = this.transactionForm.value;

    // Explicit validation for required fields
    if (!formValue.name || !formValue.amount || !formValue.kind) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    let convertedAmount: number;
    let metadata: Awaited<
      ReturnType<CurrencyConverterService['convertWithMetadata']>
    >['metadata'];
    try {
      ({ convertedAmount, metadata } =
        await this.#converter.convertWithMetadata(
          formValue.amount,
          this.inputCurrency(),
          this.currency(),
        ));
    } catch {
      this.conversionError.set(true);
      return;
    }

    const transaction: TransactionFormData = {
      name: formValue.name,
      amount: convertedAmount,
      kind: formValue.kind,
      category: formValue.category || null,
      checkedAt: formValue.isChecked ? new Date().toISOString() : null,
      ...metadata,
    };

    this.#bottomSheetRef.dismiss(transaction);
  }

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }
}
