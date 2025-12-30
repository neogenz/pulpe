import { computed, inject, Injectable, resource } from '@angular/core';
import { BudgetApi } from '@core/budget/budget-api';
import { Logger } from '@core/logging/logger';
import { createRolloverLine } from '@core/rollover/rollover-types';
import { TransactionApi } from '@core/transaction/transaction-api';
import {
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type Transaction,
  type TransactionCreate,
  BudgetFormulas,
} from '@pulpe/shared';

import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';
import { createInitialBudgetDetailsState } from './budget-details-state';

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

      return {
        ...response.data.budget,
        budgetLines: response.data.budgetLines,
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
  readonly displayBudgetLines = computed<BudgetLine[]>(() => {
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

      // Apply local checked state for rollover
      rolloverLine.checkedAt = this.#state.rolloverCheckedAt();

      // Add rollover at the beginning of the list
      lines.unshift(rolloverLine);
    }

    return lines;
  });

  readonly realizedBalance = computed<number>(() => {
    const details = this.budgetDetails();
    if (!details) return 0;

    return BudgetFormulas.calculateRealizedBalance(
      this.displayBudgetLines(),
      details.transactions,
    );
  });

  setBudgetId(budgetId: string): void {
    this.#state.budgetId.set(budgetId);
    // Reset rollover checked state when changing budget (checked by default)
    this.#state.rolloverCheckedAt.set(new Date().toISOString());
  }

  /**
   * Create a new budget line with optimistic updates
   */
  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const newId = `temp-${uuidv4()}`;

    // Create temporary budget line for optimistic update
    const tempBudgetLine: BudgetLine = {
      ...budgetLine,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateLineId: null,
      savingsGoalId: null,
      checkedAt: budgetLine.checkedAt ?? null,
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

      // Replace temporary line with server response
      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          budgetLines: details.budgetLines.map((line) =>
            line.id === newId ? response.data : line,
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
   * Create an allocated transaction with optimistic updates
   */
  async createAllocatedTransaction(
    transactionData: TransactionCreate,
  ): Promise<void> {
    const newId = `temp-${uuidv4()}`;

    // Create temporary transaction for optimistic update
    const tempTransaction: Transaction = {
      id: newId,
      budgetId: transactionData.budgetId,
      budgetLineId: transactionData.budgetLineId ?? null,
      name: transactionData.name,
      amount: transactionData.amount,
      kind: transactionData.kind,
      transactionDate:
        transactionData.transactionDate ?? new Date().toISOString(),
      category: transactionData.category ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkedAt: null,
    };

    // Optimistic update - add the new transaction immediately
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        transactions: [...(details.transactions ?? []), tempTransaction],
      };
    });

    try {
      const response = await firstValueFrom(
        this.#transactionApi.create$(transactionData),
      );

      // Replace temporary transaction with server response
      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          transactions: (details.transactions ?? []).map((tx) =>
            tx.id === newId ? response.data : tx,
          ),
        };
      });

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = "Erreur lors de l'ajout de la transaction";
      this.#setError(errorMessage);
      this.#logger.error('Error creating allocated transaction', error);
    }
  }

  /**
   * Reset a budget line from its template values
   */
  async resetBudgetLineFromTemplate(id: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.resetFromTemplate$(id),
      );

      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          budgetLines: details.budgetLines.map((line) =>
            line.id === id ? response.data : line,
          ),
        };
      });

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la réinitialisation de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error resetting budget line from template', error);
      throw error;
    }
  }

  /**
   * Toggle the checked state of a budget line
   * For rollover lines (virtual), only updates local state without API call
   * Cascades to allocated transactions: checking checks all, unchecking unchecks all
   */
  async toggleCheck(id: string): Promise<void> {
    // Handle virtual rollover line - local state only, no API call
    if (id === 'rollover-display') {
      const currentCheckedAt = this.#state.rolloverCheckedAt();
      this.#state.rolloverCheckedAt.set(
        currentCheckedAt === null ? new Date().toISOString() : null,
      );
      return;
    }

    const details = this.budgetDetails();
    if (!details) return;

    const budgetLine = details.budgetLines.find((line) => line.id === id);
    if (!budgetLine) return;

    const isChecking = budgetLine.checkedAt === null;
    const allocatedTransactions = (details.transactions ?? []).filter(
      (tx) => tx.budgetLineId === id,
    );

    // Transactions to toggle: unchecked when checking, checked when unchecking
    const transactionsToToggle = allocatedTransactions.filter((tx) =>
      isChecking ? tx.checkedAt === null : tx.checkedAt !== null,
    );

    // Optimistic update for budget line and allocated transactions
    this.#budgetDetailsResource.update((d) => {
      if (!d) return d;

      const now = new Date().toISOString();
      return {
        ...d,
        budgetLines: d.budgetLines.map((line) =>
          line.id === id
            ? { ...line, checkedAt: isChecking ? now : null, updatedAt: now }
            : line,
        ),
        transactions: (d.transactions ?? []).map((tx) =>
          tx.budgetLineId === id
            ? { ...tx, checkedAt: isChecking ? now : null, updatedAt: now }
            : tx,
        ),
      };
    });

    try {
      // Toggle budget line
      const response = await firstValueFrom(
        this.#budgetLineApi.toggleCheck$(id),
      );

      // Toggle allocated transactions that need to change
      await Promise.all(
        transactionsToToggle.map((tx) =>
          firstValueFrom(this.#transactionApi.toggleCheck$(tx.id)),
        ),
      );

      this.#budgetDetailsResource.update((d) => {
        if (!d) return d;

        return {
          ...d,
          budgetLines: d.budgetLines.map((line) =>
            line.id === id ? response.data : line,
          ),
        };
      });

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage =
        'Erreur lors du basculement du statut de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error toggling budget line check', error);
    }
  }

  /**
   * Toggle the checked state of a transaction
   * Uses optimistic update for instant UI feedback with rollback on error
   * When unchecking a transaction, unchecks the parent budget line
   * When all allocated transactions are checked, checks the parent budget line
   */
  async toggleTransactionCheck(id: string): Promise<void> {
    const details = this.budgetDetails();
    if (!details) return;

    const transaction = (details.transactions ?? []).find((tx) => tx.id === id);
    if (!transaction) return;

    const isChecking = transaction.checkedAt === null;
    const budgetLineId = transaction.budgetLineId;

    // Optimistic update
    this.#budgetDetailsResource.update((d) => {
      if (!d) return d;

      const now = new Date().toISOString();
      const updatedTransactions = (d.transactions ?? []).map((tx) =>
        tx.id === id
          ? { ...tx, checkedAt: isChecking ? now : null, updatedAt: now }
          : tx,
      );

      let updatedBudgetLines = d.budgetLines;

      if (budgetLineId) {
        if (!isChecking) {
          // Unchecking transaction → uncheck parent budget line
          updatedBudgetLines = d.budgetLines.map((line) =>
            line.id === budgetLineId && line.checkedAt !== null
              ? { ...line, checkedAt: null, updatedAt: now }
              : line,
          );
        } else {
          // Checking transaction → check if all allocated transactions will be checked
          const allocatedTxs = updatedTransactions.filter(
            (tx) => tx.budgetLineId === budgetLineId,
          );
          const allChecked = allocatedTxs.every((tx) => tx.checkedAt !== null);
          if (allChecked) {
            updatedBudgetLines = d.budgetLines.map((line) =>
              line.id === budgetLineId && line.checkedAt === null
                ? { ...line, checkedAt: now, updatedAt: now }
                : line,
            );
          }
        }
      }

      return {
        ...d,
        transactions: updatedTransactions,
        budgetLines: updatedBudgetLines,
      };
    });

    try {
      const response = await firstValueFrom(
        this.#transactionApi.toggleCheck$(id),
      );

      // Handle cascading budget line updates
      if (budgetLineId) {
        const currentDetails = this.budgetDetails();
        if (currentDetails) {
          const budgetLine = currentDetails.budgetLines.find(
            (line) => line.id === budgetLineId,
          );
          const allocatedTxs = (currentDetails.transactions ?? []).filter(
            (tx) => tx.budgetLineId === budgetLineId,
          );

          if (!isChecking && budgetLine?.checkedAt !== null) {
            // Unchecking → uncheck budget line if it was checked
            await firstValueFrom(
              this.#budgetLineApi.toggleCheck$(budgetLineId),
            );
          } else if (isChecking) {
            // Checking → check budget line if all allocated are now checked
            const allChecked = allocatedTxs.every(
              (tx) => tx.checkedAt !== null,
            );
            if (allChecked && budgetLine?.checkedAt === null) {
              await firstValueFrom(
                this.#budgetLineApi.toggleCheck$(budgetLineId),
              );
            }
          }
        }
      }

      this.#budgetDetailsResource.update((d) => {
        if (!d) return d;

        return {
          ...d,
          transactions: (d.transactions ?? []).map((tx) =>
            tx.id === id ? response.data : tx,
          ),
        };
      });

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage =
        'Erreur lors du basculement du statut de la transaction';
      this.#setError(errorMessage);
      this.#logger.error('Error toggling transaction check', error);
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
