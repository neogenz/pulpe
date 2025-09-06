import { inject, Injectable, computed, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetLineApi } from './budget-line-api';
import { TransactionApi } from '@core/transaction/transaction-api';
import { Logger } from '@core/logging/logger';
import { createInitialBudgetDetailsState } from './budget-details-state';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetDetailsResponse,
} from '@pulpe/shared';

/**
 * Signal-based store for budget details state management
 * Follows the reactive patterns with single state signal and resource separation
 */
@Injectable()
export class BudgetDetailsStore {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #transactionApi = inject(TransactionApi);
  readonly #logger = inject(Logger);

  // Single source of truth - private state signal for non-resource data
  readonly #state = createInitialBudgetDetailsState();

  // Resource for budget details data - managed independently
  readonly #budgetDetailsResource = resource<
    BudgetDetailsResponse,
    string | null
  >({
    params: () => this.#state.budgetId(),
    loader: async ({ params: budgetId }) => {
      if (!budgetId) {
        throw new Error('Budget ID is required');
      }
      return await firstValueFrom(
        this.#budgetLineApi.getBudgetDetails$(budgetId),
      );
    },
  });

  // Public selectors (read-only computed signals)
  readonly budgetDetails = computed(() => this.#budgetDetailsResource);
  readonly operationsInProgress = computed(() =>
    this.#state.operationsInProgress(),
  );
  readonly isLoading = computed(() => this.#budgetDetailsResource.isLoading());
  readonly error = computed(() => this.#budgetDetailsResource.error());

  // New computed to distinguish initial load from updates
  // Only show spinner if loading AND no data available yet (initial load)
  readonly isInitialLoading = computed(() => {
    const status = this.#budgetDetailsResource.status();
    const hasValue = !!this.#budgetDetailsResource.value();
    // Only show spinner during initial load (loading with no data)
    return status === 'loading' && !hasValue;
  });

  readonly budgetData = computed(() => {
    const data = this.#budgetDetailsResource.value()?.data;
    if (!data) return null;
    const transformedData = {
      ...data,
      budgetLines: data.budgetLines.map((line) => ({
        ...line,
      })),
      transactions: data.transactions.map((transaction) => ({
        ...transaction,
      })),
    };
    return transformedData;
  });

  /**
   * Initialize the budget ID (called once from component)
   */
  initializeBudgetId(id: string): void {
    this.#state.budgetId.set(id);
  }

  /**
   * Create a new budget line with optimistic updates
   */
  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const tempId = `temp-${Date.now()}`;

    // Start operation tracking
    this.#addOperationInProgress(tempId);

    // Store original data for rollback
    const originalData = this.#budgetDetailsResource.value();

    // Create temporary budget line for optimistic update
    const tempBudgetLine = {
      id: tempId,
      ...budgetLine,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateLineId: null,
      savingsGoalId: null,
    };

    // Optimistic update - add the new line immediately
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        data: {
          ...details.data,
          budgetLines: [...details.data.budgetLines, tempBudgetLine],
        },
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.createBudgetLine$(budgetLine),
      );

      // Replace temporary line with server response
      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          data: {
            ...details.data,
            budgetLines: details.data.budgetLines.map((line) =>
              line.id === tempId ? response.data : line,
            ),
          },
        };
      });

      this.#clearError();
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#budgetDetailsResource.set(originalData);
      } else {
        this.#budgetDetailsResource.reload();
      }

      const errorMessage = "Erreur lors de l'ajout de la prévision";
      this.#setError(errorMessage);
      this.#logger.error('Error creating budget line', error);
    } finally {
      this.#removeOperationInProgress(tempId);
    }
  }

  /**
   * Update an existing budget line with optimistic updates and rollback on error
   */
  async updateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    // Start operation tracking
    //this.#addOperationInProgress(data.id);

    //simulate sleep of 3 seconds

    //await firstValueFrom(timer(3000));

    // Store original data for rollback
    const originalData = this.#budgetDetailsResource.value();

    // Optimistic update
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      const updatedLines = details.data.budgetLines.map((line) =>
        line.id === data.id
          ? { ...line, ...data, updatedAt: new Date().toISOString() }
          : line,
      );

      return {
        ...details,
        data: { ...details.data, budgetLines: updatedLines },
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
      // Rollback on error
      if (originalData) {
        this.#budgetDetailsResource.set(originalData);
      } else {
        this.#budgetDetailsResource.reload();
      }

      const errorMessage = 'Erreur lors de la modification de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error updating budget line', error);
    } finally {
      //this.#removeOperationInProgress(data.id);
    }
  }

  /**
   * Delete a budget line with optimistic updates and rollback on error
   */
  async deleteBudgetLine(id: string): Promise<void> {
    // Start operation tracking
    this.#addOperationInProgress(id);

    // Store original data for rollback
    const originalData = this.#budgetDetailsResource.value();

    // Optimistic update - remove the item
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        data: {
          ...details.data,
          budgetLines: details.data.budgetLines.filter(
            (line) => line.id !== id,
          ),
        },
      };
    });

    try {
      await firstValueFrom(this.#budgetLineApi.deleteBudgetLine$(id));

      this.#clearError();
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#budgetDetailsResource.set(originalData);
      } else {
        this.#budgetDetailsResource.reload();
      }

      const errorMessage = 'Erreur lors de la suppression de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error deleting budget line', error);
    } finally {
      this.#removeOperationInProgress(id);
    }
  }

  /**
   * Delete a transaction with optimistic updates and rollback on error
   */
  async deleteTransaction(id: string): Promise<void> {
    // Start operation tracking
    this.#addOperationInProgress(id);

    // Store original data for rollback
    const originalData = this.#budgetDetailsResource.value();

    // Optimistic update - remove the transaction
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        data: {
          ...details.data,
          transactions:
            details.data.transactions?.filter((tx) => tx.id !== id) ?? [],
        },
      };
    });

    try {
      await firstValueFrom(this.#transactionApi.remove$(id));

      this.#clearError();
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#budgetDetailsResource.set(originalData);
      } else {
        this.#budgetDetailsResource.reload();
      }

      const errorMessage = 'Erreur lors de la suppression de la transaction';
      this.#setError(errorMessage);
      this.#logger.error('Error deleting transaction', error);
    } finally {
      this.#removeOperationInProgress(id);
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
   * Add an operation ID to the in-progress tracking
   */
  #addOperationInProgress(operationId: string): void {
    this.#state.operationsInProgress.update((operationsInProgress) => {
      operationsInProgress.add(operationId);
      return operationsInProgress;
    });
  }

  /**
   * Remove an operation ID from the in-progress tracking
   */
  #removeOperationInProgress(operationId: string): void {
    this.#state.operationsInProgress.update((operationsInProgress) => {
      const newSet = new Set(operationsInProgress);
      newSet.delete(operationId);
      return newSet;
    });
  }

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

  // Private utility methods
}
