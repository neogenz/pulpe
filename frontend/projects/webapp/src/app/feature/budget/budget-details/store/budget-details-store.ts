import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { cachedMutation, cachedResource } from 'ngx-ziflux';
import { BudgetCalculator, calculateAllConsumptions } from '@core/budget';
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
  type TransactionListResponse,
  type TransactionUpdate,
  BudgetFormulas,
} from 'pulpe-shared';

import { firstValueFrom, map } from 'rxjs';
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

const BUDGET_DETAIL_INVALIDATION_KEYS: string[][] = [
  ['budget', 'details'],
  ['budget', 'list'],
  ['budget', 'dashboard'],
  ['budget', 'history'],
];

@Injectable()
export class BudgetDetailsStore {
  // ── 1. Dependencies ──
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCalculator = inject(BudgetCalculator);
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
  readonly isStale = this.#budgetDetailsResource.isStale;

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

  readonly financialTotals = computed(() => {
    const lines = this.displayBudgetLines();
    const transactions = this.budgetDetails()?.transactions ?? [];
    const consumptionMap = calculateAllConsumptions(lines, transactions);

    const income = this.#budgetCalculator.calculatePlannedIncome(lines);
    let expenses = 0;
    let savings = 0;

    lines.forEach((line) => {
      const consumption = consumptionMap.get(line.id);
      const effectiveAmount = consumption
        ? Math.max(line.amount, consumption.consumed)
        : line.amount;

      switch (line.kind) {
        case 'expense':
          expenses += effectiveAmount;
          break;
        case 'saving':
          savings += effectiveAmount;
          break;
      }
    });

    const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
    const initialLivingAllowance = income - expenses - savings;
    const transactionImpact =
      this.#budgetCalculator.calculateActualTransactionsAmount(
        freeTransactions,
      );
    const remaining = initialLivingAllowance + transactionImpact;

    return { income, expenses, savings, remaining };
  });

  readonly checkedItemsCount = computed<number>(() => {
    const details = this.budgetDetails();
    if (!details) return 0;
    const lines = this.displayBudgetLines();
    const transactions = details.transactions;
    return [...lines, ...transactions].filter((item) => item.checkedAt != null)
      .length;
  });

  readonly totalItemsCount = computed<number>(() => {
    const details = this.budgetDetails();
    if (!details) return 0;
    const lines = this.displayBudgetLines();
    const transactions = details.transactions;
    return lines.length + transactions.length;
  });

  readonly totalBudgetLinesCount = computed<number>(
    () => this.displayBudgetLines().length,
  );

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

    const transactions = details.transactions;
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

  readonly #createBudgetLineMutation = cachedMutation<
    { budgetLine: BudgetLineCreate; tempId: string },
    { data: BudgetLine },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: ({ budgetLine }) =>
      this.#budgetApi.createBudgetLine$(budgetLine),
    onMutate: ({ budgetLine, tempId }) => {
      const previous = this.budgetDetails();
      const tempBudgetLine: BudgetLine = {
        ...budgetLine,
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        templateLineId: null,
        savingsGoalId: null,
        checkedAt: budgetLine.checkedAt ?? null,
      };
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: [...details.budgetLines, tempBudgetLine],
      }));
      return previous;
    },
    onSuccess: (response, { tempId }) => {
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: details.budgetLines.map((line) =>
          line.id === tempId ? response.data : line,
        ),
      }));
      this.#onFinancialMutationSuccess();
    },
    onError: (_err, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(this.#transloco.translate('budget.forecastCreateError'));
    },
  });

  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    await this.#createBudgetLineMutation.mutate({
      budgetLine,
      tempId: generateTempId(),
    });
  }

  readonly #updateBudgetLineMutation = cachedMutation<
    BudgetLineUpdate,
    { data: BudgetLine },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (data) => this.#budgetApi.updateBudgetLine$(data.id, data),
    onMutate: (data) => {
      const previous = this.budgetDetails();
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: details.budgetLines.map((line) =>
          line.id === data.id
            ? { ...line, ...data, updatedAt: new Date().toISOString() }
            : line,
        ),
      }));
      return previous;
    },
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (_err, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(this.#transloco.translate('budget.forecastUpdateError'));
    },
  });

  async updateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    await this.#updateBudgetLineMutation.mutate(data);
  }

  readonly #updateTransactionMutation = cachedMutation<
    { id: string; data: TransactionUpdate },
    { data: Transaction },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: ({ id, data }) => this.#budgetApi.updateTransaction$(id, data),
    onMutate: ({ id, data }) => {
      const previous = this.budgetDetails();
      this.#updateDetails((details) => ({
        ...details,
        transactions: details.transactions.map((tx) =>
          tx.id === id
            ? { ...tx, ...data, updatedAt: new Date().toISOString() }
            : tx,
        ),
      }));
      return previous;
    },
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (_err, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(
        this.#transloco.translate('budget.transactionUpdateError'),
      );
    },
  });

  async updateTransaction(id: string, data: TransactionUpdate): Promise<void> {
    await this.#updateTransactionMutation.mutate({ id, data });
  }

  readonly #deleteBudgetLineMutation = cachedMutation<
    string,
    void,
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (id) =>
      this.#budgetApi.deleteBudgetLine$(id).pipe(map(() => void 0 as void)),
    onMutate: (id) => {
      const previous = this.budgetDetails();
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: details.budgetLines.filter((line) => line.id !== id),
        transactions: details.transactions.map((tx) =>
          tx.budgetLineId === id ? { ...tx, budgetLineId: null } : tx,
        ),
      }));
      return previous;
    },
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (_err, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(this.#transloco.translate('budget.forecastDeleteError'));
    },
  });

  async deleteBudgetLine(id: string): Promise<void> {
    await this.#deleteBudgetLineMutation.mutate(id);
  }

  readonly #deleteTransactionMutation = cachedMutation<
    string,
    void,
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (id) =>
      this.#budgetApi.deleteTransaction$(id).pipe(map(() => void 0 as void)),
    onMutate: (id) => {
      const previous = this.budgetDetails();
      this.#updateDetails((details) => ({
        ...details,
        transactions: details.transactions.filter((tx) => tx.id !== id),
      }));
      return previous;
    },
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (_err, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(
        this.#transloco.translate('budget.transactionDeleteError'),
      );
    },
  });

  async deleteTransaction(id: string): Promise<void> {
    await this.#deleteTransactionMutation.mutate(id);
  }

  readonly #createAllocatedTransactionMutation = cachedMutation<
    { data: TransactionCreate; tempId: string },
    { data: Transaction },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: ({ data }) => this.#budgetApi.createTransaction$(data),
    onMutate: ({ data, tempId }) => {
      const previous = this.budgetDetails();
      const tempTransaction: Transaction = {
        ...data,
        id: tempId,
        budgetLineId: data.budgetLineId ?? null,
        transactionDate: data.transactionDate ?? formatLocalDate(new Date()),
        category: data.category ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkedAt: data.checkedAt ?? null,
      };
      this.#updateDetails((details) => ({
        ...details,
        transactions: [...details.transactions, tempTransaction],
      }));
      return previous;
    },
    onSuccess: (response, { tempId }) => {
      this.#updateDetails((details) => ({
        ...details,
        transactions: details.transactions.map((tx) =>
          tx.id === tempId ? response.data : tx,
        ),
      }));
      this.#onFinancialMutationSuccess();
    },
    onError: (_err, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(
        this.#transloco.translate('budget.transactionCreateError'),
      );
    },
  });

  async createAllocatedTransaction(
    transactionData: TransactionCreate,
  ): Promise<void> {
    await this.#createAllocatedTransactionMutation.mutate({
      data: transactionData,
      tempId: generateTempId(),
    });
  }

  readonly #resetBudgetLineMutation = cachedMutation<
    string,
    { data: BudgetLine },
    void
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (id) => this.#budgetApi.resetBudgetLineFromTemplate$(id),
    onSuccess: (response, id) => {
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: details.budgetLines.map((line) =>
          line.id === id ? response.data : line,
        ),
      }));
      this.#onFinancialMutationSuccess();
    },
    onError: (error) => {
      const errorMessage = isApiError(error)
        ? this.#apiErrorLocalizer.localizeApiError(error)
        : this.#transloco.translate('budget.forecastResetError');
      this.#setError(errorMessage);
      this.#logger.error('Error resetting budget line from template', error);
    },
  });

  async resetBudgetLineFromTemplate(id: string): Promise<void> {
    await this.#resetBudgetLineMutation.mutate(id);
  }

  readonly #toggleCheckMutation = cachedMutation<
    string,
    { data: BudgetLine },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (id) => this.#budgetApi.toggleBudgetLineCheck$(id),
    onMutate: (id) => {
      const details = this.budgetDetails();
      if (!details) return null;
      const result = calculateBudgetLineToggle(id, {
        budgetLines: details.budgetLines,
        transactions: details.transactions,
      });
      if (!result) return null;
      const previous = details;
      this.#updateDetails((d) => ({
        ...d,
        budgetLines: result.updatedBudgetLines,
        transactions: result.updatedTransactions,
      }));
      return previous;
    },
    onSuccess: (response, id) => {
      this.#updateDetails((d) => ({
        ...d,
        budgetLines: d.budgetLines.map((line) =>
          line.id === id ? response.data : line,
        ),
      }));
      this.#onFinancialMutationSuccess();
    },
    onError: (_err, _id, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(this.#transloco.translate('budget.forecastToggleError'));
    },
  });

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

    const lineExists = details.budgetLines.some((l) => l.id === id);
    if (!lineExists) return false;

    this.#mutatingIds.add(id);
    try {
      const result = await this.#toggleCheckMutation.mutate(id);
      return result !== undefined;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #toggleTransactionCheckMutation = cachedMutation<
    string,
    { data: Transaction },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (id) => this.#budgetApi.toggleTransactionCheck$(id),
    onMutate: (id) => {
      const details = this.budgetDetails();
      if (!details) return null;
      const result = calculateTransactionToggle(id, {
        budgetLines: details.budgetLines,
        transactions: details.transactions,
      });
      if (!result) return null;
      const previous = details;
      this.#updateDetails((d) => ({
        ...d,
        transactions: result.updatedTransactions,
      }));
      return previous;
    },
    onSuccess: (response, id) => {
      this.#updateDetails((d) => ({
        ...d,
        transactions: d.transactions.map((tx) =>
          tx.id === id ? response.data : tx,
        ),
      }));
      this.#onFinancialMutationSuccess();
    },
    onError: (_err, _id, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(
        this.#transloco.translate('budget.transactionToggleError'),
      );
    },
  });

  async toggleTransactionCheck(id: string): Promise<void> {
    if (this.#mutatingIds.has(id)) return;
    this.#mutatingIds.add(id);
    try {
      await this.#toggleTransactionCheckMutation.mutate(id);
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #checkAllAllocatedMutation = cachedMutation<
    string,
    TransactionListResponse,
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (budgetLineId) =>
      this.#budgetApi.checkBudgetLineTransactions$(budgetLineId),
    onMutate: (budgetLineId) => {
      const details = this.budgetDetails();
      if (!details) return null;
      const previous = details;
      const now = new Date().toISOString();
      const uncheckedIds = new Set(
        details.transactions
          .filter(
            (tx) =>
              tx.budgetLineId === budgetLineId &&
              tx.checkedAt === null &&
              !isTempId(tx.id),
          )
          .map((tx) => tx.id),
      );
      if (uncheckedIds.size === 0) return null;
      this.#updateDetails((d) => ({
        ...d,
        budgetLines: d.budgetLines.map((line) =>
          line.id === budgetLineId
            ? { ...line, checkedAt: line.checkedAt ?? now, updatedAt: now }
            : line,
        ),
        transactions: d.transactions.map((tx) =>
          uncheckedIds.has(tx.id) ? { ...tx, checkedAt: now } : tx,
        ),
      }));
      return previous;
    },
    onSuccess: (response) => {
      const responseMap = new Map(response.data.map((tx) => [tx.id, tx]));
      this.#updateDetails((d) => ({
        ...d,
        transactions: d.transactions.map((tx) => {
          const serverTx = responseMap.get(tx.id);
          return serverTx ? { ...tx, checkedAt: serverTx.checkedAt } : tx;
        }),
      }));
      this.#onFinancialMutationSuccess();
    },
    onError: (_err, _id, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#setError(this.#transloco.translate('budget.checkAllError'));
    },
  });

  async checkAllAllocatedTransactions(budgetLineId: string): Promise<void> {
    if (this.#mutatingIds.has(budgetLineId)) return;
    const details = this.budgetDetails();
    if (!details) return;
    const hasUnchecked = details.transactions.some(
      (tx) =>
        tx.budgetLineId === budgetLineId &&
        tx.checkedAt === null &&
        !isTempId(tx.id),
    );
    if (!hasUnchecked) return;
    this.#mutatingIds.add(budgetLineId);
    try {
      await this.#checkAllAllocatedMutation.mutate(budgetLineId);
    } finally {
      this.#mutatingIds.delete(budgetLineId);
    }
  }

  reloadBudgetDetails(): void {
    this.#budgetDetailsResource.reload();
    this.#clearError();
  }

  // ── 6. Private utility methods ──

  #updateDetails(
    fn: (details: BudgetDetailsViewModel) => BudgetDetailsViewModel,
  ): void {
    this.#budgetDetailsResource.update((details) => {
      // Early return when resource has no value — cast required by cachedResource.update() signature
      if (!details) return details as unknown as BudgetDetailsViewModel;
      return fn(details);
    });
  }

  #setError(error: string): void {
    this.#state.errorMessage.set(error);
  }

  #clearError(): void {
    this.#state.errorMessage.set(null);
  }

  #onFinancialMutationSuccess(): void {
    this.#clearError();
    this.#prefetchAdjacentBudgets(null, this.nextBudgetId());
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
