import {
  computed,
  effect,
  inject,
  Injectable,
  resource,
  signal,
} from '@angular/core';

import { BudgetApi } from '@core/budget/budget-api';
import { BudgetCache } from '@core/budget/budget-cache';
import { Logger } from '@core/logging/logger';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { TransactionApi } from '@core/transaction/transaction-api';
import {
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type Transaction,
  type TransactionCreate,
} from 'pulpe-shared';

import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';
import {
  calculateBudgetLineToggle,
  calculateTransactionToggle,
} from './budget-details-check.utils';
import {
  createCheckedItemsCount,
  createDisplayBudgetLines,
  createFilteredBudgetLines,
  createFilteredTransactions,
  createRealizedBalance,
  createRealizedExpenses,
  createTotalItemsCount,
} from './budget-details-selectors';
import { createInitialBudgetDetailsState } from './budget-details-state';

@Injectable()
export class BudgetDetailsStore {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCache = inject(BudgetCache);
  readonly #transactionApi = inject(TransactionApi);
  readonly #logger = inject(Logger);
  readonly #storage = inject(StorageService);

  // Serialization chain for toggle operations only.
  // Toggles cascade to multiple API calls (budget line + child transactions)
  // that must execute sequentially to maintain consistency.
  // CRUD mutations don't need serialization: they use resource.update() callbacks
  // which always read current state, making them inherently race-safe.
  #mutationChain = Promise.resolve();

  // Single source of truth - private state signal for non-resource data
  readonly #state = createInitialBudgetDetailsState();

