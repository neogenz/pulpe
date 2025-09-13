import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi } from '@core/budget';
import { TransactionApi } from '@core/transaction';
import { createRolloverLine } from '@core/rollover/rollover-types';
import {
  type Budget,
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  BudgetFormulas,
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
   * Budget lines selector - raw data from API
   */
  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

  /**
   * Budget lines for display - includes virtual rollover line when applicable
   * Transforms rollover from Budget into a display line for UI consistency
   */
  readonly displayBudgetLines = computed<BudgetLine[]>(() => {
    const lines = [...this.budgetLines()];
    const rollover = this.rolloverAmount();
    const budget = this.dashboardData()?.budget;

    // Add virtual rollover line for display if rollover exists
    if (rollover !== 0 && budget) {
      const rolloverLine = createRolloverLine({
        budgetId: budget.id,
        amount: rollover,
        month: budget.month,
        year: budget.year,
        previousBudgetId: budget.previousBudgetId,
      });

      // Add rollover at the beginning of the list
      lines.unshift(rolloverLine);
    }

    return lines;
  });

  /**
   * Dashboard resource status
   */
  readonly dashboardStatus = computed(() => this.#dashboardResource.status());

  /**
   * Current date selector
   */
  readonly budgetDate = computed(() => this.#state().currentDate);

  /**
   * Rollover amount depuis le Budget (plus de calcul depuis BudgetLines)
   */
  readonly rolloverAmount = computed<number>(() => {
    const budget = this.dashboardData()?.budget;
    return budget?.rollover || 0;
  });

  /**
   * Total des revenus (budget lines + transactions)
   */
  readonly totalIncome = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    return BudgetFormulas.calculateTotalIncome(budgetLines, transactions);
  });

  /**
   * Total dépensé (expenses + savings) depuis les budget lines ET transactions
   * Utilise les formules partagées
   */
  readonly totalExpenses = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    return BudgetFormulas.calculateTotalExpenses(budgetLines, transactions);
  });

  /**
   * Montant total disponible = revenu + rollover (formule SPECS)
   */
  readonly totalAvailable = computed<number>(() => {
    const totalIncome = this.totalIncome();
    const rollover = this.rolloverAmount();
    return BudgetFormulas.calculateAvailable(totalIncome, rollover);
  });

  /**
   * Montant restant à dépenser (ending balance)
   */
  readonly remaining = computed<number>(() => {
    const available = this.totalAvailable();
    const expenses = this.totalExpenses();
    return BudgetFormulas.calculateRemaining(available, expenses);
  });

  /**
   * Progression en pourcentage selon formules SPECS
   */
  readonly progress = computed<number>(() => {
    const expenses = this.totalExpenses();
    const available = this.totalAvailable();
    return BudgetFormulas.calculateProgress(expenses, available);
  });

  /**
   * @deprecated Utilise totalExpenses à la place
   */
  readonly totalSpent = computed<number>(() => this.totalExpenses());

  /**
   * @deprecated Utilise totalAvailable à la place
   */
  readonly totalAvailableWithRollover = computed<number>(() =>
    this.totalAvailable(),
  );

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

        // Recalculate ending balance locally avec les formules partagées
        const rollover = updatedData.budget?.rollover || 0;
        const metrics = BudgetFormulas.calculateAllMetrics(
          updatedData.budgetLines,
          updatedData.transactions,
          rollover,
        );
        const newEndingBalance = metrics.endingBalance;

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
        if (latestData && latestData.budget && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: {
              ...updatedBudget,
              rollover: latestData.budget.rollover, // Préserver le rollover existant
              previousBudgetId: latestData.budget.previousBudgetId, // Préserver aussi
            },
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

        // Recalculate ending balance locally avec les formules partagées
        const rollover = updatedData.budget?.rollover || 0;
        const metrics = BudgetFormulas.calculateAllMetrics(
          updatedData.budgetLines,
          updatedData.transactions,
          rollover,
        );
        const newEndingBalance = metrics.endingBalance;

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
        if (latestData && latestData.budget && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: {
              ...updatedBudget,
              rollover: latestData.budget.rollover, // Préserver le rollover existant
              previousBudgetId: latestData.budget.previousBudgetId, // Préserver aussi
            },
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
