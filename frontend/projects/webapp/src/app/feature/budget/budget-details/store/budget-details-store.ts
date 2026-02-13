import {
  computed,
  effect,
  inject,
  Injectable,
  resource,
  signal,
} from '@angular/core';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { Logger } from '@core/logging/logger';
import { createRolloverLine } from '@core/budget/rollover/rollover-types';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { TransactionApi } from '@core/transaction/transaction-api';
import {
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  BudgetFormulas,
} from 'pulpe-shared';

import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';
import {
  calculateBudgetLineToggle,
  calculateTransactionToggle,
} from './budget-details-check.utils';
import { normalizeText } from '../data-core/budget-item-constants';
import { createInitialBudgetDetailsState } from './budget-details-state';

const TEMP_ID_PREFIX = 'temp-';

function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

function generateTempId(): string {
  return `${TEMP_ID_PREFIX}${uuidv4()}`;
}

/**
 * Signal-based store for budget details state management
 * Follows the reactive patterns with single state signal and resource separation
 */
@Injectable()
export class BudgetDetailsStore {
  // ── 1. Dependencies ──
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #transactionApi = inject(TransactionApi);
  readonly #invalidationService = inject(BudgetInvalidationService);
  readonly #logger = inject(Logger);
  readonly #storage = inject(StorageService);

  // ── 2. Internal state (private/writable) ──
  readonly #state = createInitialBudgetDetailsState();
  readonly #staleData = signal<BudgetDetailsViewModel | null>(null);

