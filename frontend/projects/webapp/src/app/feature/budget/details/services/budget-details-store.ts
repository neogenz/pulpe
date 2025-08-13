import {
  inject,
  Injectable,
  signal,
  computed,
  effect,
  resource,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BudgetLineApi } from './budget-line-api';
import {
  type BudgetDetailsState,
  createInitialBudgetDetailsState,
} from './budget-details-state.interface';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetDetailsResponse,
} from '@pulpe/shared';

/**
 * Signal-based store for budget details state management
 * Follows the reactive patterns with unified state signal
 */
@Injectable()
export class BudgetDetailsStore {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #snackBar = inject(MatSnackBar);

  // Single source of truth - private state signal
  readonly #state = signal<BudgetDetailsState>(
    createInitialBudgetDetailsState(),
  );

  // Resource for budget details data - managed independently but synchronized with state
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
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly error = computed(() => this.#state().error);

  // Derived selectors for convenience
  readonly hasOperationsInProgress = computed(
    () => this.operationsInProgress().size > 0,
  );
  readonly budgetData = computed(
    () => this.budgetDetails().value()?.data ?? null,
  );
  readonly budgetLines = computed(() => this.budgetData()?.budgetLines ?? []);

  constructor() {
    // Effect to synchronize resource state with internal state
    effect(() => {
      const resource = this.#budgetDetailsResource;
      const resourceState = resource.status();

      this.#setState((currentState) => ({
        ...currentState,
        budgetDetails: resource,
        isLoading: resourceState === 'loading',
        error: resource.error() ? String(resource.error()) : null,
      }));
    });
  }

  // Public Actions

  /**
   * Initialize the budget ID (called once from component)
   */
  initializeBudgetId(id: string): void {
    this.#setState((currentState) => ({
      ...currentState,
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

      this.#showSuccessMessage('Prévision ajoutée.');
      this.#clearError();
    } catch (error) {
      // On error, reload to ensure consistency
      this.#budgetDetailsResource.reload();

      const errorMessage = "Erreur lors de l'ajout de la prévision";
      this.#showErrorMessage(errorMessage);
      this.#setError(errorMessage);
      console.error('Error creating budget line:', error);
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

      this.#showSuccessMessage('Prévision modifiée.');
      this.#clearError();
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#budgetDetailsResource.set(originalData);
      } else {
        this.#budgetDetailsResource.reload();
      }

      const errorMessage = 'Erreur lors de la modification de la prévision';
      this.#showErrorMessage(errorMessage);
      this.#setError(errorMessage);
      console.error('Error updating budget line:', error);
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

      this.#showSuccessMessage('Prévision supprimée.');
      this.#clearError();
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#budgetDetailsResource.set(originalData);
      } else {
        this.#budgetDetailsResource.reload();
      }

      const errorMessage = 'Erreur lors de la suppression de la prévision';
      this.#showErrorMessage(errorMessage);
      this.#setError(errorMessage);
      console.error('Error deleting budget line:', error);
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
   * Immutably update the state signal
   */
  #setState(
    updater: (currentState: BudgetDetailsState) => BudgetDetailsState,
  ): void {
    this.#state.update(updater);
  }

  /**
   * Add an operation ID to the in-progress tracking
   */
  #addOperationInProgress(operationId: string): void {
    this.#setState((currentState) => ({
      ...currentState,
      operationsInProgress: new Set(currentState.operationsInProgress).add(
        operationId,
      ),
    }));
  }

  /**
   * Remove an operation ID from the in-progress tracking
   */
  #removeOperationInProgress(operationId: string): void {
    this.#setState((currentState) => {
      const newSet = new Set(currentState.operationsInProgress);
      newSet.delete(operationId);
      return {
        ...currentState,
        operationsInProgress: newSet,
      };
    });
  }

  /**
   * Set an error message in the state
   */
  #setError(error: string): void {
    this.#setState((currentState) => ({
      ...currentState,
      error,
    }));
  }

  /**
   * Clear the error state
   */
  #clearError(): void {
    this.#setState((currentState) => ({
      ...currentState,
      error: null,
    }));
  }

  // Private utility methods

  /**
   * Show success message via snackbar
   */
  #showSuccessMessage(message: string): void {
    this.#snackBar.open(message, 'OK', {
      duration: 3000,
    });
  }

  /**
   * Show error message via snackbar
   */
  #showErrorMessage(message: string): void {
    this.#snackBar.open(message, 'OK', {
      duration: 5000,
    });
  }
}
