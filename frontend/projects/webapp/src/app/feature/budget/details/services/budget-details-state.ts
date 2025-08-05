import { inject, Injectable, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetLineApi } from './budget-line-api';
import { MatSnackBar } from '@angular/material/snack-bar';
import { resource } from '@angular/core';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetDetailsResponse,
} from '@pulpe/shared';

@Injectable()
export class BudgetDetailsState {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #snackBar = inject(MatSnackBar);

  // Signal to hold the current budget ID - can be initialized in constructor
  #budgetId = signal<string | null>(null);

  #operationsInProgress = signal(new Set<string>());
  operationsInProgress = computed(() => this.#operationsInProgress());

  // Service owns the resource
  budgetDetails = resource<BudgetDetailsResponse, string | null>({
    params: () => this.#budgetId(),
    loader: async ({ params: budgetId }) => {
      if (!budgetId) {
        throw new Error('Budget ID is required');
      }
      return await firstValueFrom(
        this.#budgetLineApi.getBudgetDetails$(budgetId),
      );
    },
  });

  // Initialize the budget ID (called once from component)
  initializeBudgetId(id: string): void {
    this.#budgetId.set(id);
  }

  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const tempId = `temp-${Date.now()}`;

    // Track operation in progress
    this.#operationsInProgress.update((ops) => new Set(ops).add(tempId));

    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.createBudgetLine$(budgetLine),
      );

      // Update resource with the new budget line
      this.budgetDetails.update((details) => {
        if (!details) return details;

        return {
          ...details,
          data: {
            ...details.data,
            budgetLines: [...details.data.budgetLines, response.data],
          },
        };
      });

      this.#snackBar.open('Prévision ajoutée.', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      // On error, reload to ensure consistency
      this.budgetDetails.reload();

      this.#snackBar.open("Erreur lors de l'ajout de la prévision", 'OK', {
        duration: 5000,
      });
      console.error('Error creating budget line:', error);
    } finally {
      // Remove operation from tracking
      this.#operationsInProgress.update((ops) => {
        const newOps = new Set(ops);
        newOps.delete(tempId);
        return newOps;
      });
    }
  }

  async updateBudgetLine(id: string, update: BudgetLineUpdate): Promise<void> {
    // Track operation in progress
    this.#operationsInProgress.update((ops) => new Set(ops).add(id));

    // Store original data for rollback
    const originalData = this.budgetDetails.value();

    // Optimistic update
    this.budgetDetails.update((details) => {
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
      this.budgetDetails.update((details) => {
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

      this.#snackBar.open('Prévision modifiée.', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.budgetDetails.set(originalData);
      } else {
        this.budgetDetails.reload();
      }

      this.#snackBar.open(
        'Erreur lors de la modification de la prévision',
        'OK',
        { duration: 5000 },
      );
      console.error('Error updating budget line:', error);
    } finally {
      // Remove operation from tracking
      this.#operationsInProgress.update((ops) => {
        const newOps = new Set(ops);
        newOps.delete(id);
        return newOps;
      });
    }
  }

  async deleteBudgetLine(id: string): Promise<void> {
    // Track operation in progress
    this.#operationsInProgress.update((ops) => new Set(ops).add(id));

    // Store original data for rollback
    const originalData = this.budgetDetails.value();

    // Optimistic update - remove the item
    this.budgetDetails.update((details) => {
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

      this.#snackBar.open('Prévision supprimée.', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.budgetDetails.set(originalData);
      } else {
        this.budgetDetails.reload();
      }

      this.#snackBar.open(
        'Erreur lors de la suppression de la prévision',
        'OK',
        { duration: 5000 },
      );
      console.error('Error deleting budget line:', error);
    } finally {
      // Remove operation from tracking
      this.#operationsInProgress.update((ops) => {
        const newOps = new Set(ops);
        newOps.delete(id);
        return newOps;
      });
    }
  }
}
