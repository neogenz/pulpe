import {
  computed,
  inject,
  Injectable,
  resource,
  signal,
  effect,
} from '@angular/core';
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
} from './current-month-state.interface';

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
   * Single source of truth for all current month state
   */
  #state = signal<CurrentMonthState>({
    dashboardData: null,
    isLoading: false,
    error: null,
    currentDate: new Date(),
    operationsInProgress: new Set<string>(),
  });

  /**
   * Resource for loading dashboard data - encapsulated within state
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

  // === EFFECTS ===
  /**
   * Effect to sync resource state with internal state
   */
  constructor() {
    effect(() => {
      const resourceValue = this.#dashboardResource.value();
      const resourceStatus = this.#dashboardResource.status();
      const resourceError = this.#dashboardResource.error();

      this.#updateState((currentState) => ({
        ...currentState,
        dashboardData: resourceValue || null,
        isLoading: resourceStatus === 'loading',
        error: resourceError || null,
      }));
    });
  }

  // === PUBLIC SELECTORS ===
  /**
   * Current state (read-only)
   */
  readonly state = this.#state.asReadonly();

  /**
   * Dashboard data selector
   */
  readonly dashboardData = computed(() => this.#state().dashboardData);

  /**
   * Loading state selector
   */
  readonly isLoading = computed(() => this.#state().isLoading);

  /**
   * Error state selector
   */
  readonly error = computed(() => this.#state().error);

  /**
   * Current date selector
   */
  readonly today = computed(() => this.#state().currentDate);

  /**
   * Budget lines selector
   */
  readonly budgetLines = computed<BudgetLine[]>(
    () => this.#state().dashboardData?.budgetLines || [],
  );

  /**
   * Transactions selector (private computed)
   */
  #transactions = computed<Transaction[]>(
    () => this.#state().dashboardData?.transactions || [],
  );

  /**
   * Current budget selector
   */
  readonly budget = computed<Budget | null>(
    () => this.#state().dashboardData?.budget || null,
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
    if (this.#dashboardResource.status() !== 'loading') {
      this.#dashboardResource.reload();
    }
  }

  /**
   * Update the current date (triggers data reload)
   */
  setCurrentDate(date: Date): void {
    this.#updateState((currentState) => ({
      ...currentState,
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

    this.#updateState((currentState) => {
      if (!currentState.dashboardData) return currentState;

      return {
        ...currentState,
        dashboardData: {
          ...currentState.dashboardData,
          transactions: [
            optimisticTransaction,
            ...currentState.dashboardData.transactions,
          ],
        },
      };
    });

    try {
      const response = await firstValueFrom(
        this.#transactionApi.create$(transactionData),
      );

      // Replace optimistic transaction with real one
      this.#updateState((currentState) => {
        if (!currentState.dashboardData || !response.data) return currentState;

        return {
          ...currentState,
          dashboardData: {
            ...currentState.dashboardData,
            transactions: currentState.dashboardData.transactions.map((t) =>
              t.id.startsWith('temp-') ? response.data : t,
            ),
          },
        };
      });
    } catch (error) {
      // Rollback: remove optimistic transaction
      this.#updateState((currentState) => {
        if (!currentState.dashboardData) return currentState;

        return {
          ...currentState,
          dashboardData: {
            ...currentState.dashboardData,
            transactions: currentState.dashboardData.transactions.filter(
              (t) => !t.id.startsWith('temp-'),
            ),
          },
          error: error as Error,
        };
      });
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
    const currentData = this.#state().dashboardData;
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
    this.#updateState((currentState) => {
      if (!currentState.dashboardData) return currentState;

      return {
        ...currentState,
        dashboardData: {
          ...currentState.dashboardData,
          transactions: currentState.dashboardData.transactions.filter(
            (t) => t.id !== transactionId,
          ),
        },
      };
    });

    try {
      await firstValueFrom(this.#transactionApi.remove$(transactionId));
      // Success: optimistic update stands
    } catch (error) {
      // Rollback: restore deleted transaction
      this.#updateState((currentState) => {
        if (!currentState.dashboardData) return currentState;

        return {
          ...currentState,
          dashboardData: {
            ...currentState.dashboardData,
            transactions: [
              ...currentState.dashboardData.transactions,
              transactionToDelete,
            ],
          },
          error: error as Error,
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
    this.#updateState((currentState) => ({
      ...currentState,
      error: null,
    }));
  }

  // === PRIVATE HELPERS ===
  /**
   * Immutable state update helper
   */
  #updateState(
    updater: (currentState: CurrentMonthState) => CurrentMonthState,
  ): void {
    this.#state.update(updater);
  }

  /**
   * Add operation to progress tracking
   */
  #addOperationInProgress(operationId: string): void {
    this.#updateState((currentState) => ({
      ...currentState,
      operationsInProgress: new Set([
        ...currentState.operationsInProgress,
        operationId,
      ]),
    }));
  }

  /**
   * Remove operation from progress tracking
   */
  #removeOperationInProgress(operationId: string): void {
    this.#updateState((currentState) => {
      const newOperationsInProgress = new Set(
        currentState.operationsInProgress,
      );
      newOperationsInProgress.delete(operationId);

      return {
        ...currentState,
        operationsInProgress: newOperationsInProgress,
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
      console.error('Error loading dashboard data:', error);
      throw error;
    }
  }
}
