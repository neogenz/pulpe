import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { ConversionPreviewLine } from '@ui/conversion-preview-line';
import { FinancialKindDirective } from '@ui/financial-kind';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import type { CurrencyConverterService } from '@core/currency';
import {
  injectCurrencyFormConfig,
  injectCurrencyFormConfigForEdit,
  injectLiveConversionPreview,
} from '@core/currency';

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
    ConversionPreviewLine,
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
                placeholder="0.00"
                step="0.01"
                min="0"
                inputmode="decimal"
                data-testid="edit-template-line-amount"
              />
              <pulpe-currency-suffix
                matTextSuffix
                [showSelector]="showCurrencySelector()"
                [disabled]="isEditMode()"
                [currency]="inputCurrency()"
                (currencyChange)="handleInputCurrencyChange($event)"
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
        color="primary"
        (click)="handleSubmit()"
        [disabled]="!form.valid"
        data-testid="save-edit-template-line"
      >
        <mat-icon>{{ submitIcon() }}</mat-icon>
        {{ submitLabelKey() | transloco }}
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
  readonly #currencyConfig =
    this.#data.line != null
      ? injectCurrencyFormConfigForEdit(this.#lineSource)
      : injectCurrencyFormConfig();

  protected readonly kinds = TRANSACTION_KINDS;
  protected readonly isEditMode = computed(() => this.#data.line != null);
  protected readonly currency = this.#currencyConfig.currency;
  protected readonly showCurrencySelector =
    this.#currencyConfig.showCurrencySelector;
  protected readonly inputCurrency = this.#currencyConfig.inputCurrency;
  protected readonly conversionError = this.#currencyConfig.conversionError;
  protected readonly submitIcon = computed(() =>
    this.isEditMode() ? 'save' : 'add',
  );
  protected readonly submitLabelKey = computed(() =>
    this.isEditMode() ? 'common.save' : 'common.add',
  );

  readonly form = this.#fb.group({
    name: [
      this.#data.line?.name ?? '',
      [Validators.required, Validators.minLength(2)],
    ],
    amount: [
      this.#computeInitialAmount() as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
    kind: [
      (this.#data.line?.kind ?? 'expense') as TransactionKind,
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

  #computeInitialAmount(): number | null {
    const line = this.#data.line;
    if (!line) return null;
    if (
      this.#currencyConfig.showCurrencySelector() &&
      line.originalAmount != null
    ) {
      return line.originalAmount;
    }
    return line.amount;
  }

  protected handleInputCurrencyChange(currency: SupportedCurrency): void {
    this.#currencyConfig.setInputCurrency?.(currency);
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
