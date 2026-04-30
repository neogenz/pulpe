import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Field, form, minLength, required } from '@angular/forms/signals';
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
import {
  type TemplateLine,
  type TransactionKind,
  type SupportedCurrency,
} from 'pulpe-shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { FinancialKindDirective } from '@ui/financial-kind';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import {
  applyAmountValidators,
  createAmountSlice,
  type AmountFormSlice,
  CurrencyConverterService,
} from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { FeatureFlagsService } from '@core/feature-flags';
import { touchedFieldErrors } from '@core/validators';
import { AmountInput } from '@app/pattern/amount-input/amount-input';

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

interface EditTemplateLineModel {
  name: string;
  money: AmountFormSlice;
  kind: TransactionKind;
}

@Component({
  selector: 'pulpe-edit-template-line-dialog',
  host: { 'data-testid': 'edit-template-line-dialog' },
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    FinancialKindDirective,
    Field,
    AmountInput,
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
        <div class="flex flex-col gap-4">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastNameLabel' | transloco }}</mat-label>
            <input
              matInput
              [field]="addForm.name"
              [placeholder]="'budget.forecastNamePlaceholder' | transloco"
              data-testid="edit-template-line-name"
            />
            @if (nameErrors().required) {
              <mat-error>{{
                'budget.forecastNameRequired' | transloco
              }}</mat-error>
            }
            @if (nameErrors().minLength) {
              <mat-error>{{
                'budget.forecastNameMinLength' | transloco
              }}</mat-error>
            }
          </mat-form-field>

          <pulpe-amount-input
            [control]="addForm.money"
            [mode]="mode()"
            [originalCurrency]="originalCurrency()"
          />

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select
              [field]="addForm.kind"
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
            @if (kindErrors().required) {
              <mat-error>{{
                'budget.forecastTypeRequired' | transloco
              }}</mat-error>
            }
          </mat-form-field>
        </div>
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
        [disabled]="!canSubmit()"
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
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #flags = inject(FeatureFlagsService);

  protected readonly kinds = TRANSACTION_KINDS;
  protected readonly isEditMode = computed(() => this.#data.line != null);
  protected readonly mode = computed(() =>
    this.#data.line ? ('edit' as const) : ('create' as const),
  );
  protected readonly originalCurrency = computed(
    () => this.#data.line?.originalCurrency ?? null,
  );

  protected readonly showCurrencySelector = computed(() => {
    if (!this.#flags.isMultiCurrencyEnabled()) return false;
    if (this.#data.line != null) {
      const orig = this.#data.line.originalCurrency ?? null;
      return orig !== null && orig !== this.#settings.currency();
    }
    return this.#settings.showCurrencySelector();
  });

  protected readonly inputCurrency = computed<SupportedCurrency>(
    () => this.model().money.inputCurrency,
  );

  protected readonly model = signal<EditTemplateLineModel>({
    name: this.#data.line?.name ?? '',
    money: this.#computeInitialSlice(),
    kind: (this.#data.line?.kind ?? 'expense') as TransactionKind,
  });

  protected readonly addForm = form(this.model, (path) => {
    required(path.name);
    minLength(path.name, 1);
    applyAmountValidators(path.money);
    required(path.kind);
  });

  protected readonly nameErrors = touchedFieldErrors(
    () => this.addForm.name,
    'required',
    'minLength',
  );
  protected readonly kindErrors = touchedFieldErrors(
    () => this.addForm.kind,
    'required',
  );

  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly canSubmit = computed(
    () => this.addForm().valid() && !this.isSubmitting(),
  );

  protected readonly submitIcon = computed(() =>
    this.isEditMode() ? 'save' : 'add',
  );
  protected readonly submitLabelKey = computed(() =>
    this.isEditMode() ? 'common.save' : 'common.add',
  );

  #computeInitialSlice(): AmountFormSlice {
    const line = this.#data.line;
    const userCurrency = this.#settings.currency();

    if (line) {
      const isPickerVisible =
        this.#flags.isMultiCurrencyEnabled() &&
        (line.originalCurrency ?? null) !== null &&
        line.originalCurrency !== userCurrency;

      if (isPickerVisible && line.originalAmount != null) {
        return createAmountSlice({
          initialCurrency: line.originalCurrency!,
          initialAmount: line.originalAmount,
        });
      }
      return createAmountSlice({
        initialCurrency: userCurrency,
        initialAmount: line.amount,
      });
    }

    return createAmountSlice({ initialCurrency: userCurrency });
  }

  protected handleInputCurrencyChange(currency: SupportedCurrency): void {
    this.model.update((m) => ({
      ...m,
      money: { ...m.money, inputCurrency: currency },
    }));
  }

  async handleSubmit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.conversionError.set(false);
    this.isSubmitting.set(true);
    try {
      const m = this.model();
      const { convertedAmount, metadata } =
        await this.#converter.convertWithMetadata(
          m.money.amount!,
          m.money.inputCurrency,
          this.#settings.currency(),
        );

      const result: EditTemplateLineDialogResult = {
        name: m.name.trim(),
        amount: convertedAmount,
        kind: m.kind,
        ...(metadata ?? {}),
      };
      this.#dialogRef.close(result);
    } catch {
      this.conversionError.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