  // Filter state - show only unchecked items by default
  readonly #isShowingOnlyUnchecked = signal<boolean>(
    this.#storage.get<boolean>(STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED) ?? true,
  );
  readonly isShowingOnlyUnchecked = this.#isShowingOnlyUnchecked.asReadonly();

  constructor() {
    // Persist filter preference to localStorage
    effect(() => {
      this.#storage.set(
        STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED,
        this.#isShowingOnlyUnchecked(),
      );
    });
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationChain.then(() => operation());
    // Swallow errors so the chain stays alive for subsequent operations
    this.#mutationChain = result.catch(() => undefined).then(() => undefined);
    return result;
  }

  readonly #budgetDetailsResource = resource<
    BudgetDetailsViewModel,
    string | null
  >({
    params: () => this.#state.budgetId(),
    loader: async ({ params: budgetId }) => {
      if (!budgetId) {
        throw new Error('Budget ID is required');
      }

      const cached = this.#budgetCache.getBudgetDetails(budgetId);
      if (cached) {
        return {
          ...cached.budget,
          budgetLines: cached.budgetLines,
          transactions: cached.transactions,
        };
      }

      // If cache is currently loading this budget, wait for it
      if (this.#budgetCache.isBudgetDetailLoading(budgetId)) {
        const entry = await this.#budgetCache.waitForBudgetDetails(budgetId);
        if (entry) {
          return {
            ...entry.budget,
            budgetLines: entry.budgetLines,
            transactions: entry.transactions,
          };
        }
        // Cache load failed or timed out — fall through to direct API call
      }

      // Fallback to direct API call
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

  // Month navigation - load all budgets to find adjacent ones
  readonly #allBudgetsResource = resource({
    loader: async () => {
      const cached = this.#budgetCache.budgets();
      return cached ?? (await firstValueFrom(this.#budgetApi.getAllBudgets$()));
    },
  });

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

  readonly #selectorCtx = {
    budgetDetailsResource: this.#budgetDetailsResource,
    budgetDetails: this.budgetDetails,
    rolloverCheckedAt: this.#state.rolloverCheckedAt,
    isShowingOnlyUnchecked: this.#isShowingOnlyUnchecked,
  } as const;

  readonly displayBudgetLines = createDisplayBudgetLines(this.#selectorCtx);
  readonly realizedBalance = createRealizedBalance(
    this.#selectorCtx,
    this.displayBudgetLines,
  );
  readonly realizedExpenses = createRealizedExpenses(
    this.#selectorCtx,
    this.displayBudgetLines,
  );
  readonly checkedItemsCount = createCheckedItemsCount(
    this.#selectorCtx,
    this.displayBudgetLines,
  );
  readonly totalItemsCount = createTotalItemsCount(
    this.#selectorCtx,
    this.displayBudgetLines,
  );
  readonly filteredBudgetLines = createFilteredBudgetLines(
    this.displayBudgetLines,
    this.#isShowingOnlyUnchecked,
  );
  readonly filteredTransactions = createFilteredTransactions(
    this.#selectorCtx,
    this.filteredBudgetLines,
  );

  setIsShowingOnlyUnchecked(value: boolean): void {
    this.#isShowingOnlyUnchecked.set(value);
  }

  setBudgetId(budgetId: string): void {
    this.#state.budgetId.set(budgetId);
    // Reset rollover checked state when changing budget (checked by default)
    this.#state.rolloverCheckedAt.set(new Date().toISOString());
  }

  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const newId = `temp-${uuidv4()}`;

    const tempBudgetLine: BudgetLine = {
      ...budgetLine,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateLineId: null,
      savingsGoalId: null,
      checkedAt: budgetLine.checkedAt ?? null,
    };

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

      this.#budgetDetailsResource.update((details) => {
        if (!details) return details;
        return {
          ...details,
          budgetLines: details.budgetLines.map((line) =>
            line.id === newId ? response.data : line,
          ),
        };
      });

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set("Erreur lors de l'ajout de la prévision");
      this.#logger.error('Error creating budget line', error);
    }
  }

  async updateBudgetLine(data: BudgetLineUpdate): Promise<void> {
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
      await firstValueFrom(
        this.#budgetLineApi.updateBudgetLine$(data.id, data),
      );

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set(
        'Erreur lors de la modification de la prévision',
      );
      this.#logger.error('Error updating budget line', error);
    }
  }

  async deleteBudgetLine(id: string): Promise<void> {
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;
      return {
        ...details,
        budgetLines: details.budgetLines.filter((line) => line.id !== id),
      };
    });

    try {
      await firstValueFrom(this.#budgetLineApi.deleteBudgetLine$(id));

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set(
        'Erreur lors de la suppression de la prévision',
      );
      this.#logger.error('Error deleting budget line', error);
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;
      return {
        ...details,
        transactions: details.transactions?.filter((tx) => tx.id !== id) ?? [],
      };
    });

    try {
      await firstValueFrom(this.#transactionApi.remove$(id));

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set(
        'Erreur lors de la suppression de la transaction',
      );
      this.#logger.error('Error deleting transaction', error);
    }
  }

  /**
   * Create an allocated transaction with optimistic updates
   * New transactions always start unchecked; if parent was checked, uncheck it
   */
  async createAllocatedTransaction(
    transactionData: TransactionCreate,
  ): Promise<void> {
    const newId = `temp-${uuidv4()}`;
    const details = this.#budgetDetailsResource.value();

    const parentBudgetLine = details?.budgetLines.find(
      (line) => line.id === transactionData.budgetLineId,
    );
    const shouldUncheckParent =
      parentBudgetLine != null && parentBudgetLine.checkedAt !== null;

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

    // Optimistic update - add the new transaction and uncheck parent if needed
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details;

      const updatedBudgetLines =
        shouldUncheckParent && parentBudgetLine
          ? details.budgetLines.map((line) =>
              line.id === parentBudgetLine.id
                ? {
                    ...line,
                    checkedAt: null,
                    updatedAt: new Date().toISOString(),
                  }
                : line,
            )
          : details.budgetLines;

      return {
        ...details,
        budgetLines: updatedBudgetLines,
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

      // Uncheck parent budget line on backend if it was checked
      if (shouldUncheckParent && parentBudgetLine) {
        await this.#enqueue(() =>
          firstValueFrom(this.#budgetLineApi.toggleCheck$(parentBudgetLine.id)),
        );
      }

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

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set("Erreur lors de l'ajout de la transaction");
      this.#logger.error('Error creating allocated transaction', error);
    }
  }

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

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la réinitialisation de la prévision';
      this.#state.errorMessage.set(errorMessage);
      this.#logger.error('Error resetting budget line from template', error);
      throw error;
    }
  }

  async toggleCheck(id: string): Promise<void> {
    if (id === 'rollover-display') {
      const currentCheckedAt = this.#state.rolloverCheckedAt();
      this.#state.rolloverCheckedAt.set(
        currentCheckedAt === null ? new Date().toISOString() : null,
      );
      return;
    }

    const details = this.budgetDetails();
    if (!details) return;

    const result = calculateBudgetLineToggle(id, {
      budgetLines: details.budgetLines,
      transactions: details.transactions ?? [],
    });

    if (!result) return;

    this.#budgetDetailsResource.update((d) => {
      if (!d) return d;
      return {
        ...d,
        budgetLines: result.updatedBudgetLines,
        transactions: result.updatedTransactions,
      };
    });

    try {
      const response = await this.#enqueue(() =>
        firstValueFrom(this.#budgetLineApi.toggleCheck$(id)),
      );

      for (const tx of result.transactionsToToggle) {
        await this.#enqueue(() =>
          firstValueFrom(this.#transactionApi.toggleCheck$(tx.id)),
        );
      }

      this.#budgetDetailsResource.update((d) => {
        if (!d) return d;
        return {
          ...d,
          budgetLines: d.budgetLines.map((line) =>
            line.id === id ? response.data : line,
          ),
        };
      });

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set(
        'Erreur lors du basculement du statut de la prévision',
      );
      this.#logger.error('Error toggling budget line check', error);
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
        budgetLines: result.updatedBudgetLines,
        transactions: result.updatedTransactions,
      };
    });

    try {
      const response = await this.#enqueue(() =>
        firstValueFrom(this.#transactionApi.toggleCheck$(id)),
      );

      if (result.shouldToggleBudgetLine && result.budgetLineId) {
        await this.#enqueue(() =>
          firstValueFrom(
            this.#budgetLineApi.toggleCheck$(result.budgetLineId!),
          ),
        );
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

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set(
        'Erreur lors du basculement du statut de la transaction',
      );
      this.#logger.error('Error toggling transaction check', error);
    }
  }

  reloadBudgetDetails(): void {
    this.#budgetDetailsResource.reload();
    this.#state.errorMessage.set(null);
  }

  #invalidateCache(): void {
    const budgetId = this.#state.budgetId();
    if (budgetId) {
      this.#budgetCache.invalidateBudgetDetails(budgetId);
    }
  }
}
