import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import { TransactionApi } from '@core/transaction';
import {
  type Budget,
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
} from '@pulpe/shared';
import { format } from 'date-fns';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  type CurrentMonthState,
  type DashboardData,
} from './current-month-state';
import { createInitialCurrentMonthInternalState } from './current-month-state';

/**
 * CurrentMonthStore - Signal-based state management for current month dashboard
 *
 * This store manages the current month's financial data including:
 * - Budget information and lines
 * - Transactions
 * - Loading and error states
 * - Calculated financial metrics
 *
 * Architecture:
 * - Uses Angular's resource() API for async data loading
 * - Simplified state management without complex optimistic updates
 * - Relies on resource reload for data consistency after mutations
 */
@Injectable()
export class CurrentMonthStore {
  #budgetApi = inject(BudgetApi);
  #transactionApi = inject(TransactionApi);
  #budgetCalculator = inject(BudgetCalculator);

  /**
   * Simple state signal for UI feedback during operations
   */
  readonly #state = signal<CurrentMonthState>(
    createInitialCurrentMonthInternalState(),
  );

  /**
   * Resource for loading dashboard data - single source of truth for async data
   */
  readonly #dashboardResource = resource<
    DashboardData,
    { month: string; year: string }
  >({
    params: () => {
      const currentDate = this.budgetDate();
      return {
        month: format(currentDate, 'MM'),
        year: format(currentDate, 'yyyy'),
      };
    },
    loader: async ({ params }) => this.#loadDashboardData(params),
  });

  /**
   * Dashboard data selector
   */
  readonly dashboardData = computed(() => this.#dashboardResource.value());

  readonly transactions = computed<Transaction[]>(
    () => this.dashboardData()?.transactions || [],
  );

  /**
   * Budget lines selector
   */
  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

  /**
   * Dashboard resource status
   */
  readonly dashboardStatus = computed(() => this.#dashboardResource.status());

  /**
   * Current date selector
   */
  readonly budgetDate = computed(() => this.#state().currentDate);

  /**
   * Total dépensé (expenses + savings) depuis les budget lines ET les transactions
   * INCLUANT le rollover - utilisé pour les calculs internes
   */
  readonly totalSpent = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    return this.#budgetCalculator.calculateTotalSpentIncludingRollover(
      budgetLines,
      transactions,
    );
  });

  /**
   * Total dépensé SANS le rollover
   * Pour affichage dans la barre de progression
   */
  readonly totalSpentWithoutRollover = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    return this.#budgetCalculator.calculateTotalSpentExcludingRollover(
      budgetLines,
      transactions,
    );
  });

  // Montant disponible sur le mois sans compter les dépenses : Total income
  readonly totalAvailable = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    return this.#budgetCalculator.calculateTotalAvailable(
      budgetLines,
      transactions,
    );
  });

  /**
   * Montant disponible AVEC le rollover
   * Disponible = Total Income + Rollover réel
   */
  readonly totalAvailableWithRollover = computed<number>(() => {
    const available = this.totalAvailable();
    const rollover = this.rolloverAmount();
    return available + rollover;
  });

  /**
   * Rollover amount from previous months
   * Si le rollover est une expense, on l'inverse pour obtenir la valeur positive
   * Si le rollover est un income, on le garde tel quel
   */
  readonly rolloverAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    return this.#budgetCalculator.calculateRolloverAmount(budgetLines);
  });

  /**
   * Remaining = Available - Expenses
   * This is the "Restant" shown to users (SPECS terminology)
   */
  readonly remaining = computed<number>(() => {
    const availableWithRollover = this.totalAvailableWithRollover();
    const spentWithoutRollover = this.totalSpentWithoutRollover();
    return availableWithRollover - spentWithoutRollover;
  });

  /**
   * Refresh dashboard data by reloading the resource
   */
  refreshData(): void {
    if (this.dashboardStatus() !== 'loading') {
      this.#dashboardResource.reload();
    }
  }

  /**
   * Update the current date (triggers data reload)
   */
  setCurrentDate(date: Date): void {
    this.#state.update((state) => ({
      ...state,
      currentDate: new Date(date), // Ensure immutability
    }));
  }

  /**
   * Add a new transaction
   * Uses optimistic update with local calculation + backend sync
   */
  async addTransaction(transactionData: TransactionCreate): Promise<void> {
    return this.#performOptimisticUpdate<Transaction>(
      () => this.#transactionApi.create$(transactionData),
      (currentData, response) => {
        if (!response.data) return currentData;
        return {
          ...currentData,
          transactions: [...currentData.transactions, response.data],
        };
      },
    );
  }

  /**
   * Delete a transaction
   * Uses optimistic update with local calculation + backend sync
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    return this.#performOptimisticUpdateDelete(
      () => this.#transactionApi.remove$(transactionId),
      (currentData: DashboardData) => ({
        ...currentData,
        transactions: currentData.transactions.filter(
          (t: Transaction) => t.id !== transactionId,
        ),
      }),
    );
  }

  /**
   * Update a transaction
   * Uses optimistic update with local calculation + backend sync
   */
  async updateTransaction(
    transactionId: string,
    transactionData: TransactionUpdate,
  ): Promise<void> {
    return this.#performOptimisticUpdate<Transaction>(
      () => this.#transactionApi.update$(transactionId, transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: currentData.transactions.map((t: Transaction) =>
          t.id === transactionId ? response.data : t,
        ),
      }),
    );
  }

  /**
   * Generic optimistic update pattern for operations returning data
   */
  async #performOptimisticUpdate<T>(
    operation: () => Observable<{ data: T }>,
    updateData: (
      currentData: DashboardData,
      response: { data: T },
    ) => DashboardData,
  ): Promise<void> {
    const originalData = this.#dashboardResource.value();

    try {
      // 1. Execute backend operation first
      const response = await firstValueFrom(operation());

      // 2. Apply optimistic update
      const currentData = this.#dashboardResource.value();
      if (currentData && currentData.budget) {
        const updatedData = updateData(currentData, response);

        // Recalculate ending balance locally
        const newEndingBalance =
          this.#budgetCalculator.calculateLocalEndingBalance(
            updatedData.budgetLines,
            updatedData.transactions,
          );

        // Apply optimistic update
        this.#dashboardResource.set({
          ...updatedData,
          budget: {
            ...currentData.budget,
            endingBalance: newEndingBalance,
          },
        });

        // 3. Sync with backend for accurate ending balance
        const budgetId = currentData.budget.id;
        const updatedBudget = await firstValueFrom(
          this.#budgetApi.getBudgetById$(budgetId),
        );

        // 4. Update with real backend value
        const latestData = this.#dashboardResource.value();
        if (latestData && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: updatedBudget,
          });
        }
      }
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#dashboardResource.set(originalData);
      } else {
        this.refreshData();
      }
      throw error;
    }
  }

  /**
   * Generic optimistic update pattern for delete operations
   */
  async #performOptimisticUpdateDelete(
    operation: () => Observable<void>,
    updateData: (currentData: DashboardData) => DashboardData,
  ): Promise<void> {
    const originalData = this.#dashboardResource.value();

    try {
      // 1. Execute backend operation first
      await firstValueFrom(operation());

      // 2. Apply optimistic update after successful backend operation
      const currentData = this.#dashboardResource.value();
      if (currentData && currentData.budget) {
        const updatedData = updateData(currentData);

        // Recalculate ending balance locally
        const newEndingBalance =
          this.#budgetCalculator.calculateLocalEndingBalance(
            updatedData.budgetLines,
            updatedData.transactions,
          );

        // Apply optimistic update
        this.#dashboardResource.set({
          ...updatedData,
          budget: {
            ...currentData.budget,
            endingBalance: newEndingBalance,
          },
        });

        // 3. Sync with backend for accurate ending balance
        const budgetId = currentData.budget.id;
        const updatedBudget = await firstValueFrom(
          this.#budgetApi.getBudgetById$(budgetId),
        );

        // 4. Update with real backend value
        const latestData = this.#dashboardResource.value();
        if (latestData && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: updatedBudget,
          });
        }
      }
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#dashboardResource.set(originalData);
      } else {
        this.refreshData();
      }
      throw error;
    }
  }

  /**
   * Load dashboard data from API
   * Note: Uses two sequential calls for now. Could be optimized with a single endpoint.
   */
  async #loadDashboardData(params: {
    month: string;
    year: string;
  }): Promise<DashboardData> {
    // Load budget first to get its ID
    const budget = await firstValueFrom<Budget | null>(
      this.#budgetApi.getBudgetForMonth$(params.month, params.year),
    );

    if (!budget) {
      return { budget: null, transactions: [], budgetLines: [] };
    }

    // Use the budget ID to fetch everything in a single request
    const detailsResponse = await firstValueFrom(
      this.#budgetApi.getBudgetWithDetails$(budget.id),
    );

    return {
      budget: detailsResponse.data.budget,
      transactions: detailsResponse.data.transactions,
      budgetLines: detailsResponse.data.budgetLines,
    };
  }
}
