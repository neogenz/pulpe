import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  type BudgetLineCreate,
  type TransactionKind,
  type TransactionRecurrence,
} from 'pulpe-shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencySuffix } from '@ui/currency-suffix';
import { TransactionIconPipe } from '@ui/transaction-display';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { UserSettingsStore } from '@core/user-settings';
import type { CurrencyConverterService } from '@core/currency';
import {
  injectCurrencyFormConfig,
  injectLiveConversionPreview,
} from '@core/currency';
import { toSignal } from '@angular/core/rxjs-interop';
import { ConversionPreviewLine } from '@ui/conversion-preview-line';

export interface BudgetLineDialogData {
  budgetId: string;
}

@Component({
  selector: 'pulpe-budget-line-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
    TranslocoPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    CurrencySuffix,
    ConversionPreviewLine,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budget.newForecast' | transloco }}
    </h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-4">
        <form [formGroup]="form">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{ 'budget.forecastNameLabel' | transloco }}</mat-label>
            <input
              matInput
              formControlName="name"
              [placeholder]="'budget.forecastNamePlaceholder' | transloco"
              data-testid="new-line-name"
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full ph-no-capture">
            <mat-label class="ph-no-capture">{{
              'transactionForm.amountLabel' | transloco
            }}</mat-label>
            <input
              matInput
              type="number"
              formControlName="amount"
              placeholder="0.00"
              step="0.01"
              min="0"
              inputmode="decimal"
              data-testid="new-line-amount"
            />
            <pulpe-currency-suffix
              matTextSuffix
              [showSelector]="showCurrencySelector()"
              [currency]="inputCurrency()"
              (currencyChange)="inputCurrency.set($event)"
            />
          </mat-form-field>

          <pulpe-conversion-preview-line
            [amount]="preview().convertedAmount ?? null"
            [inputCurrency]="inputCurrency()"
            [displayCurrency]="currency()"
            [rate]="preview().rate ?? null"
            [cachedDate]="preview().cachedDate ?? null"
            [status]="preview().status"
          />

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select formControlName="kind" data-testid="new-line-kind">
              <mat-option value="income">
                <mat-icon class="text-financial-income">{{
                  'income' | transactionIcon
                }}</mat-icon>
                <span>{{ 'income' | transactionLabel }}</span>
              </mat-option>
              <mat-option value="expense">
                <mat-icon class="text-financial-negative">{{
                  'expense' | transactionIcon
                }}</mat-icon>
                <span>{{ 'expense' | transactionLabel }}</span>
              </mat-option>
              <mat-option value="saving">
                <mat-icon class="text-primary">{{
                  'saving' | transactionIcon
                }}</mat-icon>
                <span>{{ 'saving' | transactionLabel }}</span>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <div class="flex items-center justify-between py-2 px-1">
            <span class="text-body-medium text-on-surface">{{
              'budget.forecastCheckedToggle' | transloco
            }}</span>
            <mat-slide-toggle
              formControlName="isChecked"
              [attr.aria-label]="'budget.forecastCheckedToggle' | transloco"
            />
          </div>
        </form>
      </div>
    </mat-dialog-content>

    @if (conversionError()) {
      <p class="text-error text-body-small px-6 pb-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" data-testid="cancel-new-line">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="submit()"
        [disabled]="!form.valid"
        data-testid="add-new-line"
      >
        <mat-icon>add</mat-icon>
        {{ 'common.add' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddBudgetLineDialog {
  readonly #dialogRef = inject(MatDialogRef<AddBudgetLineDialog>);
  readonly #data = inject<BudgetLineDialogData>(MAT_DIALOG_DATA);
  readonly #fb = inject(FormBuilder);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #currencyConfig = injectCurrencyFormConfig();
  protected readonly currency = this.#userSettings.currency;
  protected readonly showCurrencySelector =
    this.#currencyConfig.showCurrencySelector;
  protected readonly inputCurrency = this.#currencyConfig.inputCurrency;
  protected readonly conversionError = this.#currencyConfig.conversionError;

  protected readonly form = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    kind: ['expense' as TransactionKind, Validators.required],
    recurrence: ['one_off' as TransactionRecurrence],
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

  protected async submit(): Promise<void> {
    if (!this.form.valid) return;

    const value = this.form.getRawValue();

    let convertedAmount: number;
    let metadata: Awaited<
      ReturnType<CurrencyConverterService['convertWithMetadata']>
    >['metadata'];
    this.conversionError.set(false);
    try {
      ({ convertedAmount, metadata } =
        await this.#currencyConfig.converter.convertWithMetadata(
          value.amount!,
          this.inputCurrency(),
          this.currency(),
        ));
    } catch {
      this.conversionError.set(true);
      return;
    }

    const budgetLine: BudgetLineCreate = {
      budgetId: this.#data.budgetId,
      name: value.name!.trim(),
      amount: convertedAmount,
      kind: value.kind!,
      recurrence: value.recurrence!,
      isManuallyAdjusted: true,
      checkedAt: value.isChecked ? new Date().toISOString() : null,
      ...metadata,
    };
    this.#dialogRef.close(budgetLine);
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }
}
