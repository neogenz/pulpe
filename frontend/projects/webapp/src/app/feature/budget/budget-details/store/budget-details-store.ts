import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { cachedResource } from 'ngx-ziflux';
import { BudgetApi } from '@core/budget/budget-api';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { isApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';
import { createRolloverLine } from '@core/budget/rollover/rollover-types';
import { formatLocalDate } from '@core/date/format-local-date';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
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

@Injectable()
export class BudgetDetailsStore {
  // ── 1. Dependencies ──
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #budgetApi = inject(BudgetApi);
  readonly #logger = inject(Logger);
  readonly #storage = inject(StorageService);
  readonly #transloco = inject(TranslocoService);

  // ── 2. Internal state (private/writable) ──
  readonly #state = createInitialBudgetDetailsState();

  // Mutex: prevents concurrent toggle mutations on the same item
  readonly #mutatingIds = new Set<string>();

  readonly #isShowingOnlyUnchecked = signal<boolean>(
    this.#storage.get<boolean>(STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED) ?? true,
  );
  readonly isShowingOnlyUnchecked = this.#isShowingOnlyUnchecked.asReadonly();

  readonly #searchText = signal('');
  readonly searchText = this.#searchText.asReadonly();

  constructor() {
    effect(() => {
      this.#storage.set(
        STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED,
        this.#isShowingOnlyUnchecked(),
      );
    });

    effect(() => {
      const prevId = this.previousBudgetId();
      const nextId = this.nextBudgetId();
      untracked(() => this.#prefetchAdjacentBudgets(prevId, nextId));
    });
  }

  // ── 3. Data loading (resource) ──
  readonly #budgetDetailsResource = cachedResource<
    BudgetDetailsViewModel,
    { budgetId: string }
  >({
    cache: this.#budgetApi.cache,
    cacheKey: (params) => ['budget', 'details', params.budgetId],
    params: () => {
      const id = this.#state.budgetId();
      return id ? { budgetId: id } : undefined;
    },
    loader: async ({ params }) => {
      const response = await firstValueFrom(
        this.#budgetApi.getBudgetWithDetails$(params.budgetId),
      );

      if (!response.success || !response.data) {
        this.#logger.error('Failed to fetch budget details', {
          budgetId: params.budgetId,
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

  readonly #allBudgetsResource = cachedResource({
    cache: this.#budgetApi.cache,
    cacheKey: ['budget', 'list'],
    loader: () => this.#budgetApi.getAllBudgets$(),
  });

  // ── 4. Public selectors (readonly/computed) ──
  readonly budgetDetails = computed(
    () => this.#budgetDetailsResource.value() ?? null,
  );
  readonly isLoading = computed(
    () => this.#budgetDetailsResource.isLoading() && !this.budgetDetails(),
  );
  readonly isInitialLoading = this.#budgetDetailsResource.isInitialLoading;
  readonly hasValue = computed(() => this.budgetDetails() !== null);
  readonly error = computed(
    () => this.#budgetDetailsResource.error() || this.#state.errorMessage(),
  );

  readonly #budgetsList = computed(() =>
    this.#allBudgetsResource.error()
      ? []
      : (this.#allBudgetsResource.value() ?? []),
  );

  readonly #currentIndex = computed(() => {
    const currentId = this.#state.budgetId();
    return this.#budgetsList().findIndex((b) => b.id === currentId);
  });

  readonly previousBudgetId = computed(() => {
    const idx = this.#currentIndex();
    const budgets = this.#budgetsList();
    return idx > 0 ? budgets[idx - 1].id : null;
  });

  readonly nextBudgetId = computed(() => {
    const idx = this.#currentIndex();
    const budgets = this.#budgetsList();
    return idx >= 0 && idx < budgets.length - 1 ? budgets[idx + 1].id : null;
  });

  readonly hasPrevious = computed(() => this.previousBudgetId() !== null);
  readonly hasNext = computed(() => this.nextBudgetId() !== null);

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

  setIsShowingOnlyUnchecked(value: boolean): void {
    this.#isShowingOnlyUnchecked.set(value);
  }

  setSearchText(value: string): void {
    this.#searchText.set(value);
  }

  setBudgetId(budgetId: string): void {
    this.#state.budgetId.set(budgetId);
    this.#state.rolloverCheckedAt.set(new Date().toISOString());
  }

  // ── 5. Mutations (async/await) ──

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
      if (!details) return details!;

      return {
        ...details,
        budgetLines: [...details.budgetLines, tempBudgetLine],
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetApi.createBudgetLine$(budgetLine),
      );

      // Replace temporary line with server response
      this.#budgetDetailsResource.update((details) => {
        if (!details) return details!;

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

      this.#setError(this.#transloco.translate('budget.forecastCreateError'));
      this.#logger.error('Error creating budget line', error);
    }
  }

  async updateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    // Optimistic update
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details!;

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
      await firstValueFrom(this.#budgetApi.updateBudgetLine$(data.id, data));

      // Clear any previous errors
      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      this.#setError(this.#transloco.translate('budget.forecastUpdateError'));
      this.#logger.error('Error updating budget line', error);
    }
  }

  async updateTransaction(id: string, data: TransactionUpdate): Promise<void> {
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details!;

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
      await firstValueFrom(this.#budgetApi.updateTransaction$(id, data));

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      this.#setError(
        this.#transloco.translate('budget.transactionUpdateError'),
      );
      this.#logger.error('Error updating transaction', error);
    }
  }

  async deleteBudgetLine(id: string): Promise<void> {
    // Optimistic update - remove the line and free its allocated transactions
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details!;

      return {
        ...details,
        budgetLines: details.budgetLines.filter((line) => line.id !== id),
        transactions: (details.transactions ?? []).map((tx) =>
          tx.budgetLineId === id ? { ...tx, budgetLineId: null } : tx,
        ),
      };
    });

    try {
      await firstValueFrom(this.#budgetApi.deleteBudgetLine$(id));

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      this.#setError(this.#transloco.translate('budget.forecastDeleteError'));
      this.#logger.error('Error deleting budget line', error);
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    // Optimistic update - remove the transaction
    this.#budgetDetailsResource.update((details) => {
      if (!details) return details!;

      return {
        ...details,
        transactions: details.transactions?.filter((tx) => tx.id !== id) ?? [],
      };
    });

    try {
      await firstValueFrom(this.#budgetApi.deleteTransaction$(id));

      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();

      this.#setError(
        this.#transloco.translate('budget.transactionDeleteError'),
      );
      this.#logger.error('Error deleting transaction', error);
    }
  }

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
        transactionData.transactionDate ?? formatLocalDate(new Date()),
      category: transactionData.category ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkedAt: transactionData.checkedAt ?? null,
    };

    this.#budgetDetailsResource.update((details) => {
      if (!details) return details!;

      return {
        ...details,
        transactions: [...(details.transactions ?? []), tempTransaction],
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetApi.createTransaction$({
          ...transactionData,
          checkedAt: transactionData.checkedAt ?? null,
        }),
      );

      this.#budgetDetailsResource.update((details) => {
        if (!details) return details!;

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

      this.#setError(
        this.#transloco.translate('budget.transactionCreateError'),
      );
      this.#logger.error('Error creating allocated transaction', error);
    }
  }

  async resetBudgetLineFromTemplate(id: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.#budgetApi.resetBudgetLineFromTemplate$(id),
      );

      this.#budgetDetailsResource.update((details) => {
        if (!details) return details!;

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

      const errorMessage = isApiError(error)
        ? this.#apiErrorLocalizer.localizeApiError(error)
        : this.#transloco.translate('budget.forecastResetError');
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

    if (this.#mutatingIds.has(id)) return false;

    const details = this.budgetDetails();
    if (!details) return false;

    const result = calculateBudgetLineToggle(id, {
      budgetLines: details.budgetLines,
      transactions: details.transactions ?? [],
    });

    if (!result) return false;

    this.#mutatingIds.add(id);

    this.#budgetDetailsResource.update((d) => {
      if (!d) return d!;
      return {
        ...d,
        budgetLines: result.updatedBudgetLines,
        transactions: result.updatedTransactions,
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetApi.toggleBudgetLineCheck$(id),
      );

      const updatedLine = response.data;
      this.#budgetDetailsResource.update((d) => {
        if (!d) return d!;
        return {
          ...d,
          budgetLines: d.budgetLines.map((line) =>
            line.id === id ? updatedLine : line,
          ),
        };
      });

      this.#clearError();
      return true;
    } catch (error) {
      this.reloadBudgetDetails();
      this.#setError(this.#transloco.translate('budget.forecastToggleError'));
      this.#logger.error('Error toggling budget line check', error);
      return false;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  async toggleTransactionCheck(id: string): Promise<void> {
    if (this.#mutatingIds.has(id)) return;

    const details = this.budgetDetails();
    if (!details) return;

    const result = calculateTransactionToggle(id, {
      budgetLines: details.budgetLines,
      transactions: details.transactions ?? [],
    });

    if (!result) return;

    this.#mutatingIds.add(id);

    this.#budgetDetailsResource.update((d) => {
      if (!d) return d!;
      return {
        ...d,
        transactions: result.updatedTransactions,
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetApi.toggleTransactionCheck$(id),
      );

      this.#budgetDetailsResource.update((d) => {
        if (!d) return d!;
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
      this.#setError(
        this.#transloco.translate('budget.transactionToggleError'),
      );
      this.#logger.error('Error toggling transaction check', error);
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  async checkAllAllocatedTransactions(budgetLineId: string): Promise<void> {
    if (this.#mutatingIds.has(budgetLineId)) return;

    const details = this.budgetDetails();
    if (!details) return;

    const uncheckedTransactions = (details.transactions ?? []).filter(
      (tx) =>
        tx.budgetLineId === budgetLineId &&
        tx.checkedAt === null &&
        !isTempId(tx.id),
    );
    if (uncheckedTransactions.length === 0) return;

    this.#mutatingIds.add(budgetLineId);

    const now = new Date().toISOString();
    const uncheckedIds = new Set(uncheckedTransactions.map((tx) => tx.id));
    this.#budgetDetailsResource.update((d) => {
      if (!d) return d!;
      return {
        ...d,
        budgetLines: d.budgetLines.map((line) =>
          line.id === budgetLineId
            ? { ...line, checkedAt: line.checkedAt ?? now, updatedAt: now }
            : line,
        ),
        transactions: (d.transactions ?? []).map((tx) =>
          uncheckedIds.has(tx.id) ? { ...tx, checkedAt: now } : tx,
        ),
      };
    });

    try {
      const response = await firstValueFrom(
        this.#budgetApi.checkBudgetLineTransactions$(budgetLineId),
      );

      const responseMap = new Map(response.data.map((tx) => [tx.id, tx]));
      this.#budgetDetailsResource.update((d) => {
        if (!d) return d!;
        return {
          ...d,
          transactions: (d.transactions ?? []).map((tx) => {
            const serverTx = responseMap.get(tx.id);
            return serverTx ? { ...tx, checkedAt: serverTx.checkedAt } : tx;
          }),
        };
      });
      this.#clearError();
    } catch (error) {
      this.reloadBudgetDetails();
      this.#setError(this.#transloco.translate('budget.checkAllError'));
      this.#logger.error('Error checking all allocated transactions', error);
    } finally {
      this.#mutatingIds.delete(budgetLineId);
    }
  }

  reloadBudgetDetails(): void {
    this.#budgetDetailsResource.reload();
    this.#clearError();
  }

  // ── 6. Private utility methods ──

  #setError(error: string): void {
    this.#state.errorMessage.set(error);
  }

  #clearError(): void {
    this.#state.errorMessage.set(null);
  }

  #prefetchAdjacentBudgets(prevId: string | null, nextId: string | null): void {
    const ids = [prevId, nextId].filter((id): id is string => id !== null);
    for (const id of ids) {
      this.#budgetApi.cache
        .prefetch(['budget', 'details', id], async () => {
          const response = await firstValueFrom(
            this.#budgetApi.getBudgetWithDetails$(id),
          );
          return {
            ...response.data.budget,
            budgetLines: response.data.budgetLines,
            transactions: response.data.transactions,
          };
        })
        .catch((error) => {
          this.#logger.warn(
            `[BudgetDetailsStore] Failed to prefetch budget ${id}`,
            error,
          );
        });
    }
  }
}
