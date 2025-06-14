import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import { TransactionApi } from '@core/transaction';
import { type Budget, type Transaction } from '@pulpe/shared';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';

interface DashboardData {
  budget: Budget | null;
  transactions: Transaction[];
}

@Injectable()
export class CurrentMonthState {
  #budgetApi = inject(BudgetApi);
  #transactionApi = inject(TransactionApi);
  #budgetCalculator = inject(BudgetCalculator);

  dashboardData = resource<DashboardData, { month: string; year: string }>({
    params: () => ({
      month: this.#currentDate().month,
      year: this.#currentDate().year,
    }),
    loader: async ({ params }) => this.#loadDashboardData(params),
  });

  today = signal<Date>(new Date());
  
  #currentDate = computed(() => {
    const now = new Date();
    return {
      month: format(now, 'MM'),
      year: format(now, 'yyyy'),
    };
  });
  #budget = computed(() => this.dashboardData.value()?.budget || null);
  #transactions = computed(
    () => this.dashboardData.value()?.transactions || [],
  );

  incomeAmount = computed(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    if (!budget) return 0;

    return this.#budgetCalculator.calculateTotalIncome(budget, transactions);
  });

  expenseAmount = computed(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    if (!budget) return 0;
    return this.#budgetCalculator.calculateTotalExpenses(budget, transactions);
  });

  savingsAmount = computed(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    if (!budget) return 0;
    return this.#budgetCalculator.calculateTotalSavings(budget, transactions);
  });

  negativeAmount = computed(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    if (!budget) return 0;
    return this.#budgetCalculator.calculateNegativeBudget(budget, transactions);
  });

  async #loadDashboardData(params: {
    month: string;
    year: string;
  }): Promise<DashboardData> {
    try {
      // Charger le budget
      const budget = await firstValueFrom<Budget | null>(
        this.#budgetApi.getBudgetForMonth$(params.month, params.year),
      );

      if (!budget) {
        return { budget: null, transactions: [] };
      }

      // Charger les transactions si un budget existe
      const transactionResponse = await firstValueFrom(
        this.#transactionApi.findByBudget$(budget.id),
      );

      return {
        budget,
        transactions: Array.isArray(transactionResponse.data)
          ? transactionResponse.data
          : [],
      };
    } catch (error) {
      // Logger l'erreur pour le monitoring
      console.error('Erreur lors du chargement du dashboard:', error);
      throw error;
    }
  }
}
