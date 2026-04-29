import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Field, form, minLength, required } from '@angular/forms/signals';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { type TransactionKind, type TransactionRecurrence } from 'pulpe-shared';

import {
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
} from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';

import { budgetLineCreateFromFormSchema } from './add-budget-line-dialog.schema';

export interface BudgetLineDialogData {
  budgetId: string;
}

interface AddBudgetLineModel {
  name: string;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  isChecked: boolean;
  money: AmountFormSlice;
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
    TranslocoPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    Field,
    AmountInput,
  ],
  host: { 'data-testid': 'add-budget-line-dialog' },
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budget.newForecast' | transloco }}
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
              data-testid="new-line-name"
            />
          </mat-form-field>

          <pulpe-amount-input [control]="addForm.money" />

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select [field]="addForm.kind" data-testid="new-line-kind">
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
              [field]="addForm.isChecked"
              [attr.aria-label]="'budget.forecastCheckedToggle' | transloco"
            />
          </div>
        </div>
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
        [disabled]="!canSubmit()"
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
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);

  protected readonly model = signal<AddBudgetLineModel>({
    name: '',
    kind: 'expense',
    recurrence: 'one_off',
    isChecked: false,
    money: createAmountSlice({ initialCurrency: this.#settings.currency() }),
  });

  protected readonly addForm = form(this.model, (path) => {
    required(path.name, { message: 'budget.forecastNameRequired' });
    minLength(path.name, 1);
    applyAmountValidators(path.money);
    required(path.kind, { message: 'budget.forecastTypeRequired' });
  });

  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly canSubmit = computed(
    () => this.addForm().valid() && !this.isSubmitting(),
  );

  protected async submit(): Promise<void> {
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

      const dto = budgetLineCreateFromFormSchema.parse({
        budgetId: this.#data.budgetId,
        name: m.name.trim(),
        amount: convertedAmount,
        kind: m.kind,
        recurrence: m.recurrence,
        isChecked: m.isChecked,
        conversion: metadata,
      });
      this.#dialogRef.close(dto);
    } catch {
      this.conversionError.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }
}
