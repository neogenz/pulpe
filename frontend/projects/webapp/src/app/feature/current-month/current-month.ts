import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FinancialSummary,
  FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';

@Component({
  selector: 'pulpe-current-month',
  imports: [FinancialSummary],
  template: `
    <h1 class="text-display-small mb-4">Budget du mois courant</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <pulpe-financial-summary [data]="incomeData" />
      <pulpe-financial-summary [data]="expenseData" />
      <pulpe-financial-summary [data]="savingsData" />
      <pulpe-financial-summary [data]="negativeData" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth {
  // Data configuration matching screenshot
  readonly incomeData: FinancialSummaryData = {
    title: 'Gagné',
    amount: 8500,
    icon: 'trending_up',
    type: 'income',
    isClickable: true,
  };

  readonly expenseData: FinancialSummaryData = {
    title: 'Dépensé',
    amount: 7438,
    icon: 'trending_down',
    type: 'expense',
    isClickable: true,
  };

  readonly savingsData: FinancialSummaryData = {
    title: 'Économisé',
    amount: 1234,
    icon: 'attach_money',
    type: 'savings',
    isClickable: true,
  };

  readonly negativeData: FinancialSummaryData = {
    title: 'Négatif',
    amount: 234,
    icon: 'money_off',
    type: 'negative',
    isClickable: true,
  };
}
