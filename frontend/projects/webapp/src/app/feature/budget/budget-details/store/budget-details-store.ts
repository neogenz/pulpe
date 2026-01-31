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
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { createStaleFallback } from '@core/cache';
import { Logger } from '@core/logging/logger';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { StorageService } from '@core/storage/storage.service';
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
import {
  addBudgetLine,
  addTransaction,
  applyToggleResult,
  patchBudgetLine,
  removeBudgetLine,
  removeTransaction,
  replaceBudgetLine,
  replaceTransaction,
} from './budget-details-updaters';

@Injectable()
export class BudgetDetailsStore {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCache = inject(BudgetCache);
  readonly #invalidationService = inject(BudgetInvalidationService);
  readonly #transactionApi = inject(TransactionApi);
  readonly #logger = inject(Logger);
  readonly #storage = inject(StorageService);

  #toggleQueue = Promise.resolve();
  readonly #state = createInitialBudgetDetailsState();

  readonly #isShowingOnlyUnchecked = signal<boolean>(
    this.#storage.get<boolean>(STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED) ?? true,
  );
  readonly isShowingOnlyUnchecked = this.#isShowingOnlyUnchecked.asReadonly();

  constructor() {
    effect(() => {
      this.#storage.set(
        STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED,
        this.#isShowingOnlyUnchecked(),
      );
    });
  }

  // ─── Toggle Queue ──────────────────────────────────────────────

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#toggleQueue.then(() => operation());
    this.#toggleQueue = result.catch(() => undefined).then(() => undefined);
    return result;
  }

  // ─── Resource & SWR ────────────────────────────────────────────

  readonly #budgetDetailsResource = resource<
    BudgetDetailsViewModel,
    string | null
  >({
    params: () => this.#state.budgetId(),
    loader: async ({ params: budgetId }) => {
      if (!budgetId) {
        throw new Error('Budget ID is required');
      }

      // Skip stale cache hits to force fresh API call — see DR-009 in memory-bank/techContext.md
      const cached = this.#budgetCache.getBudgetDetails(budgetId);
      if (cached && !this.#budgetCache.isBudgetDetailStale(budgetId)) {
        return {
          ...cached.budget,
          budgetLines: cached.budgetLines,
          transactions: cached.transactions,
        } satisfies BudgetDetailsViewModel;
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

  readonly #swr = createStaleFallback({
    resource: this.#budgetDetailsResource,
  });
  readonly budgetDetails = this.#swr.data;
  readonly isLoading = this.#swr.isLoading;
  readonly isInitialLoading = this.#swr.isInitialLoading;
  readonly hasValue = this.#swr.hasValue;
  readonly error = computed(
    () => this.#budgetDetailsResource.error() || this.#state.errorMessage(),
  );

  // ─── Month Navigation ─────────────────────────────────────────

  readonly #allBudgetsResource = resource({
    loader: async () => this.#budgetCache.preloadBudgetList(),
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

  // ─── Selectors ─────────────────────────────────────────────────

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

  // ─── Mutation Helper ───────────────────────────────────────────

  async #runMutation<T>(options: {
    optimisticUpdate?: (d: BudgetDetailsViewModel) => BudgetDetailsViewModel;
    apiCall: () => Promise<T>;
    reconcile?: (
      d: BudgetDetailsViewModel,
      response: T,
    ) => BudgetDetailsViewModel;
    errorMessage: string;
  }): Promise<void> {
    if (options.optimisticUpdate) {
      this.#budgetDetailsResource.update((d) =>
        d ? options.optimisticUpdate!(d) : d,
      );
    }

    try {
      const response = await options.apiCall();

      if (options.reconcile) {
        this.#budgetDetailsResource.update((d) =>
          d ? options.reconcile!(d, response) : d,
        );
      }

      this.#invalidateCache();
      this.#state.errorMessage.set(null);
    } catch (error) {
      this.#budgetDetailsResource.reload();
      this.#state.errorMessage.set(options.errorMessage);
      this.#logger.error(options.errorMessage, error);
    }
  }

  // ─── Public API ────────────────────────────────────────────────

  setIsShowingOnlyUnchecked(value: boolean): void {
    this.#isShowingOnlyUnchecked.set(value);
  }

  // Cache-first display: seed stale data before resource triggers — see DR-006 in memory-bank/techContext.md
  setBudgetId(budgetId: string): void {
    const cached = this.#budgetCache.getBudgetDetails(budgetId);
    this.#swr.setStaleData(
      cached
        ? {
            ...cached.budget,
            budgetLines: cached.budgetLines,
            transactions: cached.transactions,
          }
        : null,
    );

    this.#state.budgetId.set(budgetId);
    this.#state.rolloverCheckedAt.set(new Date().toISOString());
  }

  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    const newId = `temp-${uuidv4()}`;
    const tempLine: BudgetLine = {
      ...budgetLine,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateLineId: null,
      savingsGoalId: null,
      checkedAt: budgetLine.checkedAt ?? null,
    };

    return this.#runMutation({
      optimisticUpdate: (d) => addBudgetLine(d, tempLine),
      apiCall: () =>
        firstValueFrom(this.#budgetLineApi.createBudgetLine$(budgetLine)),
      reconcile: (d, response) => replaceBudgetLine(d, newId, response.data),
      errorMessage: "Erreur lors de l'ajout de la prévision",
    });
  }

  async updateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    return this.#runMutation({
      optimisticUpdate: (d) => patchBudgetLine(d, data),
      apiCall: () =>
        firstValueFrom(this.#budgetLineApi.updateBudgetLine$(data.id, data)),
      errorMessage: 'Erreur lors de la modification de la prévision',
    });
  }

  async deleteBudgetLine(id: string): Promise<void> {
    return this.#runMutation({
      optimisticUpdate: (d) => removeBudgetLine(d, id),
      apiCall: () => firstValueFrom(this.#budgetLineApi.deleteBudgetLine$(id)),
      errorMessage: 'Erreur lors de la suppression de la prévision',
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    return this.#runMutation({
      optimisticUpdate: (d) => removeTransaction(d, id),
      apiCall: () => firstValueFrom(this.#transactionApi.remove$(id)),
      errorMessage: 'Erreur lors de la suppression de la transaction',
    });
  }

  async createAllocatedTransaction(
    transactionData: TransactionCreate,
  ): Promise<void> {
    const newId = `temp-${uuidv4()}`;
    const details = this.#budgetDetailsResource.value();
    if (!details) return;

    const parentBudgetLine = details.budgetLines.find(
      (line) => line.id === transactionData.budgetLineId,
    );
    const inheritedCheckedAt = parentBudgetLine?.checkedAt
      ? new Date(parentBudgetLine.checkedAt).toISOString()
      : null;

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
      checkedAt: inheritedCheckedAt,
    };

    return this.#runMutation({
      optimisticUpdate: (d) => addTransaction(d, tempTransaction),
      apiCall: () =>
        firstValueFrom(
          this.#transactionApi.create$({
            ...transactionData,
            checkedAt: inheritedCheckedAt,
          }),
        ),
      reconcile: (d, response) => replaceTransaction(d, newId, response.data),
      errorMessage: "Erreur lors de l'ajout de la transaction",
    });
  }

  async resetBudgetLineFromTemplate(id: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.resetFromTemplate$(id),
      );

      this.#budgetDetailsResource.update((d) =>
        d ? replaceBudgetLine(d, id, response.data) : d,
      );

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

  // ─── Toggle Operations ────────────────────────────────────────

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

    this.#budgetDetailsResource.update((d) =>
      d ? applyToggleResult(d, result) : d,
    );

    try {
      const response = await this.#enqueue(() =>
        firstValueFrom(this.#budgetLineApi.toggleCheck$(id)),
      );

      for (const tx of result.transactionsToToggle) {
        await this.#enqueue(() =>
          firstValueFrom(this.#transactionApi.toggleCheck$(tx.id)),
        );
      }

      this.#budgetDetailsResource.update((d) =>
        d ? replaceBudgetLine(d, id, response.data) : d,
      );

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

    this.#budgetDetailsResource.update((d) =>
      d ? applyToggleResult(d, result) : d,
    );

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

      this.#budgetDetailsResource.update((d) =>
        d ? replaceTransaction(d, id, response.data) : d,
      );

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
    this.#invalidationService.invalidate();
  }
}
