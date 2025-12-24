import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FinancialSummary,
  type FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';
import {
  type BudgetLine,
  type Transaction,
  BudgetFormulas,
} from '@pulpe/shared';

@Component({
  selector: 'pulpe-budget-financial-overview',
  imports: [FinancialSummary],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <pulpe-financial-summary
        [data]="incomeData()"
        data-testid="financial-overview"
      />
      <pulpe-financial-summary [data]="expenseData()" />
      <pulpe-financial-summary [data]="savingsData()" />
      <pulpe-financial-summary [data]="remainingData()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFinancialOverview {
  budgetLines = input.required<BudgetLine[]>();
  transactions = input.required<Transaction[]>();

  totals = computed(() => {
    const lines = this.budgetLines();
    const txs = this.transactions();

    // Use BudgetFormulas to correctly handle envelope overruns
    // This ensures allocated transactions only count for their excess over the envelope
    const metrics = BudgetFormulas.calculateAllMetrics(lines, txs, 0);

    // Calculate savings separately for display
    const savings = lines
      .filter((line) => line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);

    // Calculate expenses (without savings) for display
    const expenses = lines
      .filter((line) => line.kind === 'expense')
      .reduce((sum, line) => sum + line.amount, 0);

    return {
      income: metrics.totalIncome,
      expenses,
      savings,
      remaining: metrics.remaining,
    };
  });

  incomeData = computed<FinancialSummaryData>(() => ({
    title: 'Revenus',
    amount: this.totals().income,
    icon: 'arrow_upward',
    type: 'income',
  }));

  expenseData = computed<FinancialSummaryData>(() => ({
    title: 'Dépenses',
    amount: this.totals().expenses,
    icon: 'arrow_downward',
    type: 'expense',
  }));

  savingsData = computed<FinancialSummaryData>(() => ({
    title: 'Épargne prévue',
    amount: this.totals().savings,
    icon: 'savings',
    type: 'savings',
  }));

  remainingData = computed<FinancialSummaryData>(() => {
    const remaining = this.totals().remaining;
    return {
      title: remaining >= 0 ? 'Disponible à dépenser' : 'Déficit',
      amount: Math.abs(remaining),
      icon: remaining >= 0 ? 'account_balance_wallet' : 'warning',
      type: remaining >= 0 ? 'savings' : 'negative',
    };
  });
}