  // Filter state - show only unchecked items by default
  readonly #isShowingOnlyUnchecked = signal<boolean>(
    this.#storage.get<boolean>(STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED) ?? true,
  );
  readonly isShowingOnlyUnchecked = this.#isShowingOnlyUnchecked.asReadonly();

  // Search filter state
  readonly #searchText = signal('');
  readonly searchText = this.#searchText.asReadonly();

  constructor() {
    // Persist filter preference to localStorage
    effect(() => {
      this.#storage.set(
        STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED,
        this.#isShowingOnlyUnchecked(),
      );
    });

    // Keep stale snapshot only from server-resolved states (not local optimistic updates).
    effect(() => {
      if (this.#budgetDetailsResource.status() === 'resolved') {
        const details = this.#budgetDetailsResource.value();
        if (details) {
          this.#staleData.set(details);
        }
      }
    });
  }

  // ── 3. Data loading (resource) ──
  readonly #budgetDetailsResource = resource<
    BudgetDetailsViewModel,
    string | undefined
  >({
    params: () => this.#state.budgetId() ?? undefined,
    loader: async ({ params: budgetId }) => {
      const response = await firstValueFrom(
        this.#budgetApi.getBudgetWithDetails$(budgetId),
      );

      if (!response.success || !response.data) {
        this.#logger.error('Failed to fetch budget details', {
          budgetId,
        });
        throw new Error('Failed to fetch budget details');
      }

      return {
        ...response.data.budget,
        budgetLines: response.data.budgetLines,
        transactions: response.data.transactions,
      };
    },
  });

  readonly #allBudgetsResource = resource({
    params: () => ({ version: this.#invalidationService.version() }),
    loader: async () => firstValueFrom(this.#budgetApi.getAllBudgets$()),
  });

  // ── 4. Public selectors (readonly/computed) ──
  readonly budgetDetails = computed(
    () => this.#budgetDetailsResource.value() ?? this.#staleData(),
  );
  readonly isLoading = computed(
    () => this.#budgetDetailsResource.isLoading() && !this.#staleData(),
  );
  readonly isInitialLoading = computed(
    () =>
      this.#budgetDetailsResource.status() === 'loading' && !this.#staleData(),
  );
  readonly hasValue = computed(() => this.budgetDetails() !== null);
  readonly error = computed(
    () => this.#budgetDetailsResource.error() || this.#state.errorMessage(),
  );

  readonly #sortedBudgets = computed(() => {
    const budgets = this.#allBudgetsResource.value() ?? [];
    return [...budgets].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  });

  readonly #currentIndex = computed(() => {
    const currentId = this.#state.budgetId();
    return this.#sortedBudgets().findIndex((b) => b.id === currentId);
  });

  readonly previousBudgetId = computed(() => {
    const idx = this.#currentIndex();
    const sorted = this.#sortedBudgets();
    return idx > 0 ? sorted[idx - 1].id : null;
  });

  readonly nextBudgetId = computed(() => {
    const idx = this.#currentIndex();
    const sorted = this.#sortedBudgets();
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1].id : null;
  });

  readonly hasPrevious = computed(() => this.previousBudgetId() !== null);
  readonly hasNext = computed(() => this.nextBudgetId() !== null);

  /**
   * Budget lines for display - includes virtual rollover line when applicable
   * Similar to current-month-store pattern but for budget details page
   */
  readonly displayBudgetLines = computed<BudgetLine[]>(() => {
    const details = this.budgetDetails();
    if (!details) return [];

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

      return [rolloverLine, ...details.budgetLines];
    }

    return [...details.budgetLines];
  });

  readonly realizedBalance = computed<number>(() => {
    const details = this.budgetDetails();
    if (!details) return 0;
    return BudgetFormulas.calculateRealizedBalance(
      this.displayBudgetLines(),
      details.transactions,
    );
  });

  readonly realizedExpenses = computed<number>(() => {
    const details = this.budgetDetails();
    if (!details) return 0;
    return BudgetFormulas.calculateRealizedExpenses(
      this.displayBudgetLines(),
      details.transactions,
    );
  });

  readonly checkedItemsCount = computed<number>(() => {
    const details = this.budgetDetails();
    if (!details) return 0;
    const lines = this.displayBudgetLines();
    const transactions = details.transactions ?? [];
    return [...lines, ...transactions].filter((item) => item.checkedAt != null)
      .length;
  });

  readonly totalItemsCount = computed<number>(() => {
    const details = this.budgetDetails();
    if (!details) return 0;
    const lines = this.displayBudgetLines();
    const transactions = details.transactions ?? [];
    return lines.length + transactions.length;
  });

  /**
   * Filtered budget lines based on checked filter and search text
   */
  readonly filteredBudgetLines = computed<BudgetLine[]>(() => {
    let lines = this.displayBudgetLines();
    if (this.#isShowingOnlyUnchecked()) {
      lines = lines.filter((line) => line.checkedAt === null);
    }
    const search = normalizeText(this.#searchText());
    if (!search) return lines;
    const transactions = this.budgetDetails()?.transactions ?? [];

    const budgetLineIdsWithMatchingTx = new Set(
      transactions
        .filter(
          (tx) =>
            tx.budgetLineId &&
            (normalizeText(tx.name).includes(search) ||
              String(tx.amount).includes(search)),
        )
        .map((tx) => tx.budgetLineId),
    );

    return lines.filter(
      (line) =>
        normalizeText(line.name).includes(search) ||
        String(line.amount).includes(search) ||
        budgetLineIdsWithMatchingTx.has(line.id),
    );
  });

  /**
   * Filtered transactions based on checked filter and search text
   * - Allocated transactions: follow their parent budget line's visibility
   * - Free transactions: filtered by their own checkedAt and search text
   */
  readonly filteredTransactions = computed<Transaction[]>(() => {
    const details = this.budgetDetails();
    if (!details) return [];

    const transactions = details.transactions ?? [];
    const visibleBudgetLineIds = new Set(
      this.filteredBudgetLines().map((line) => line.id),
    );
    const search = normalizeText(this.#searchText());

    return transactions.filter((tx) => {
      if (tx.budgetLineId) {
        return visibleBudgetLineIds.has(tx.budgetLineId);
      }
      // Free transaction
      const passesCheckedFilter =
        !this.#isShowingOnlyUnchecked() || tx.checkedAt === null;
      if (!passesCheckedFilter) return false;
      if (!search) return true;
      return (
        normalizeText(tx.name).includes(search) ||
        String(tx.amount).includes(search)
      );
    });
  });

  /**
   * Set the isShowingOnlyUnchecked filter value
   */
  setIsShowingOnlyUnchecked(value: boolean): void {
    this.#isShowingOnlyUnchecked.set(value);
  }

  setSearchText(value: string): void {
    this.#searchText.set(value);
  }

  setBudgetId(budgetId: string): void {
    if (this.#state.budgetId() !== budgetId) {
      this.#staleData.set(null);
    }
    this.#state.budgetId.set(budgetId);
    // Reset rollover checked state when changing budget (checked by default)
    this.#state.rolloverCheckedAt.set(new Date().toISOString());
  }

  // ── 5. Mutations (async/await) ──

  /**
   * Create a new budget line with optimistic updates
   */
  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const newId = generateTempId();

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

      // DR-005 order: temp ID replacement happens before invalidation cascade.
      this.#clearError();
      this.#invalidationService.invalidate();
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
      this.#invalidationService.invalidate();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = 'Erreur lors de la modification de la prévision';
      this.#setError(errorMessage);
      this.#logger.error('Error updating budget line', error);
    }
  }

  /**
   * Update an existing transaction with optimistic updates
   */
  async updateTransaction(id: string, data: TransactionUpdate): Promise<void> {
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      const updatedTransactions = (details.transactions ?? []).map((tx) =>
        tx.id === id
          ? { ...tx, ...data, updatedAt: new Date().toISOString() }
          : tx,
      );

      return {
        ...details,
        transactions: updatedTransactions,
      };
    });

    try {
      await firstValueFrom(this.#transactionApi.update$(id, data));

      this.#clearError();
      this.#invalidationService.invalidate();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = 'Erreur lors de la modification de la transaction';
      this.#setError(errorMessage);
      this.#logger.error('Error updating transaction', error);
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
      this.#invalidationService.invalidate();
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
      this.#invalidationService.invalidate();
    } catch (error) {
      this.reloadBudgetDetails();

      const errorMessage = 'Erreur lors de la suppression de la transaction';
      this.#setError(errorMessage);
      this.#logger.error('Error deleting transaction', error);
    }
  }

  /**
   * Create an allocated transaction with optimistic updates
   * New transactions always start unchecked
   */
  async createAllocatedTransaction(
    transactionData: TransactionCreate,
  ): Promise<void> {
    const newId = generateTempId();

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

    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      return {
        ...details,
        transactions: [...(details.transactions ?? []), tempTransaction],
      };
    });

    try {
      const response = await firstValueFrom(
        this.#transactionApi.create$({
          ...transactionData,
          checkedAt: null,
        }),
      );

      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;

        return {
          ...details,
          transactions: (details.transactions ?? []).map((tx) =>
            tx.id === newId ? response.data : tx,
          ),
        };
      });

      // DR-005 order: temp ID replacement happens before invalidation cascade.
      this.#clearError();
      this.#invalidationService.invalidate();
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
      this.#invalidationService.invalidate();
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

  async toggleCheck(id: string): Promise<boolean> {
    if (id === 'rollover-display') {
      const currentCheckedAt = this.#state.rolloverCheckedAt();
      this.#state.rolloverCheckedAt.set(
        currentCheckedAt === null ? new Date().toISOString() : null,
      );
      return true;
    }

    const details = this.budgetDetails();
    if (!details) return false;

    const result = calculateBudgetLineToggle(id, {
      budgetLines: details.budgetLines,
      transactions: details.transactions ?? [],
    });

    if (!result) return false;

    this.#budgetDetailsResource.update((d) => {
      if (!d) return d;
      return {
        ...d,
        budgetLines: result.updatedBudgetLines,
        transactions: result.updatedTransactions,
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.toggleCheck$(id),
      );

      const updatedLine = response.data;
      this.#budgetDetailsResource.update((d) => {
        if (!d) return d;
        return {
          ...d,
          budgetLines: d.budgetLines.map((line) =>
            line.id === id ? updatedLine : line,
          ),
        };
      });

      this.#clearError();
      this.#invalidationService.invalidate();
      return true;
    } catch (error) {
      this.reloadBudgetDetails();
      this.#setError('Erreur lors du basculement du statut de la prévision');
      this.#logger.error('Error toggling budget line check', error);
      return false;
    }
  }

  async toggleTransactionCheck(id: string): Promise<void> {
    const details = this.budgetDetails();
    if (!details) return;

    const result = calculateTransactionToggle(id, {
      budgetLines: details.budgetLines,
      transactions: details.transactions ?? [],
    });

    if (!result) return;

    this.#budgetDetailsResource.update((d) => {
      if (!d) return d;
      return {
        ...d,
        transactions: result.updatedTransactions,
      };
    });

    try {
      const response = await firstValueFrom(
        this.#transactionApi.toggleCheck$(id),
      );

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
      this.#invalidationService.invalidate();
    } catch (error) {
      this.reloadBudgetDetails();
      this.#setError('Erreur lors du basculement du statut de la transaction');
      this.#logger.error('Error toggling transaction check', error);
    }
  }

  async checkAllAllocatedTransactions(budgetLineId: string): Promise<void> {
    const details = this.budgetDetails();
    if (!details) return;

    const uncheckedTransactions = (details.transactions ?? []).filter(
      (tx) =>
        tx.budgetLineId === budgetLineId &&
        tx.checkedAt === null &&
        !isTempId(tx.id),
    );
    if (uncheckedTransactions.length === 0) return;

    const now = new Date().toISOString();
    const uncheckedIds = new Set(uncheckedTransactions.map((tx) => tx.id));
    this.#budgetDetailsResource.update((d) => {
      if (!d) return d;
      return {
        ...d,
        transactions: (d.transactions ?? []).map((tx) =>
          uncheckedIds.has(tx.id) ? { ...tx, checkedAt: now } : tx,
        ),
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.checkTransactions$(budgetLineId),
      );

      const responseMap = new Map(response.data.map((tx) => [tx.id, tx]));
      this.#budgetDetailsResource.update((d) => {
        if (!d) return d;
        return {
          ...d,
          transactions: (d.transactions ?? []).map((tx) =>
            responseMap.has(tx.id) ? responseMap.get(tx.id)! : tx,
          ),
        };
      });
      this.#clearError();
      this.#invalidationService.invalidate();
    } catch (error) {
      this.reloadBudgetDetails();
      this.#setError('Erreur lors de la comptabilisation des transactions');
      this.#logger.error('Error checking all allocated transactions', error);
    }
  }

  /**
   * Manually reload budget details from the server
   */
  reloadBudgetDetails(): void {
    this.#budgetDetailsResource.reload();
    this.#clearError();
  }

  // ── 6. Private utility methods ──

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
