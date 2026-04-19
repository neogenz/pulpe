import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { Transaction } from 'pulpe-shared';
import { AppCurrencyPipe, buildConversionTooltip } from '@core/currency';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CurrencyConversionBadge } from '@ui/currency-conversion-badge';
import type {
  AllocatedTransactionsDialogData,
  AllocatedTransactionsDialogResult,
} from './allocated-transactions-dialog';

@Component({
  selector: 'pulpe-allocated-transactions-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    AppCurrencyPipe,
    CurrencyConversionBadge,
    TranslocoPipe,
    DatePipe,
    DecimalPipe,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6">
      <!-- Drag indicator -->
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2
          class="text-title-large text-on-surface m-0"
          data-testid="sheet-title"
        >
          {{ data.budgetLine.name }}
        </h2>
        <button
          matIconButton
          (click)="close()"
          [attr.aria-label]="'common.close' | transloco"
          data-testid="close-button"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-3 gap-2">
        <!-- Dépensé (mis en avant) -->
        <div class="text-center p-2 bg-surface-container rounded-lg">
          <div class="text-label-small text-on-surface-variant">
            {{ 'budget.consumedLabel' | transloco }}
          </div>
          <div
            class="text-title-medium font-bold ph-no-capture"
            [class.text-financial-income]="data.budgetLine.kind === 'income'"
            [class.text-financial-expense]="data.budgetLine.kind === 'expense'"
            [class.text-financial-savings]="data.budgetLine.kind === 'saving'"
          >
            {{ consumption().consumed | appCurrency: currency() : '1.0-0' }}
          </div>
        </div>
        <!-- Prévu -->
        <div class="text-center p-2 bg-surface-container rounded-lg">
          <div class="text-label-small text-on-surface-variant">
            {{ 'budget.tablePlanned' | transloco }}
          </div>
          <div
            class="text-title-small font-semibold ph-no-capture flex items-center justify-center gap-1"
          >
            {{ data.budgetLine.amount | appCurrency: currency() : '1.0-0' }}
            @if (isMultiCurrencyEnabled()) {
              <pulpe-currency-conversion-badge
                [originalAmount]="data.budgetLine.originalAmount"
                [originalCurrency]="data.budgetLine.originalCurrency"
                [exchangeRate]="data.budgetLine.exchangeRate"
                [tooltipText]="
                  conversionTooltip(
                    data.budgetLine.originalAmount,
                    data.budgetLine.originalCurrency,
                    data.budgetLine.exchangeRate
                  )
                "
              />
            }
          </div>
        </div>
        <!-- Reste -->
        <div class="text-center p-2 bg-surface-container rounded-lg">
          <div class="text-label-small text-on-surface-variant">
            {{ 'budget.availableLabel' | transloco }}
          </div>
          <div
            class="text-title-small font-semibold ph-no-capture"
            [class.text-error]="consumption().remaining < 0"
            [class.text-financial-income]="consumption().remaining >= 0"
          >
            {{ consumption().remaining | appCurrency: currency() : '1.0-0' }}
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div>
        <mat-progress-bar
          mode="determinate"
          [value]="consumptionPercentage()"
          [class.warn-bar]="consumptionPercentage() > 100"
        />
        <div class="text-label-small text-on-surface-variant text-center mt-1">
          {{ consumptionPercentage() | number: '1.0-0'
          }}{{ 'budgetLine.consumed' | transloco }}
        </div>
      </div>

      <!-- Transactions list -->
      <div class="max-h-[40vh] overflow-y-auto">
        @if (transactions().length > 0) {
          <div class="flex flex-col gap-2">
            @for (tx of transactions(); track tx.id) {
              <div
                class="flex items-center gap-3 py-3 px-1 bg-surface-container-low rounded-lg"
              >
                <mat-slide-toggle
                  [checked]="!!tx.checkedAt"
                  (change)="onToggleCheck(tx.id)"
                  (click)="$event.stopPropagation()"
                  [attr.data-testid]="'toggle-tx-check-' + tx.id"
                  [attr.aria-label]="
                    'budget.toggleCheckAriaLabel' | transloco: { name: tx.name }
                  "
                />
                <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span
                    class="text-body-medium font-medium truncate ph-no-capture"
                    [class.line-through]="tx.checkedAt"
                    [class.text-on-surface-variant]="tx.checkedAt"
                    data-testid="deleted-amount"
                  >
                    {{ tx.name }}
                  </span>
                  <span class="text-label-small text-on-surface-variant">
                    {{ tx.transactionDate | date: 'dd.MM.yyyy' }}
                  </span>
                </div>
                <span
                  class="text-body-medium font-semibold whitespace-nowrap ph-no-capture inline-flex items-center gap-1"
                >
                  {{ tx.amount | appCurrency: currency() }}
                  @if (isMultiCurrencyEnabled()) {
                    <pulpe-currency-conversion-badge
                      [originalAmount]="tx.originalAmount"
                      [originalCurrency]="tx.originalCurrency"
                      [exchangeRate]="tx.exchangeRate"
                      [tooltipText]="
                        conversionTooltip(
                          tx.originalAmount,
                          tx.originalCurrency,
                          tx.exchangeRate
                        )
                      "
                    />
                  }
                </span>
                <button
                  matIconButton
                  (click)="editTransaction(tx)"
                  [attr.aria-label]="
                    'budget.editTransactionAriaLabel' | transloco
                  "
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  matIconButton
                  (click)="deleteTransaction(tx)"
                  [attr.aria-label]="
                    'budget.deleteTransactionAriaLabel' | transloco
                  "
                  class="text-error"
                >
                  <mat-icon class="text-error">delete</mat-icon>
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="text-center py-6 text-on-surface-variant">
            <mat-icon class="mb-2!">receipt_long</mat-icon>
            <p class="text-body-medium">
              {{ 'budget.noTransaction' | transloco }}
            </p>
          </div>
        }
      </div>

      <!-- Action button -->
      <div class="pt-2">
        <button matButton="filled" (click)="addTransaction()" class="w-full">
          <mat-icon>add</mat-icon>
          {{ 'budget.newTransactionButton' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsBottomSheet {
  readonly #userSettings = inject(UserSettingsStore);
  readonly #featureFlags = inject(FeatureFlagsService);
  readonly #transloco = inject(TranslocoService);
  protected readonly currency = this.#userSettings.currency;
  protected readonly isMultiCurrencyEnabled =
    this.#featureFlags.isMultiCurrencyEnabled;
  readonly data = inject<AllocatedTransactionsDialogData>(
    MAT_BOTTOM_SHEET_DATA,
  );
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<
      AllocatedTransactionsBottomSheet,
      AllocatedTransactionsDialogResult
    >,
  );

  protected readonly transactions = signal(
    this.data.consumption.allocatedTransactions,
  );

  protected readonly consumption = computed(() => {
    const consumed = this.transactions().reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );
    return {
      consumed,
      remaining: this.data.budgetLine.amount - consumed,
    };
  });

  protected readonly consumptionPercentage = computed(() =>
    this.data.budgetLine.amount > 0
      ? Math.round(
          (this.consumption().consumed / this.data.budgetLine.amount) * 100,
        )
      : 0,
  );

  close(): void {
    this.#bottomSheetRef.dismiss();
  }

  addTransaction(): void {
    this.#bottomSheetRef.dismiss({ action: 'add' });
  }

  editTransaction(transaction: Transaction): void {
    this.#bottomSheetRef.dismiss({ action: 'edit', transaction });
  }

  deleteTransaction(transaction: Transaction): void {
    this.#bottomSheetRef.dismiss({ action: 'delete', transaction });
  }

  protected conversionTooltip(
    originalAmount: number | null | undefined,
    originalCurrency: string | null | undefined,
    exchangeRate: number | null | undefined,
  ): string {
    return buildConversionTooltip(
      this.#transloco,
      originalAmount,
      originalCurrency,
      exchangeRate,
    );
  }

  protected onToggleCheck(id: string): void {
    this.transactions.update((txs) =>
      txs.map((tx) =>
        tx.id === id
          ? { ...tx, checkedAt: tx.checkedAt ? null : new Date().toISOString() }
          : tx,
      ),
    );
    this.data.onToggleTransactionCheck?.(id);
  }
}
