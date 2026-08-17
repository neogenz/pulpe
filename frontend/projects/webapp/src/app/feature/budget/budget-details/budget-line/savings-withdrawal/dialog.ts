import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { formatDate } from 'date-fns';
import {
  type BudgetLineSavingsWithdrawalCreate,
  type SupportedCurrency,
} from 'pulpe-shared';

import {
  applyAmountValidators,
  AppCurrencyPipe,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
  runFormSubmit,
  StaleRateNotifier,
} from '@core/currency';
import { Logger } from '@core/logging/logger';
import { dateFnsLocaleFor } from '@core/locale';
import { UserSettingsStore } from '@core/user-settings';
import { AmountInput } from '@app/pattern/amount-input/amount-input';

import { offsetMonth } from '../create/spread.utils';
import { budgetLineSavingsWithdrawalFromFormSchema } from './dialog.schema';

export interface SavingsWithdrawalDialogData {
  budgetId: string;
  budgetMonth: number;
  budgetYear: number;
  /** Positive magnitude of the month's deficit — pre-fills the quick chip. */
  deficitAmount: number;
  /** Toggle-driven entry (PUL-292, CA2): start on the preview with these values. */
  prefill?: {
    amount?: number;
    source?: string;
    /** Currency the prefilled amount was typed in (defaults to the user's). */
    inputCurrency?: SupportedCurrency;
  };
}

type Step = 'amount' | 'preview';

interface SavingsWithdrawalModel {
  money: AmountFormSlice;
  source: string;
}

/**
 * PUL-292 — "piocher dans son épargne" (web). One dialog, two steps via a `step`
 * signal: step 1 captures the amount (with a deficit quick-fill chip + optional
 * source), step 2 previews the two-month couple (M / M+1). Confirm freezes the
 * FX (RG-009) and mints ONE idempotency key per instance, then hands the built
 * DTO back — the caller runs the store mutation with a retry snackbar. Copy is
 * contractual (CA5, validated in test user): never "avance" nor "emprunt".
 */
