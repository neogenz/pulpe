import { computed, inject, Injectable, resource } from '@angular/core';
import { BudgetApi } from '@core/budget/budget-api';
import { Logger } from '@core/logging/logger';
import { createRolloverLine } from '@core/rollover/rollover-types';
import { TransactionApi } from '@core/transaction/transaction-api';
import {
  type BudgetLineWithConsumption,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type Transaction,
} from '@pulpe/shared';

import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';
import { createInitialBudgetDetailsState } from './budget-details-state';

/**
 * Enriches a budget line with default consumption values
 */
function enrichBudgetLineWithConsumption(
  line: Omit<BudgetLineWithConsumption, 'consumedAmount' | 'remainingAmount'>,
): BudgetLineWithConsumption {
  return {
    ...line,
    consumedAmount: 0,
    remainingAmount: line.amount,
  };
}

/**
 * Signal-based store for budget details state management
 * Follows the reactive patterns with single state signal and resource separation
 */
@Injectable()
export class BudgetDetailsStore {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #transactionApi = inject(TransactionApi);
  readonly #logger = inject(Logger);

  // Single source of truth - private state signal for non-resource data
  readonly #state = createInitialBudgetDetailsState();

  readonly #budgetDetailsResource = resource<
    BudgetDetailsViewModel,
    string | null
  >({
    params: () => this.#state.budgetId(),
    loader: async ({ params: budgetId }) => {
      if (!budgetId) {
        throw new Error('Budget ID is required');
      }

      const response = await firstValueFrom(
        this.#budgetApi.getBudgetWithDetails$(budgetId),
      );

      if (!response.success || !response.data) {
        this.#logger.error('Failed to fetch budget details', { budgetId });
        throw new Error('Failed to fetch budget details');
      }

      // Enrich budget lines with default consumption values
      // Actual consumption data will be loaded when user opens allocated transactions dialog
      const enrichedBudgetLines = response.data.budgetLines.map(
        enrichBudgetLineWithConsumption,
      );

      return {
        ...response.data.budget,
        budgetLines: enrichedBudgetLines,
        transactions: response.data.transactions,
      };
    },
  });

  // Computed pour l'état dérivé
  readonly budgetDetails = computed(
    () => this.#budgetDetailsResource.value() ?? null,
  );
  readonly isLoading = computed(() => this.#budgetDetailsResource.isLoading());
  readonly hasValue = computed(() => this.#budgetDetailsResource.hasValue());
  readonly error = computed(
    () => this.#budgetDetailsResource.error() || this.#state.errorMessage(),
  );

  /**
   * Budget lines for display - includes virtual rollover line when applicable
   * Similar to current-month-store pattern but for budget details page
   */
  readonly displayBudgetLines = computed<BudgetLineWithConsumption[]>(() => {
    const details = this.budgetDetails();
    if (!details) return [];

    const lines = [...details.budgetLines];
    const rollover = details.rollover;
    const previousBudgetId = details.previousBudgetId;

    // Add virtual rollover line for display if rollover exists
    if (rollover !== 0 && rollover !== undefined) {
      const rolloverLine = createRolloverLine({
        budgetId: details.id,
        amount: rollover,
        month: details.month,
        year: details.year,
        previousBudgetId: previousBudgetId,
      });

      // Add rollover at the beginning of the list with consumption data
      lines.unshift({
        ...rolloverLine,
        consumedAmount: 0,
        remainingAmount: rollover,
      });
    }

    return lines;
  });

  /**
   * Get a budget line by ID with consumption data
   */
  getBudgetLineWithConsumption(
    id: string,
  ): BudgetLineWithConsumption | undefined {
    const details = this.budgetDetails();
    if (!details) return undefined;
    return details.budgetLines.find((line) => line.id === id);
  }

  /**
   * Load allocated transactions for a budget line
   */
  async getAllocatedTransactions(budgetLineId: string): Promise<Transaction[]> {
    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.getAllocatedTransactions$(budgetLineId),
      );

      if (!response.success || !response.data) {
        this.#logger.error('Failed to fetch allocated transactions', {
          budgetLineId,
        });
        return [];
      }

      return response.data;
    } catch (error) {
      this.#logger.error('Error fetching allocated transactions:', error);
      return [];
    }
  }

  setBudgetId(budgetId: string): void {
    this.#state.budgetId.set(budgetId);
  }

  /**
   * Create a new budget line with optimistic updates
   */
  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const newId = `temp-${uuidv4()}`;

    // Create temporary budget line for optimistic update with enriched data
    const tempBudgetLine: BudgetLineWithConsumption = {
      ...budgetLine,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateLineId: null,
      savingsGoalId: null,
      consumedAmount: 0,
      remainingAmount: budgetLine.amount,
    };

    // Optimistic update - add the new line immediately
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        budgetLines: [...details.budgetLines, tempBudgetLine],
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.createBudgetLine$(budgetLine),
      );

      // Replace temporary line with server response (enriched with default consumption)
      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          budgetLines: details.budgetLines.map((line) =>
            line.id === newId
              ? enrichBudgetLineWithConsumption(response.data)
              : line,
          ),
        };
      });

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = "Erreur lors de l'ajout de la prévision";
      this.#setError(errorMessage);
      this.#logger.error('Error creating budget line', error);
    }
  }

  /**
   * Update an existing budget line with optimistic updates
   */
  async updateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    // Optimistic update
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      const updatedLines = details.budgetLines.map((line) =>
        line.id === data.id
          ? { ...line, ...data, updatedAt: new Date().toISOString() }
          : line,
      );

      return {
        ...details,
        budgetLines: updatedLines,
      };
    });

    try {
      // Just persist to server, don't update local state again
      await firstValueFrom(
        this.#budgetLineApi.updateBudgetLine$(data.id, data),
      );

      // Clear any previous errors
      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = 'Erreur lors de la modification de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error updating budget line', error);
    }
  }

  /**
   * Delete a budget line with optimistic updates
   */
  async deleteBudgetLine(id: string): Promise<void> {
    // Optimistic update - remove the item
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        budgetLines: details.budgetLines.filter((line) => line.id !== id),
      };
    });

    try {
      await firstValueFrom(this.#budgetLineApi.deleteBudgetLine$(id));

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = 'Erreur lors de la suppression de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error deleting budget line', error);
    }
  }

  /**
   * Delete a transaction with optimistic updates
   */
  async deleteTransaction(id: string): Promise<void> {
    // Optimistic update - remove the transaction
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        transactions: details.transactions?.filter((tx) => tx.id !== id) ?? [],
      };
    });

    try {
      await firstValueFrom(this.#transactionApi.remove$(id));

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = 'Erreur lors de la suppression de la transaction';
      this.#setError(errorMessage);
      this.#logger.error('Error deleting transaction', error);
    }
  }

  /**
   * Manually reload budget details from the server
   */
  reloadBudgetDetails(): void {
    this.#budgetDetailsResource.reload();
    this.#clearError();
  }

  // Private state mutation methods

  /**
   * Set an error message in the state
   */
  #setError(error: string): void {
    this.#state.errorMessage.set(error);
  }

  /**
   * Clear the error state
   */
  #clearError(): void {
    this.#state.errorMessage.set(null);
  }
}
