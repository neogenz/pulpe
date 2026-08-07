import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Transaction, TransactionKind } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { FinancialKindDirective } from '@ui/financial-kind';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-dashboard-recent-transactions',
  imports: [
    AppCurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    FinancialKindDirective,
    TransactionIconPipe,
    TransactionLabelPipe,
    SavingsGoalSourceLine,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0"
          >
            <mat-icon aria-hidden="true">receipt_long</mat-icon>
          </div>
          <div>
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              {{ 'currentMonth.recentTransactionsTitle' | transloco }}
            </h2>
            <p
              class="text-body-small text-on-surface-variant font-medium mt-0.5"
            >
              {{
                'currentMonth.recentTransactionsSubtitle'
                  | transloco: { count: transactions().length }
              }}
            </p>
          </div>
        </div>
        <button matButton (click)="viewBudget.emit()">
          {{ 'common.viewAll' | transloco }}
        </button>
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (transactions().length > 0) {
          <div class="flex flex-col gap-1">
            @for (tx of transactions(); track tx.id) {
              <div
                class="flex items-center gap-3 p-3 rounded-2xl hover:bg-on-surface/8 motion-safe:transition-colors"
              >
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  [class]="kindClasses(tx.kind)"
                >
                  <mat-icon class="text-[20px]" aria-hidden="true">
                    {{ tx.kind | transactionIcon }}
                  </mat-icon>
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-body-medium font-medium text-on-surface truncate ph-no-capture"
                  >
                    {{ tx.name }}
                  </p>
                  <p
                    class="text-body-small text-on-surface-variant font-medium flex items-center gap-1.5 min-w-0"
                  >
                    <span class="shrink-0">{{
                      tx.transactionDate | date: 'dd MMM'
                    }}</span>
                    @if (tx.sourceSavingsGoalName) {
                      <span aria-hidden="true" class="opacity-50">·</span>
                      <pulpe-savings-goal-source-line
                        [goalId]="tx.sourceSavingsGoalId"
                        [goalName]="tx.sourceSavingsGoalName"
                        [attr.data-testid]="
                          'dashboard-transaction-source-' + tx.id
                        "
                      />
                    }
                  </p>
                </div>
                <span
                  class="text-label-large whitespace-nowrap ml-4 font-semibold tabular-nums ph-no-capture"
                  [pulpeFinancialKind]="tx.kind"
                >
                  <!-- Revenu, dépense and épargne were told apart by the tint
                       and by the arrow in the circle — and that circle is
                       aria-hidden, so the accessibility tree read "Acompte
                       notaire, 06 août, 300.00 CHF" and never which direction
                       the money went. Same two lines as the forecasts list
                       twenty pixels away, which already got this right. -->
                  <span class="sr-only">{{ tx.kind | transactionLabel }}</span>
                  {{ tx.amount | appCurrency: currency() : '1.2-2' }}
                </span>
              </div>
            }
          </div>
        } @else {
          <div
            class="p-8 flex flex-col items-center justify-center text-center h-full"
          >
            <div
              class="w-16 h-16 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center mb-4"
            >
              <mat-icon class="scale-150 flex! shrink-0!" aria-hidden="true"
                >receipt_long</mat-icon
              >
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'currentMonth.noTransaction' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{ 'currentMonth.noTransactionThisMonth' | transloco }}
            </p>
            <button
              matButton="outlined"
              class="mt-4 !h-11"
              data-testid="empty-state-add-transaction"
              (click)="addTransaction.emit()"
            >
              <mat-icon>add</mat-icon>
              {{ 'currentMonth.addFirstTransaction' | transloco }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DashboardRecentTransactions {
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly currency = this.#userSettings.currency;
  readonly transactions = input.required<Transaction[]>();
  readonly viewBudget = output<void>();
  readonly addTransaction = output<void>();

  protected kindClasses(kind: TransactionKind): string {
    switch (kind) {
      case 'income':
        return 'bg-financial-income/10 text-financial-income';
      case 'saving':
        return 'bg-financial-savings/10 text-financial-savings';
      case 'expense':
        return 'bg-surface-container-high text-on-surface-variant';
    }
  }
}
