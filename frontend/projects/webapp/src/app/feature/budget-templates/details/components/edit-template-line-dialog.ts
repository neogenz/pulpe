import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
  type TemplateLine,
  type TransactionKind,
  type SupportedCurrency,
} from 'pulpe-shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { CurrencySuffix } from '@ui/currency-suffix';
import { FinancialKindDirective } from '@ui/financial-kind';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import type { CurrencyConverterService } from '@core/currency';
import { injectCurrencyFormConfigForEdit } from '@core/currency';

const TRANSACTION_KINDS: readonly TransactionKind[] = [
  'income',
  'expense',
  'saving',
] as const;

export interface EditTemplateLineDialogData {
  line?: TemplateLine;
  templateName: string;
}

export interface EditTemplateLineDialogResult {
  name: string;
  amount: number;
  kind: TransactionKind;
  originalAmount?: number;
  originalCurrency?: SupportedCurrency;
  targetCurrency?: SupportedCurrency;
  exchangeRate?: number;
}

@Component({
  selector: 'pulpe-edit-template-line-dialog',
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
    FinancialKindDirective,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      @if (isEditMode()) {
        {{ 'template.editLineTitle' | transloco }}
      } @else {
        {{ 'template.newLineTitle' | transloco }}
      }
    </h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-4">
        <form [formGroup]="form">
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
              data-testid="edit-template-line-name"
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
              data-testid="edit-template-line-amount"
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
              form.get('amount')?.hasError('min') && form.get('amount')?.touched
            ) {
              <mat-error>{{ 'budget.amountMinError' | transloco }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select
              formControlName="kind"
              data-testid="edit-template-line-kind"
            >
              @for (kind of kinds; track kind) {
                <mat-option [value]="kind">
                  <mat-icon [pulpeFinancialKind]="kind">
                    {{ kind | transactionIcon }}
                  </mat-icon>
                  <span>{{ kind | transactionLabel }}</span>
                </mat-option>
              }
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
      <button
        matButton
        (click)="handleCancel()"
        data-testid="cancel-edit-template-line"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="handleSubmit()"
        [disabled]="!form.valid"
        data-testid="save-edit-template-line"
      >
        <mat-icon>save</mat-icon>
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTemplateLineDialog {
  readonly #dialogRef = inject(
    MatDialogRef<EditTemplateLineDialog, EditTemplateLineDialogResult>,
  );
  readonly #data = inject<EditTemplateLineDialogData>(MAT_DIALOG_DATA);
  readonly #fb = inject(FormBuilder);
  readonly #lineSource = signal({
    originalAmount: this.#data.line?.originalAmount ?? null,
    originalCurrency: this.#data.line?.originalCurrency ?? null,
  });
  readonly #currencyConfig = injectCurrencyFormConfigForEdit(this.#lineSource);

  protected readonly kinds = TRANSACTION_KINDS;
  protected readonly isEditMode = computed(() => this.#data.line != null);
  protected readonly currency = this.#currencyConfig.currency;
  protected readonly showCurrencySelector =
    this.#currencyConfig.showCurrencySelector;
  protected readonly inputCurrency = this.#currencyConfig.inputCurrency;
  protected readonly conversionError = this.#currencyConfig.conversionError;

  readonly form = this.#fb.group({
    name: [
      this.#data.line?.name ?? '',
      [Validators.required, Validators.minLength(2)],
    ],
    amount: [
      this.#computeInitialAmount(),
      [Validators.required, Validators.min(0.01)],
    ],
    kind: [
      (this.#data.line?.kind ?? 'expense') as TransactionKind,
      Validators.required,
    ],
  });

  #computeInitialAmount(): number {
    const line = this.#data.line;
    if (!line) return 0;
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

    const result: EditTemplateLineDialogResult = {
      name: value.name!.trim(),
      amount: finalAmount,
      kind: value.kind!,
      ...(metadata ?? {}),
    };
    this.#dialogRef.close(result);
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
