import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
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
  type SupportedCurrency,
} from 'pulpe-shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { TransactionIconPipe } from '@ui/transaction-display';
import { TransactionLabelPipe } from '@pattern/transaction-display';
import { UserSettingsApi } from '@core/user-settings/user-settings-api';
import { CurrencyConverterService } from '@core/currency';

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
          </mat-form-field>

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
  readonly #converter = inject(CurrencyConverterService);
  readonly #userSettings = inject(UserSettingsApi);
  protected readonly currency = this.#userSettings.currency;
  protected readonly showCurrencySelector =
    this.#userSettings.showCurrencySelector;
  protected readonly inputCurrency = signal<SupportedCurrency>(this.currency());

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

  protected async submit(): Promise<void> {
    if (!this.form.valid) return;

    const value = this.form.getRawValue();
    const { convertedAmount, metadata } =
      await this.#converter.convertWithMetadata(
        value.amount!,
        this.inputCurrency(),
        this.currency(),
      );

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
