import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi } from '@core/budget';
import { BudgetCalculator } from './budget-calculator';
import { TransactionApi } from '@core/transaction';
import { type Budget, type Transaction, type BudgetLine } from '@pulpe/shared';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';

interface DashboardData {
  budget: Budget | null;
  transactions: Transaction[];
  budgetLines: BudgetLine[];
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
        userId: undefined,
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

  async deleteTransactions(transactionIds: string[]): Promise<void> {
    // Save current transactions for rollback
    const currentData = this.dashboardData.value();
    if (!currentData) {
      throw new Error('No data available');
    }

    const transactionsToDelete = currentData.transactions.filter((t) =>
      transactionIds.includes(t.id),
    );

    // Optimistic update: remove transactions from UI immediately
    this.dashboardData.update((data) => {
      if (!data) return data;
      return {
        ...data,
        transactions: data.transactions.filter(
          (t) => !transactionIds.includes(t.id),
        ),
      };
    });

    try {
      // Delete all transactions sequentially
      // Using Promise.all could overwhelm the backend, so we process them one by one
      for (const id of transactionIds) {
        await firstValueFrom(this.#transactionApi.remove$(id));
      }

      // If all deletions succeed, the optimistic update stands
    } catch (error) {
      // Rollback on error: restore the deleted transactions
      this.dashboardData.update((data) => {
        if (!data) return data;
        return {
          ...data,
          transactions: [...data.transactions, ...transactionsToDelete],
        };
      });
      throw error;
    }
  }

  #currentDate = computed<{ month: string; year: string }>(() => {
    const now = this.today();
    return {
      month: format(now, 'MM'),
      year: format(now, 'yyyy'),
    };
  });
  #transactions = computed<Transaction[]>(
    () => this.dashboardData.value()?.transactions || [],
  );

  budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData.value()?.budgetLines || [],
  );

  // Calculs basés sur les budget lines (planifié)
  plannedIncomeAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    return this.#budgetCalculator.calculatePlannedIncome(budgetLines);
  });

  fixedBlockAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    return this.#budgetCalculator.calculateFixedBlock(budgetLines);
  });

  livingAllowanceAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    return this.#budgetCalculator.calculateLivingAllowance(budgetLines);
  });

  // Calculs basés sur les transactions réelles
  actualTransactionsAmount = computed<number>(() => {
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateActualTransactionsAmount(
      transactions,
    );
  });

  remainingBudgetAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateRemainingBudget(
      budgetLines,
      transactions,
    );
  });

  async #loadDashboardData(params: {
    month: string;
    year: string;
  }): Promise<DashboardData> {
    try {
      // Charger d'abord le budget pour obtenir son ID
      const budget = await firstValueFrom<Budget | null>(
        this.#budgetApi.getBudgetForMonth$(params.month, params.year),
      );

      if (!budget) {
        return { budget: null, transactions: [], budgetLines: [] };
      }

      // Utiliser le nouvel endpoint pour récupérer tout en une seule requête
      const detailsResponse = await firstValueFrom(
        this.#budgetApi.getBudgetWithDetails$(budget.id),
      );

      return {
        budget: detailsResponse.data.budget,
        transactions: detailsResponse.data.transactions,
        budgetLines: detailsResponse.data.budgetLines,
      };
    } catch (error) {
      // Logger l'erreur pour le monitoring
      console.error('Erreur lors du chargement du dashboard:', error);
      throw error;
    }
  }
}
