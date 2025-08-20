import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi } from '@core/budget';
import { BudgetCalculator } from './budget-calculator';
import { TransactionApi } from '@core/transaction';
import { Logger } from '@core/logging/logger';
import { type Budget, type BudgetLine } from '@pulpe/shared';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import {
  type CurrentMonthInternalState,
  type DashboardData,
  type TransactionCreateData,
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
  #logger = inject(Logger);

  // === PRIVATE STATE ===
  /**
   * Simple state signal for UI feedback during operations
   */
  readonly #state = signal<CurrentMonthInternalState>(
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
      const currentDate = this.#state().currentDate;
      return {
        month: format(currentDate, 'MM'),
        year: format(currentDate, 'yyyy'),
      };
    },
    loader: async ({ params }) => this.#loadDashboardData(params),
  });

  // === PUBLIC SELECTORS ===
  /**
   * Dashboard data selector
   */
  readonly dashboardData = computed(() => this.#dashboardResource.value());

  /**
   * Dashboard resource status
   */
  readonly dashboardStatus = computed(() => this.#dashboardResource.status());

  /**
   * Current date selector
   */
  readonly budgetDate = computed(() => this.#state().currentDate);

  /**
   * Budget lines selector
   */
  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

  // === FINANCIAL CALCULATIONS ===

  /**
   * Living allowance amount (available to spend)
   */
  readonly livingAllowanceAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    return this.#budgetCalculator.calculateLivingAllowance(budgetLines);
  });

  /**
   * Actual transactions amount (spent so far)
   */
  readonly actualTransactionsAmount = computed<number>(() => {
    const transactions = this.dashboardData()?.transactions || [];
    return this.#budgetCalculator.calculateActualTransactionsAmount(
      transactions,
    );
  });

  // === PUBLIC ACTIONS ===
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
   * Optimized approach: use optimistic update to avoid full data reload
   */
  async addTransaction(transactionData: TransactionCreateData): Promise<void> {
    try {
      // Create the transaction
      const response = await firstValueFrom(
        this.#transactionApi.create$(transactionData),
      );

      // Optimistically update the resource value to include the new transaction
      const currentData = this.#dashboardResource.value();
      if (currentData && response.data) {
        this.#dashboardResource.set({
          ...currentData,
          transactions: [...currentData.transactions, response.data],
        });
      }

      this.#logger.info(
        'Transaction added successfully with optimistic update',
      );
    } catch (error) {
      this.#logger.error('Error adding transaction:', error);

      // On error, reload data to ensure consistency
      this.refreshData();
      throw error;
    }
  }

  /**
   * Delete a transaction
   * Optimized approach: use optimistic update to avoid full data reload
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    // Store original state for rollback on error
    const originalData = this.#dashboardResource.value();

    try {
      // Optimistically remove the transaction from the UI immediately
      const currentData = this.#dashboardResource.value();
      if (currentData) {
        this.#dashboardResource.set({
          ...currentData,
          transactions: currentData.transactions.filter(
            (t) => t.id !== transactionId,
          ),
        });
      }

      // Delete the transaction from the backend
      await firstValueFrom(this.#transactionApi.remove$(transactionId));

      this.#logger.info(
        'Transaction deleted successfully with optimistic update',
      );
    } catch (error) {
      this.#logger.error('Error deleting transaction:', error);

      // Rollback to original state on error
      if (originalData) {
        this.#dashboardResource.set(originalData);
      } else {
        // If no original data, reload to ensure consistency
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
    try {
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
    } catch (error) {
      this.#logger.error('Error loading dashboard data:', error);
      throw error;
    }
  }
}
