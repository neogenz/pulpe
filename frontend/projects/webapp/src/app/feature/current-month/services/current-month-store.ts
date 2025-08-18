import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi } from '@core/budget';
import { BudgetCalculator } from './budget-calculator';
import { TransactionApi } from '@core/transaction';
import { Logger } from '@core/logging/logger';
import { type Budget, type Transaction, type BudgetLine } from '@pulpe/shared';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import {
  CurrentMonthInternalState,
  DashboardData,
  TransactionCreateData,
} from './current-month-state';
import { createInitialCurrentMonthInternalState } from './current-month-state';

/**
 * CurrentMonthStore - Signal-based state management for current month dashboard
 *
 * This store manages the current month's financial data including:
 * - Budget information and lines
 * - Transactions (with optimistic updates)
 * - Loading and error states
 * - Calculated financial metrics
 *
 * Architecture:
 * - Single private state signal for immutable state management
 * - Public computed selectors for reactive data access
 * - Actions for state mutations with strict immutability
 * - Resource integration for async data loading
 */
@Injectable()
export class CurrentMonthStore {
  #budgetApi = inject(BudgetApi);
  #transactionApi = inject(TransactionApi);
  #budgetCalculator = inject(BudgetCalculator);
  #logger = inject(Logger);

  // === PRIVATE STATE ===
  /**
   * Single source of truth - private state signal for non-resource data
   */
  readonly #state = signal<CurrentMonthInternalState>(
    createInitialCurrentMonthInternalState(),
  );

  /**
   * Resource for loading dashboard data - single source of truth for async data
   */
  #dashboardResource = resource<DashboardData, { month: string; year: string }>(
    {
      params: () => {
        const currentDate = this.#state().currentDate;
        return {
          month: format(currentDate, 'MM'),
          year: format(currentDate, 'yyyy'),
        };
      },
      loader: async ({ params }) => this.#loadDashboardData(params),
    },
  );

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
   * Dashboard reload function
   */
  readonly reloadDashboard = () => this.#dashboardResource.reload();

  /**
   * Loading state selector - directly from resource
   */
  readonly isLoading = computed(() => this.#dashboardResource.isLoading());

  /**
   * Error state selector - directly from resource
   */
  readonly error = computed(() => this.#dashboardResource.error() || null);

  /**
   * Current date selector
   */
  readonly today = computed(() => this.#state().currentDate);

  /**
   * Budget lines selector
   */
  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

  /**
   * Transactions selector (private computed) - includes optimistic updates
   */
  #transactions = computed<Transaction[]>(() => {
    const resourceTransactions = this.dashboardData()?.transactions || [];
    const { addedTransactions, removedTransactionIds } =
      this.#state().optimisticUpdates;

    // Filter out removed transactions and add optimistic ones
    const filteredTransactions = resourceTransactions.filter(
      (t) => !removedTransactionIds.has(t.id),
    );

    return [...addedTransactions, ...filteredTransactions];
  });

  /**
   * Current budget selector
   */
  readonly budget = computed<Budget | null>(
    () => this.dashboardData()?.budget || null,
  );

  /**
   * Operations in progress selector
   */
  readonly operationsInProgress = computed(
    () => this.#state().operationsInProgress,
  );

  // === FINANCIAL CALCULATIONS ===
  /**
   * Planned income amount (from budget lines)
   */
  readonly plannedIncomeAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    return this.#budgetCalculator.calculatePlannedIncome(budgetLines);
  });

  /**
   * Fixed block amount (planned expenses + savings)
   */
  readonly fixedBlockAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    return this.#budgetCalculator.calculateFixedBlock(budgetLines);
  });

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
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateActualTransactionsAmount(
      transactions,
    );
  });

  /**
   * Remaining budget amount (living allowance - spent)
   */
  readonly remainingBudgetAmount = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.#transactions();
    return this.#budgetCalculator.calculateRemainingBudget(
      budgetLines,
      transactions,
    );
  });

  // === PUBLIC ACTIONS ===
  /**
   * Refresh dashboard data by reloading the resource
   */
  refreshData(): void {
    if (this.dashboardStatus() !== 'loading') {
      this.reloadDashboard();
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
   * Add a new transaction with optimistic updates
   */
  async addTransaction(transactionData: TransactionCreateData): Promise<void> {
    const operationId = `add-transaction-${Date.now()}`;

    // Mark operation as in progress
    this.#addOperationInProgress(operationId);

    // Optimistic update: add temporary transaction
    const optimisticTransaction: Transaction = {
      ...transactionData,
      id: `temp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to optimistic updates
    this.#state.update((state) => ({
      ...state,
      optimisticUpdates: {
        ...state.optimisticUpdates,
        addedTransactions: [
          optimisticTransaction,
          ...state.optimisticUpdates.addedTransactions,
        ],
      },
    }));

    try {
      const response = await firstValueFrom(
        this.#transactionApi.create$(transactionData),
      );

      // Replace optimistic transaction with real one
      if (response.data) {
        this.#state.update((state) => ({
          ...state,
          optimisticUpdates: {
            ...state.optimisticUpdates,
            addedTransactions: state.optimisticUpdates.addedTransactions.map(
              (t) => (t.id.startsWith('temp-') ? response.data : t),
            ),
          },
        }));
      }
    } catch (error) {
      // Rollback: remove optimistic transaction
      this.#state.update((state) => ({
        ...state,
        optimisticUpdates: {
          ...state.optimisticUpdates,
          addedTransactions: state.optimisticUpdates.addedTransactions.filter(
            (t) => !t.id.startsWith('temp-'),
          ),
        },
      }));
      throw error;
    } finally {
      this.#removeOperationInProgress(operationId);
    }
  }

  /**
   * Delete a transaction with optimistic updates
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    const operationId = `delete-transaction-${transactionId}`;

    // Mark operation as in progress
    this.#addOperationInProgress(operationId);

    // Optimistic update: remove transaction immediately
    this.#state.update((state) => ({
      ...state,
      optimisticUpdates: {
        ...state.optimisticUpdates,
        removedTransactionIds: new Set([
          ...state.optimisticUpdates.removedTransactionIds,
          transactionId,
        ]),
      },
    }));

    try {
      await firstValueFrom(this.#transactionApi.remove$(transactionId));
      // Success: optimistic update stands
    } catch (error) {
      // Rollback: restore deleted transaction
      this.#state.update((state) => {
        const newRemovedIds = new Set(
          state.optimisticUpdates.removedTransactionIds,
        );
        newRemovedIds.delete(transactionId);
        return {
          ...state,
          optimisticUpdates: {
            ...state.optimisticUpdates,
            removedTransactionIds: newRemovedIds,
          },
        };
      });
      throw error;
    } finally {
      this.#removeOperationInProgress(operationId);
    }
  }

  // === PRIVATE HELPERS ===
  /**
   * Add operation to progress tracking
   */
  #addOperationInProgress(operationId: string): void {
    this.#state.update((state) => ({
      ...state,
      operationsInProgress: new Set([
        ...state.operationsInProgress,
        operationId,
      ]),
    }));
  }

  /**
   * Remove operation from progress tracking
   */
  #removeOperationInProgress(operationId: string): void {
    this.#state.update((state) => {
      const newOps = new Set(state.operationsInProgress);
      newOps.delete(operationId);
      return {
        ...state,
        operationsInProgress: newOps,
      };
    });
  }

  /**
   * Load dashboard data from API
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

      // Use the new endpoint to fetch everything in a single request
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
