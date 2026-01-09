import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetLine, type Transaction } from 'pulpe-shared';
import { BudgetCalculator, calculateAllConsumptions } from '@core/budget';
import { RealizedBalanceProgressBar } from '@ui/realized-balance-progress-bar/realized-balance-progress-bar';
import { RealizedBalanceTooltip } from '@ui/realized-balance-tooltip/realized-balance-tooltip';

@Component({
  selector: 'pulpe-budget-financial-overview',
  imports: [
    MatCardModule,
    MatIconModule,
    DecimalPipe,
    RealizedBalanceProgressBar,
    RealizedBalanceTooltip,
  ],
  template: `
    <div class="space-y-4">
      <mat-card appearance="outlined">
        <mat-card-content class="py-4 px-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            <!-- Revenus -->
            <div class="text-center">
              <div class="flex items-center justify-center mb-1">
                <mat-icon class="text-base! text-on-surface!">
                  arrow_upward
                </mat-icon>
                <span class="text-label-large"> Revenus CHF </span>
              </div>
              <div
                class="text-title-large font-bold text-financial-income ph-no-capture"
              >
                {{ totals().income | number: '1.0-0' : 'de-CH' }}
              </div>
            </div>

            <!-- Dépenses -->
            <div class="text-center">
              <div class="flex items-center justify-center mb-1">
                <mat-icon class="text-base! text-on-surface!">
                  arrow_downward
                </mat-icon>
                <span class="text-label-large"> Dépenses CHF </span>
              </div>
              <div
                class="text-title-large font-bold text-financial-expense ph-no-capture"
              >
                {{ totals().expenses | number: '1.0-0' : 'de-CH' }}
              </div>
            </div>

            <!-- Épargne -->
            <div class="text-center">
              <div class="flex items-center justify-center mb-1">
                <mat-icon class="text-base! text-on-surface!">
                  savings
                </mat-icon>
                <span class="text-label-large"> Épargne CHF </span>
              </div>
              <div
                class="text-title-large font-bold text-financial-savings ph-no-capture"
              >
                {{ totals().savings | number: '1.0-0' : 'de-CH' }}
              </div>
            </div>

            <!-- Disponible -->
            <div class="text-center">
              <div class="flex items-center justify-center mb-1">
                <mat-icon class="text-base! text-on-surface!">
                  @if (totals().remaining >= 0) {
                    account_balance_wallet
                  } @else {
                    warning
                  }
                </mat-icon>
                <span class="text-label-large">
                  @if (totals().remaining >= 0) {
                    Disponible CHF
                  } @else {
                    Déficit CHF
                  }
                </span>
              </div>
              <div
                class="text-title-large font-bold ph-no-capture"
                [class.text-financial-savings]="totals().remaining >= 0"
                [class.text-error]="totals().remaining < 0"
              >
                {{ Math.abs(totals().remaining) | number: '1.0-0' : 'de-CH' }}
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <pulpe-realized-balance-progress-bar
        [realizedExpenses]="realizedExpenses()"
        [realizedBalance]="realizedBalance()"
        [checkedCount]="checkedCount()"
        [totalCount]="totalCount()"
        data-testid="realized-balance-progress"
      >
        <pulpe-realized-balance-tooltip slot="title-info" />
      </pulpe-realized-balance-progress-bar>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFinancialOverview {
  readonly Math = Math;
  readonly #budgetCalculator = inject(BudgetCalculator);

  budgetLines = input.required<BudgetLine[]>();
  transactions = input.required<Transaction[]>();
  realizedBalance = input.required<number>();
  realizedExpenses = input.required<number>();
  checkedCount = input.required<number>();
  totalCount = input.required<number>();

  totals = computed(() => {
    const lines = this.budgetLines();
    const transactions = this.transactions();

    const consumptionMap = calculateAllConsumptions(lines, transactions);

    const income = this.#budgetCalculator.calculatePlannedIncome(lines);
    let expenses = 0;
    let savings = 0;

    lines.forEach((line) => {
      const consumption = consumptionMap.get(line.id);
      const effectiveAmount = consumption
        ? Math.max(line.amount, consumption.consumed)
        : line.amount;

      switch (line.kind) {
        case 'expense':
          expenses += effectiveAmount;
          break;
        case 'saving':
          savings += effectiveAmount;
          break;
      }
    });

    const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
    const initialLivingAllowance = income - expenses - savings;
    const transactionImpact =
      this.#budgetCalculator.calculateActualTransactionsAmount(
        freeTransactions,
      );
    const remaining = initialLivingAllowance + transactionImpact;

    return { income, expenses, savings, remaining };
  });
}
