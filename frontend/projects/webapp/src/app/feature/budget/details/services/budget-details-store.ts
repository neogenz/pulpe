import { inject, Injectable, signal, computed, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetLineApi } from './budget-line-api';
import { Logger } from '../../../../core/services/logger';
import {
  type BudgetDetailsInternalState,
  createInitialBudgetDetailsInternalState,
} from './budget-details-state';
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
  readonly #logger = inject(Logger);

  // Single source of truth - private state signal for non-resource data
  readonly #state = signal<BudgetDetailsInternalState>(
    createInitialBudgetDetailsInternalState(),
  );

  // Resource for budget details data - managed independently
  readonly #budgetDetailsResource = resource<
    BudgetDetailsResponse,
    string | null
  >({
    params: () => this.#state().budgetId,
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
  readonly budgetId = computed(() => this.#state().budgetId);
  readonly budgetDetails = computed(() => this.#budgetDetailsResource);
  readonly operationsInProgress = computed(
    () => this.#state().operationsInProgress,
  );
  readonly isLoading = computed(() => this.#budgetDetailsResource.isLoading());
  readonly error = computed(
    () => this.#budgetDetailsResource.error() || this.#state().error,
  );

  // Derived selectors for convenience
  readonly hasOperationsInProgress = computed(
    () => this.operationsInProgress().size > 0,
  );
  readonly budgetData = computed(
    () => this.#budgetDetailsResource.value()?.data ?? null,
  );
  readonly budgetLines = computed(() => this.budgetData()?.budgetLines ?? []);

  // Public Actions

  /**
   * Initialize the budget ID (called once from component)
   */
  initializeBudgetId(id: string): void {
    this.#state.update((state) => ({
      ...state,
      budgetId: id,
      error: null,
    }));
  }

  /**
   * Create a new budget line with optimistic updates
   */
  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const tempId = `temp-${Date.now()}`;

    // Start operation tracking
    this.#addOperationInProgress(tempId);

    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.createBudgetLine$(budgetLine),
      );

      // Update resource with the new budget line
      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          data: {
            ...details.data,
            budgetLines: [...details.data.budgetLines, response.data],
          },
        };
      });

      this.#clearError();
    } catch (error) {
      // On error, reload to ensure consistency
      this.#budgetDetailsResource.reload();

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
  async updateBudgetLine(id: string, update: BudgetLineUpdate): Promise<void> {
    // Start operation tracking
    this.#addOperationInProgress(id);

    // Store original data for rollback
    const originalData = this.#budgetDetailsResource.value();

    // Optimistic update
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        data: {
          ...details.data,
          budgetLines: details.data.budgetLines.map((line) =>
            line.id === id
              ? { ...line, ...update, updatedAt: new Date().toISOString() }
              : line,
          ),
        },
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.updateBudgetLine$(id, update),
      );

      // Update with server response
      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          data: {
            ...details.data,
            budgetLines: details.data.budgetLines.map((line) =>
              line.id === id ? response.data : line,
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

      const errorMessage = 'Erreur lors de la modification de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error updating budget line', error);
    } finally {
      this.#removeOperationInProgress(id);
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
    this.#state.update((state) => ({
      ...state,
      operationsInProgress: new Set(state.operationsInProgress).add(
        operationId,
      ),
    }));
  }

  /**
   * Remove an operation ID from the in-progress tracking
   */
  #removeOperationInProgress(operationId: string): void {
    this.#state.update((state) => {
      const newSet = new Set(state.operationsInProgress);
      newSet.delete(operationId);
      return {
        ...state,
        operationsInProgress: newSet,
      };
    });
  }

  /**
   * Set an error message in the state
   */
  #setError(error: string): void {
    this.#state.update((state) => ({
      ...state,
      error,
    }));
  }

  /**
   * Clear the error state
   */
  #clearError(): void {
    this.#state.update((state) => ({
      ...state,
      error: null,
    }));
  }

  // Private utility methods
}