@Component({
  selector: 'pulpe-savings-withdrawal-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
    FormField,
    AmountInput,
  ],
  host: { 'data-testid': 'savings-withdrawal-dialog' },
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budget.savingsWithdrawal.cta' | transloco }}
    </h2>

    <mat-dialog-content>
      @if (step() === 'amount') {
        <div
          class="flex flex-col gap-4 pt-4"
          data-testid="withdrawal-step-amount"
        >
          <pulpe-amount-input
            [control]="withdrawalForm.money"
            [label]="'budget.savingsWithdrawal.amountLabel'"
          />

          @if (deficitChipAmount() > 0) {
            <button
              type="button"
              matButton="outlined"
              class="self-start !rounded-full"
              (click)="applyDeficit()"
              data-testid="withdrawal-deficit-chip"
            >
              <mat-icon>savings</mat-icon>
              {{
                'budget.savingsWithdrawal.deficitChip'
                  | transloco: { amount: deficitChipDisplay() }
              }}
            </button>
          }

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{
              'budget.savingsWithdrawal.sourceLabel' | transloco
            }}</mat-label>
            <input
              matInput
              [formField]="withdrawalForm.source"
              [placeholder]="
                'budget.savingsWithdrawal.sourcePlaceholder' | transloco
              "
              data-testid="withdrawal-source"
            />
          </mat-form-field>
        </div>
      } @else {
        <div
          class="flex flex-col gap-5 pt-4"
          data-testid="withdrawal-step-preview"
        >
          <p class="text-title-medium font-medium text-on-surface">
            {{ 'budget.savingsWithdrawal.previewTitle' | transloco }}
          </p>

          <div
            class="flex flex-col gap-1 rounded-corner-medium bg-surface-container-low p-4"
          >
            <span class="text-label-medium text-on-surface-variant capitalize">
              {{
                'budget.savingsWithdrawal.monthChosen'
                  | transloco: { month: monthName() }
              }}
            </span>
            <span class="text-label-large font-medium text-financial-income">
              {{ 'budget.savingsWithdrawal.incomeKind' | transloco }}
            </span>
            <span
              class="text-headline-small font-bold text-financial-income ph-no-capture"
            >
              +{{ previewAmount() | appCurrency: previewCurrency() : '1.2-2' }}
            </span>
            <span class="text-body-medium text-on-surface-variant">
              {{ 'budget.savingsWithdrawal.incomeNote' | transloco }}
            </span>
            <span class="text-label-small text-on-surface-variant">
              {{ 'budget.savingsWithdrawal.incomeFootnote' | transloco }}
            </span>
          </div>

          <mat-icon
            class="self-center text-on-surface-variant"
            aria-hidden="true"
            >arrow_downward</mat-icon
          >

          <div
            class="flex flex-col gap-1 rounded-corner-medium bg-surface-container-low p-4"
          >
            <span class="text-label-medium text-on-surface-variant capitalize">
              {{
                'budget.savingsWithdrawal.monthNext'
                  | transloco: { month: nextMonthName() }
              }}
            </span>
            <span class="text-label-large font-medium text-primary">
              {{ 'budget.savingsWithdrawal.savingKind' | transloco }}
            </span>
            <span
              class="text-headline-small font-bold text-primary ph-no-capture"
            >
              −{{ previewAmount() | appCurrency: previewCurrency() : '1.2-2' }}
            </span>
            <span class="text-body-medium text-on-surface-variant">
              {{ 'budget.savingsWithdrawal.savingNote' | transloco }}
            </span>
          </div>

          <p class="text-body-medium text-on-surface-variant">
            {{
              'budget.savingsWithdrawal.summary'
                | transloco: { month: monthName(), nextMonth: nextMonthName() }
            }}
          </p>
        </div>
      }
    </mat-dialog-content>

    @if (conversionError()) {
      <p role="alert" class="text-error text-body-small px-6 pb-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }

    <mat-dialog-actions align="end">
      @if (step() === 'amount') {
        <button matButton (click)="cancel()" data-testid="withdrawal-cancel">
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          matButton="filled"
          (click)="goToPreview()"
          [disabled]="!canContinue()"
          data-testid="withdrawal-continue"
        >
          {{ 'budget.savingsWithdrawal.continue' | transloco }}
        </button>
      } @else {
        <button
          matButton
          (click)="backToAmount()"
          data-testid="withdrawal-edit"
        >
          {{ 'budget.savingsWithdrawal.editAmount' | transloco }}
        </button>
        <button
          matButton="filled"
          (click)="confirm()"
          [disabled]="isSubmitting()"
          data-testid="withdrawal-confirm"
        >
          {{ 'budget.savingsWithdrawal.confirm' | transloco }}
        </button>
      }
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsWithdrawalDialog {
  readonly #dialogRef =
    inject<
      MatDialogRef<SavingsWithdrawalDialog, BudgetLineSavingsWithdrawalCreate>
    >(MatDialogRef);
  readonly #data = inject<SavingsWithdrawalDialogData>(MAT_DIALOG_DATA);
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);
  readonly #staleRateNotifier = inject(StaleRateNotifier);

  // Idempotency key for THIS intent — minted once, replayed on retry so a
  // double-tap replays the couple server-side instead of duplicating it.
  readonly #groupId = crypto.randomUUID();

  protected readonly currency = this.#settings.currency;

  protected readonly model = signal<SavingsWithdrawalModel>({
    money: createAmountSlice({
      initialCurrency:
        this.#data.prefill?.inputCurrency ?? this.#settings.currency(),
      initialAmount: this.#data.prefill?.amount ?? null,
    }),
    source: this.#data.prefill?.source ?? '',
  });

  protected readonly withdrawalForm = form(this.model, (path) => {
    applyAmountValidators(path.money);
  });

  protected readonly step = signal<Step>(
    this.#data.prefill?.amount != null ? 'preview' : 'amount',
  );

  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);

  readonly #dateFnsLocale = computed(() =>
    dateFnsLocaleFor(this.#settings.locale(), this.#settings.currency()),
  );

  protected readonly monthName = computed(() =>
    this.#formatMonth(this.#data.budgetMonth, this.#data.budgetYear),
  );

  protected readonly nextMonthName = computed(() => {
    const next = offsetMonth(
      { year: this.#data.budgetYear, month: this.#data.budgetMonth },
      1,
    );
    return this.#formatMonth(next.month, next.year);
  });

  protected readonly deficitChipAmount = computed(() =>
    Math.max(0, this.#data.deficitAmount),
  );

  readonly #currencyPipe = new AppCurrencyPipe();
  protected readonly deficitChipDisplay = computed(
    () =>
      this.#currencyPipe.transform(
        this.deficitChipAmount(),
        this.currency(),
        '1.0-0',
      ) ?? '',
  );

  protected readonly previewAmount = computed(
    () => this.model().money.amount ?? 0,
  );
  protected readonly previewCurrency = computed<SupportedCurrency>(
    () => this.model().money.inputCurrency,
  );

  protected readonly canContinue = computed(() =>
    this.withdrawalForm().valid(),
  );

  protected applyDeficit(): void {
    this.model.update((m) => ({
      ...m,
      money: { ...m.money, amount: this.deficitChipAmount() },
    }));
  }

  protected goToPreview(): void {
    if (!this.canContinue()) return;
    this.step.set('preview');
  }

  protected backToAmount(): void {
    this.step.set('amount');
  }

  protected async confirm(): Promise<void> {
    await runFormSubmit({
      form: this.withdrawalForm,
      isSubmitting: this.isSubmitting,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        const source = m.source.trim();
        return {
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata) =>
            budgetLineSavingsWithdrawalFromFormSchema.parse({
              budgetId: this.#data.budgetId,
              amount,
              incomeName:
                source.length > 0
                  ? source
                  : this.#transloco.translate(
                      'budget.savingsWithdrawal.defaultSource',
                    ),
              savingName: this.#transloco.translate(
                'budget.savingsWithdrawal.savingLineName',
              ),
              groupId: this.#groupId,
              conversion: metadata,
            }),
        };
      },
      onSuccess: (value, outcome) => {
        this.#staleRateNotifier.notify(outcome);
        this.#dialogRef.close(value);
      },
    });
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }

  #formatMonth(month: number, year: number): string {
    return formatDate(new Date(year, month - 1, 1), 'MMMM', {
      locale: this.#dateFnsLocale(),
    });
  }
}
