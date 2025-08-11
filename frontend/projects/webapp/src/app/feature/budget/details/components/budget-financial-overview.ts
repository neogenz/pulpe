import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FinancialSummary,
  FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';
import { type BudgetLine } from '@pulpe/shared';

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

  totals = computed(() => {
    const lines = this.budgetLines();
    let income = 0;
    let expenses = 0;
    let savings = 0;

    lines.forEach((line) => {
      switch (line.kind) {
        case 'income':
          income += line.amount;
          break;
        case 'expense':
          expenses += line.amount;
          break;
        case 'saving':
          savings += line.amount;
          break;
      }
    });

    const remaining = income - expenses - savings;

    return { income, expenses, savings, remaining };
  });

  incomeData = computed<FinancialSummaryData>(() => ({
    title: 'Revenus',
    amount: this.totals().income,
    icon: 'trending_up',
    type: 'income',
  }));

  expenseData = computed<FinancialSummaryData>(() => ({
    title: 'Dépenses',
    amount: this.totals().expenses,
    icon: 'trending_down',
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
