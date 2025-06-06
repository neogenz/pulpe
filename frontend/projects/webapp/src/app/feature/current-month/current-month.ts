import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
} from '@angular/core';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import {
  FinancialSummary,
  FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'pulpe-current-month',
  imports: [FinancialSummary],
  template: `
    <h1 class="text-display-small mb-4">Budget du mois courant</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      @if (this.currentMonthBudget.isLoading()) {
        <div class="flex justify-center items-center h-full">
          Chargement du budget...
        </div>
      } @else {
        <pulpe-financial-summary [data]="incomeData()" />
        <pulpe-financial-summary [data]="expenseData()" />
        <pulpe-financial-summary [data]="savingsData()" />
        <pulpe-financial-summary [data]="negativeData()" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCalculator = inject(BudgetCalculator);

  protected currentMonthBudget = resource({
    params: () => {
      const date = new Date();
      const month = format(date, 'MM');
      const year = format(date, 'yyyy');
      return { month, year };
    },
    loader: ({ params }) =>
      firstValueFrom(
        this.#budgetApi.getBudgetForMonth$(params.month, params.year),
      ),
  });

  readonly incomeData = computed<FinancialSummaryData>(() => {
    return {
      title: 'Gagné',
      amount: this.#budgetCalculator.calculateTotalIncome(
        this.currentMonthBudget.value()!,
      ),
      icon: 'trending_up',
      type: 'income',
      isClickable: true,
    };
  });

  readonly expenseData = computed<FinancialSummaryData>(() => {
    return {
      title: 'Dépensé',
      amount: this.#budgetCalculator.calculateTotalExpenses(
        this.currentMonthBudget.value()!,
      ),
      icon: 'trending_down',
      type: 'expense',
      isClickable: true,
    };
  });

  readonly savingsData = computed<FinancialSummaryData>(() => {
    return {
      title: 'Économisé',
      amount: this.#budgetCalculator.calculateTotalSavings(
        this.currentMonthBudget.value()!,
      ),
      icon: 'attach_money',
      type: 'savings',
      isClickable: true,
    };
  });

  readonly negativeData = computed<FinancialSummaryData>(() => {
    return {
      title: 'Négatif',
      amount: this.#budgetCalculator.calculateNegativeBudget(
        this.currentMonthBudget.value()!,
      ),
      icon: 'money_off',
      type: 'negative',
      isClickable: true,
    };
  });
}
