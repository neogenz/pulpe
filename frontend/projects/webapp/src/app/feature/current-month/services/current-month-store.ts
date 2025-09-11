import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import { TransactionApi } from '@core/transaction';
import { Logger } from '@core/logging/logger';
import {
  type Budget,
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
} from '@pulpe/shared';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';
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
  #logger = inject(Logger);

  // === PRIVATE STATE ===
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

  // === FINANCIAL CALCULATIONS ===

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
   * Available to Spend = Disponible - Dépenses
   * This is the "Restant" shown to users
   */
  readonly availableToSpend = linkedSignal<number>(() => {
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
    try {
      // 1. Créer la transaction sur le backend d'abord pour obtenir l'ID
      const response = await firstValueFrom(
        this.#transactionApi.create$(transactionData),
      );

      // 2. Optimistic update avec recalcul local du ending balance
      const currentData = this.#dashboardResource.value();
      if (currentData && response.data && currentData.budget) {
        // Ajouter la nouvelle transaction
        const updatedTransactions = [
          ...currentData.transactions,
          response.data,
        ];

        // Recalculer le ending balance localement
        const newEndingBalance =
          this.#budgetCalculator.calculateLocalEndingBalance(
            currentData.budgetLines,
            updatedTransactions,
          );

        // Appliquer l'optimistic update avec le budget complet
        this.#dashboardResource.set({
          ...currentData,
          transactions: updatedTransactions,
          budget: {
            ...currentData.budget,
            endingBalance: newEndingBalance,
          },
        });

        // 3. Récupérer le budget mis à jour depuis le backend pour avoir le vrai ending balance
        const budgetId = currentData.budget?.id;
        if (budgetId) {
          const updatedBudget = await firstValueFrom(
            this.#budgetApi.getBudgetById$(budgetId),
          );

          // 4. Mettre à jour avec la vraie valeur du backend
          const latestData = this.#dashboardResource.value();
          if (latestData && updatedBudget) {
            this.#dashboardResource.set({
              ...latestData,
              budget: updatedBudget,
            });
          }
        }
      }

      this.#logger.info(
        'Transaction added successfully with optimistic update and backend sync',
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
   * Uses optimistic update with local calculation + backend sync
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    // Store original state for rollback on error
    const originalData = this.#dashboardResource.value();

    try {
      // 1. Optimistic update avec recalcul local du ending balance
      const currentData = this.#dashboardResource.value();
      if (currentData && currentData.budget) {
        // Supprimer la transaction localement
        const updatedTransactions = currentData.transactions.filter(
          (t) => t.id !== transactionId,
        );

        // Recalculer le ending balance localement
        const newEndingBalance =
          this.#budgetCalculator.calculateLocalEndingBalance(
            currentData.budgetLines,
            updatedTransactions,
          );

        // Appliquer l'optimistic update avec le budget complet
        this.#dashboardResource.set({
          ...currentData,
          transactions: updatedTransactions,
          budget: {
            ...currentData.budget,
            endingBalance: newEndingBalance,
          },
        });
      }

      // 2. Supprimer la transaction sur le backend
      await firstValueFrom(this.#transactionApi.remove$(transactionId));

      // 3. Récupérer le budget mis à jour depuis le backend pour avoir le vrai ending balance
      const budgetId = this.#dashboardResource.value()?.budget?.id;
      if (budgetId) {
        const updatedBudget = await firstValueFrom(
          this.#budgetApi.getBudgetById$(budgetId),
        );

        // 4. Mettre à jour avec la vraie valeur du backend
        const latestData = this.#dashboardResource.value();
        if (latestData && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: updatedBudget,
          });
        }
      }

      this.#logger.info(
        'Transaction deleted successfully with optimistic update and backend sync',
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
   * Update a transaction
   * Uses optimistic update with local calculation + backend sync
   */
  async updateTransaction(
    transactionId: string,
    transactionData: TransactionUpdate,
  ): Promise<void> {
    // Store original state for rollback on error
    const originalData = this.#dashboardResource.value();

    try {
      // 1. Optimistic update avec recalcul local du ending balance
      const currentData = this.#dashboardResource.value();
      if (currentData && currentData.budget) {
        // Mettre à jour la transaction localement
        const updatedTransactions = currentData.transactions.map((t) =>
          t.id === transactionId ? { ...t, ...transactionData } : t,
        );

        // Recalculer le ending balance localement
        const newEndingBalance =
          this.#budgetCalculator.calculateLocalEndingBalance(
            currentData.budgetLines,
            updatedTransactions,
          );

        // Appliquer l'optimistic update avec le budget complet
        this.#dashboardResource.update((state) => {
          if (!state) return state;
          const updatedState: DashboardData = {
            ...state,
            transactions: updatedTransactions,
          };

          if (state.budget) {
            updatedState.budget = {
              ...state.budget,
              endingBalance: newEndingBalance,
            };
          }

          return updatedState;
        });
      }

      // 2. Mettre à jour la transaction sur le backend
      await firstValueFrom(
        this.#transactionApi.update$(transactionId, transactionData),
      );

      // 3. Récupérer le budget mis à jour depuis le backend pour avoir le vrai ending balance
      const budgetId = this.#dashboardResource.value()?.budget?.id;
      if (budgetId) {
        const updatedBudget = await firstValueFrom(
          this.#budgetApi.getBudgetById$(budgetId),
        );

        // 4. Mettre à jour avec la vraie valeur du backend
        const latestData = this.#dashboardResource.value();
        if (latestData && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: updatedBudget,
          });
        }
      }

      this.#logger.info(
        'Transaction updated successfully with optimistic update and backend sync',
      );
    } catch (error) {
      this.#logger.error('Error updating transaction:', error);

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
