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

  refreshData(): void {
    if (this.dashboardData.status() !== 'loading') {
      this.dashboardData.reload();
    }
  }

  async addTransaction(
    transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ): Promise<void> {
    this.dashboardData.update((data) => {
      if (!data) return data;
      const optimisticTransaction = {
        ...transaction,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: null,
      };
      return {
        ...data,
        transactions: [optimisticTransaction, ...data.transactions],
      };
    });

    try {
      const response = await firstValueFrom(
        this.#transactionApi.create$(transaction),
      );

      this.dashboardData.update((data) => {
        if (!data || !response.data) return data;
        return {
          ...data,
          transactions: data.transactions.map((t) =>
            t.id.startsWith('temp-') ? response.data : t,
          ),
        };
      });
    } catch (error) {
      this.dashboardData.update((data) => {
        if (!data) return data;
        return {
          ...data,
          transactions: data.transactions.filter(
            (t) => !t.id.startsWith('temp-'),
          ),
        };
      });
      throw error;
    }
  }

  #currentDate = computed(() => {
    const now = this.today();
    return {
      month: format(now, 'MM'),
      year: format(now, 'yyyy'),
    };
  });
  #transactions = computed(
    () => this.dashboardData.value()?.transactions || [],
  );

  incomeAmount = computed(() => {
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateTotalIncome(transactions);
  });

  expenseAmount = computed(() => {
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateTotalExpenses(transactions);
  });

  savingsAmount = computed(() => {
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateTotalSavings(transactions);
  });

  negativeAmount = computed(() => {
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateNegativeBudget(transactions);
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
