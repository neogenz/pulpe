import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
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
import { Field, form, required, minLength } from '@angular/forms/signals';
import {
  type BudgetLine,
  type BudgetLineUpdate,
  type TransactionKind,
  type TransactionRecurrence,
} from 'pulpe-shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { TransactionIconPipe } from '@ui/transaction-display';
import { TransactionLabelPipe } from '@ui/transaction-display';
import {
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
} from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { FeatureFlagsService } from '@core/feature-flags';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { budgetLineUpdateFromFormSchema } from './edit-budget-line-dialog.schema';

export interface EditBudgetLineDialogData {
  budgetLine: BudgetLine;
}

interface EditBudgetLineModel {
  name: string;
  money: AmountFormSlice;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
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
    TranslocoPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    Field,
    AmountInput,
  ],
  host: { 'data-testid': 'edit-budget-line-dialog' },
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budget.editForecast' | transloco }}
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
              [field]="editForm.name"
              [placeholder]="'budget.forecastNamePlaceholder' | transloco"
              data-testid="edit-line-name"
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
            [control]="editForm.money"
            mode="edit"
            [originalCurrency]="originalCurrencySignal()"
          />

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select [field]="editForm.kind" data-testid="edit-line-kind">
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
            @if (kindHasRequiredError()) {
              <mat-error>{{
                'budget.forecastTypeRequired' | transloco
              }}</mat-error>
            }
          </mat-form-field>
        </div>
      </div>
    </mat-dialog-content>

    @if (conversionError()) {
      <p role="alert" class="text-error text-body-small px-6 pb-2">
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
        [disabled]="!canSubmit()"
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
  readonly #settings = inject(UserSettingsStore);
  readonly #flags = inject(FeatureFlagsService);
  readonly #converter = inject(CurrencyConverterService);

  readonly #originalCurrency = this.#data.budgetLine.originalCurrency ?? null;

  protected readonly originalCurrencySignal = signal(this.#originalCurrency);

  protected readonly showCurrencySelector = computed(
    () =>
      this.#flags.isMultiCurrencyEnabled() &&
      this.#originalCurrency !== null &&
      this.#originalCurrency !== this.#settings.currency(),
  );

  protected readonly model = signal<EditBudgetLineModel>({
    name: this.#data.budgetLine.name,
    money: createAmountSlice({
      initialCurrency:
        this.#data.budgetLine.originalCurrency ?? this.#settings.currency(),
      initialAmount: this.#computeInitialAmount(),
    }),
    kind: this.#data.budgetLine.kind,
    recurrence: this.#data.budgetLine.recurrence,
  });

  protected readonly editForm = form(this.model, (path) => {
    required(path.name, { message: 'budget.forecastNameRequired' });
    minLength(path.name, 1);
    applyAmountValidators(path.money);
    required(path.kind, { message: 'budget.forecastTypeRequired' });
    required(path.recurrence);
  });

  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly canSubmit = computed(
    () => this.editForm().valid() && !this.isSubmitting(),
  );

  protected readonly kindHasRequiredError = computed(
    () =>
      this.editForm.kind().touched() &&
      this.editForm
        .kind()
        .errors()
        .some((e) => e.kind === 'required'),
  );

  protected readonly nameErrors = computed(() => {
    const state = this.editForm.name();
    if (!state.touched()) return { required: false, minLength: false };
    const errors = state.errors();
    return {
      required: errors.some((e) => e.kind === 'required'),
      minLength: errors.some((e) => e.kind === 'minLength'),
    };
  });

  #computeInitialAmount(): number {
    const line = this.#data.budgetLine;
    if (this.showCurrencySelector() && line.originalAmount != null) {
      return line.originalAmount;
    }
    return line.amount;
  }

  async handleSubmit(): Promise<void> {
    if (!this.editForm().valid()) return;

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

      const formPart = budgetLineUpdateFromFormSchema.parse({
        name: m.name,
        amount: convertedAmount,
        kind: m.kind,
        recurrence: m.recurrence,
        conversion: metadata,
      });
      const update: BudgetLineUpdate = {
        id: this.#data.budgetLine.id,
        templateLineId: this.#data.budgetLine.templateLineId,
        savingsGoalId: this.#data.budgetLine.savingsGoalId,
        ...formPart,
      };
      this.#dialogRef.close(update);
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
