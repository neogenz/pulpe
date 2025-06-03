import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FinancialSummary,
  FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';

@Component({
  selector: 'pulpe-current-month',
  imports: [FinancialSummary],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Mois en cours</h1>
      <div class="bg-surface-container rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
          <pulpe-financial-summary [data]="incomeData" />
          <pulpe-financial-summary [data]="expenseData" />
          <pulpe-financial-summary [data]="savingsData" />
          <pulpe-financial-summary [data]="negativeData" />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth {
  // Data configuration matching screenshot
  readonly incomeData: FinancialSummaryData = {
    title: 'Gagné', // Income in French
    amount: "8'500 CHF", // Swiss formatting
    icon: 'trending_up', // Blue upward arrow
    type: 'income', // Blue background
    isClickable: true,
  };

  readonly expenseData: FinancialSummaryData = {
    title: 'Dépensé', // Expense in French
    amount: "7'438 CHF", // Swiss formatting
    icon: 'trending_down', // Orange downward arrow
    type: 'expense', // Orange background
    isClickable: true,
  };

  readonly savingsData: FinancialSummaryData = {
    title: 'Économisé', // Savings in French
    amount: "1'234 CHF", // Swiss formatting
    icon: 'attach_money', // Green dollar sign
    type: 'savings', // Green background
    isClickable: true,
  };

  readonly negativeData: FinancialSummaryData = {
    title: 'Négatif', // Negative in French
    amount: '234 CHF', // Swiss formatting
    icon: 'money_off', // Red dollar sign with slash
    type: 'negative', // Red background
    isClickable: true,
  };
}
