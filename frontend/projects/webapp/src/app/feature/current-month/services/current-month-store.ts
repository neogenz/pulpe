import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi } from '@core/budget';
import { BudgetCalculator } from './budget-calculator';
import { TransactionApi } from '@core/transaction';
import { type Budget, type Transaction, type BudgetLine } from '@pulpe/shared';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import {
  CurrentMonthState,
  DashboardData,
  TransactionCreateData,
} from './current-month-state';

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

  // === PRIVATE STATE ===
  /**
   * State for data not managed by resource
   */
  #currentDate = signal<Date>(new Date());
  #operationsInProgress = signal<Set<string>>(new Set());

  /**
   * Optimistic updates state - overlays on top of resource data
   */
  #optimisticUpdates = signal<{
    addedTransactions: Transaction[];
    removedTransactionIds: Set<string>;
  }>({
    addedTransactions: [],
    removedTransactionIds: new Set(),
  });

  /**
   * Resource for loading dashboard data - single source of truth for async data
   */
  #dashboardResource = resource<DashboardData, { month: string; year: string }>(
    {
      params: () => {
        const currentDate = this.#currentDate();
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
   * Current state (read-only) - for backward compatibility
   */
  readonly state = computed<CurrentMonthState>(() => ({
    dashboardData: this.#dashboardResource.value() || null,
    isLoading: this.#dashboardResource.isLoading(),
    error: this.#dashboardResource.error() || null,
    currentDate: this.#currentDate(),
    operationsInProgress: this.#operationsInProgress(),
  }));

  /**
   * Dashboard data selector - directly from resource
   */
  readonly dashboardData = computed(
    () => this.#dashboardResource.value() || null,
  );

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
  readonly today = computed(() => this.#currentDate());

  /**
   * Budget lines selector
   */
  readonly budgetLines = computed<BudgetLine[]>(
    () => this.#dashboardResource.value()?.budgetLines || [],
  );

  /**
   * Transactions selector (private computed) - includes optimistic updates
   */
  #transactions = computed<Transaction[]>(() => {
    const resourceTransactions =
      this.#dashboardResource.value()?.transactions || [];
    const { addedTransactions, removedTransactionIds } =
      this.#optimisticUpdates();

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
    () => this.#dashboardResource.value()?.budget || null,
  );

  /**
   * Operations in progress selector
   */
  readonly operationsInProgress = computed(() => this.#operationsInProgress());

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
    if (this.#dashboardResource.status() !== 'loading') {
      this.#dashboardResource.reload();
    }
  }

  /**
   * Update the current date (triggers data reload)
   */
  setCurrentDate(date: Date): void {
    this.#currentDate.set(new Date(date)); // Ensure immutability
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
    this.#optimisticUpdates.update((state) => ({
      ...state,
      addedTransactions: [optimisticTransaction, ...state.addedTransactions],
    }));

    try {
      const response = await firstValueFrom(
        this.#transactionApi.create$(transactionData),
      );

      // Replace optimistic transaction with real one
      if (response.data) {
        this.#optimisticUpdates.update((state) => ({
          ...state,
          addedTransactions: state.addedTransactions.map((t) =>
            t.id.startsWith('temp-') ? response.data : t,
          ),
        }));
      }
    } catch (error) {
      // Rollback: remove optimistic transaction
      this.#optimisticUpdates.update((state) => ({
        ...state,
        addedTransactions: state.addedTransactions.filter(
          (t) => !t.id.startsWith('temp-'),
        ),
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

    // Get current state for potential rollback
    const currentData = this.#dashboardResource.value();
    if (!currentData) {
      this.#removeOperationInProgress(operationId);
      throw new Error('No data available');
    }

    const transactionToDelete = currentData.transactions.find(
      (t) => t.id === transactionId,
    );
    if (!transactionToDelete) {
      this.#removeOperationInProgress(operationId);
      throw new Error('Transaction not found');
    }

    // Optimistic update: remove transaction immediately
    this.#optimisticUpdates.update((state) => ({
      ...state,
      removedTransactionIds: new Set([
        ...state.removedTransactionIds,
        transactionId,
      ]),
    }));

    try {
      await firstValueFrom(this.#transactionApi.remove$(transactionId));
      // Success: optimistic update stands
    } catch (error) {
      // Rollback: restore deleted transaction
      this.#optimisticUpdates.update((state) => {
        const newRemovedIds = new Set(state.removedTransactionIds);
        newRemovedIds.delete(transactionId);
        return {
          ...state,
          removedTransactionIds: newRemovedIds,
        };
      });
      throw error;
    } finally {
      this.#removeOperationInProgress(operationId);
    }
  }

  /**
   * Clear any error state
   */
  clearError(): void {
    // Note: Resource errors are read-only, this method is kept for backward compatibility
    // In the future, consider removing this method as resource errors clear on retry
  }

  // === PRIVATE HELPERS ===
  /**
   * Add operation to progress tracking
   */
  #addOperationInProgress(operationId: string): void {
    this.#operationsInProgress.update((ops) => new Set([...ops, operationId]));
  }

  /**
   * Remove operation from progress tracking
   */
  #removeOperationInProgress(operationId: string): void {
    this.#operationsInProgress.update((ops) => {
      const newOps = new Set(ops);
      newOps.delete(operationId);
      return newOps;
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
      console.error('Error loading dashboard data:', error);
      throw error;
    }
  }
}
