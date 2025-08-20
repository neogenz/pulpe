import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  FinancialSummary,
  type FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';

@Component({
  selector: 'pulpe-financial-overview',
  imports: [FinancialSummary],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
      <pulpe-financial-summary [data]="incomeData()" />
      <pulpe-financial-summary [data]="expenseData()" />
      <pulpe-financial-summary [data]="savingsData()" />
      <pulpe-financial-summary [data]="negativeData()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialOverview {
  incomeAmount = input.required<number>();
  expenseAmount = input.required<number>();
  savingsAmount = input.required<number>();
  negativeAmount = input.required<number>();

  incomeData = computed<FinancialSummaryData>(() => ({
    title: 'Revenus',
    amount: this.incomeAmount(),
    icon: 'trending_up',
    type: 'income',
    isClickable: false,
  }));

  expenseData = computed<FinancialSummaryData>(() => ({
    title: 'Dépenses',
    amount: this.expenseAmount(),
    icon: 'trending_down',
    type: 'expense',
  }));

  savingsData = computed<FinancialSummaryData>(() => ({
    title: 'Économies',
    amount: this.savingsAmount(),
    icon: 'savings',
    type: 'savings',
  }));

  negativeData = computed<FinancialSummaryData>(() => ({
    title: 'Déficit',
    amount: this.negativeAmount(),
    icon: 'money_off',
    type: 'negative',
  }));
}
