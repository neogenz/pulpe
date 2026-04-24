import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
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
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  type BudgetLine,
  type BudgetLineUpdate,
  type TransactionKind,
  type TransactionRecurrence,
} from 'pulpe-shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencySuffix } from '@ui/currency-suffix';
import { TransactionIconPipe } from '@ui/transaction-display';
import { TransactionLabelPipe } from '@ui/transaction-display';
import type { CurrencyConverterService } from '@core/currency';
import {
  injectCurrencyFormConfigForEdit,
  injectLiveConversionPreview,
} from '@core/currency';
import { toSignal } from '@angular/core/rxjs-interop';
import { ConversionPreviewLine } from '@ui/conversion-preview-line';
import { budgetLineUpdateFromFormSchema } from './edit-budget-line-dialog.schema';

export interface EditBudgetLineDialogData {
  budgetLine: BudgetLine;
}

@Component({
  selector: 'pulpe-edit-budget-line-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
    TranslocoPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    CurrencySuffix,
    ConversionPreviewLine,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budget.editForecast' | transloco }}
    </h2>

    <mat-dialog-content>
      <div class="pt-4">
        <form [formGroup]="form" class="flex flex-col gap-4">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastNameLabel' | transloco }}</mat-label>
            <input
              matInput
              formControlName="name"
              [placeholder]="'budget.forecastNamePlaceholder' | transloco"
              data-testid="edit-line-name"
            />
            @if (
              form.get('name')?.hasError('required') &&
              form.get('name')?.touched
            ) {
              <mat-error>{{
                'budget.forecastNameRequired' | transloco
              }}</mat-error>
            }
            @if (
              form.get('name')?.hasError('minlength') &&
              form.get('name')?.touched
            ) {
              <mat-error>{{
                'budget.forecastNameMinLength' | transloco
              }}</mat-error>
            }
          </mat-form-field>

          <div class="flex flex-col">
            <mat-form-field
              appearance="outline"
              subscriptSizing="dynamic"
              class="w-full ph-no-capture"
            >
              <mat-label class="ph-no-capture">{{
                'transactionForm.amountLabel' | transloco
              }}</mat-label>
              <input
                matInput
                type="number"
                formControlName="amount"
                placeholder="0"
                step="1"
                min="0"
                inputmode="decimal"
                data-testid="edit-line-amount"
              />
              <pulpe-currency-suffix
                matTextSuffix
                [showSelector]="showCurrencySelector()"
                [disabled]="true"
                [currency]="inputCurrency()"
              />
              @if (
                form.get('amount')?.hasError('required') &&
                form.get('amount')?.touched
              ) {
                <mat-error>{{
                  'budget.forecastAmountRequired' | transloco
                }}</mat-error>
              }
              @if (
                form.get('amount')?.hasError('min') &&
                form.get('amount')?.touched
              ) {
                <mat-error>{{ 'budget.amountMinError' | transloco }}</mat-error>
              }
            </mat-form-field>

            <pulpe-conversion-preview-line
              [amount]="preview().convertedAmount ?? null"
              [inputCurrency]="inputCurrency()"
              [displayCurrency]="currency()"
              [rate]="preview().rate ?? null"
              [cachedDate]="preview().cachedDate ?? null"
              [status]="preview().status"
            />
          </div>

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select formControlName="kind" data-testid="edit-line-kind">
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
            @if (
              form.get('kind')?.hasError('required') &&
              form.get('kind')?.touched
            ) {
              <mat-error>{{
                'budget.forecastTypeRequired' | transloco
              }}</mat-error>
            }
          </mat-form-field>
        </form>
      </div>
    </mat-dialog-content>

    @if (conversionError()) {
      <p class="text-error text-body-small px-6 pb-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
    <mat-dialog-actions align="end">
      <button matButton (click)="handleCancel()" data-testid="cancel-edit-line">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="handleSubmit()"
        [disabled]="!form.valid"
        data-testid="save-edit-line"
      >
        <mat-icon>save</mat-icon>
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditBudgetLineDialog {
  readonly #dialogRef = inject(MatDialogRef<EditBudgetLineDialog>);
  readonly #data = inject<EditBudgetLineDialogData>(MAT_DIALOG_DATA);
  readonly #fb = inject(FormBuilder);
  readonly #lineSource = signal(this.#data.budgetLine);
  readonly #currencyConfig = injectCurrencyFormConfigForEdit(this.#lineSource);
  protected readonly currency = this.#currencyConfig.currency;
  protected readonly showCurrencySelector =
    this.#currencyConfig.showCurrencySelector;
  protected readonly inputCurrency = this.#currencyConfig.inputCurrency;
  protected readonly conversionError = this.#currencyConfig.conversionError;

  readonly form = this.#fb.group({
    name: [
      this.#data.budgetLine.name,
      [Validators.required, Validators.minLength(1)],
    ],
    amount: [
      this.#computeInitialAmount(),
      [Validators.required, Validators.min(0.01)],
    ],
    kind: [this.#data.budgetLine.kind as TransactionKind, Validators.required],
    recurrence: [
      this.#data.budgetLine.recurrence as TransactionRecurrence,
      Validators.required,
    ],
  });

  readonly #amountValue = toSignal(this.form.controls.amount.valueChanges, {
    initialValue: this.form.controls.amount.value,
  });
  protected readonly preview = injectLiveConversionPreview(
    this.#amountValue,
    this.inputCurrency,
    this.currency,
  );

  #computeInitialAmount(): number {
    const line = this.#data.budgetLine;
    if (
      this.#currencyConfig.showCurrencySelector() &&
      line.originalAmount != null
    ) {
      return line.originalAmount;
    }
    return line.amount;
  }

  async handleSubmit(): Promise<void> {
    if (!this.form.valid) return;
    const value = this.form.value;
    this.conversionError.set(false);

    let finalAmount: number;
    let metadata: Awaited<
      ReturnType<CurrencyConverterService['convertWithMetadata']>
    >['metadata'] = null;

    if (this.showCurrencySelector()) {
      try {
        const result = await this.#currencyConfig.converter.convertWithMetadata(
          value.amount!,
          this.inputCurrency(),
          this.currency(),
        );
        finalAmount = result.convertedAmount;
        metadata = result.metadata;
      } catch {
        this.conversionError.set(true);
        return;
      }
    } else {
      finalAmount = value.amount!;
    }

    const formPart = budgetLineUpdateFromFormSchema.parse({
      name: value.name!,
      amount: finalAmount,
      kind: value.kind!,
      recurrence: value.recurrence!,
      conversion: metadata,
    });
    const update: BudgetLineUpdate = {
      id: this.#data.budgetLine.id,
      templateLineId: this.#data.budgetLine.templateLineId,
      savingsGoalId: this.#data.budgetLine.savingsGoalId,
      ...formPart,
    };
    this.#dialogRef.close(update);
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
