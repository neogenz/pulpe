import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi } from '@core/budget';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { UserSettingsApi } from '@core/user-settings';
import { createRolloverLine } from '@core/budget/rollover/rollover-types';
import {
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  BudgetFormulas,
  getBudgetPeriodForDate,
} from 'pulpe-shared';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  type CurrentMonthState,
  type DashboardData,
  createInitialCurrentMonthInternalState,
} from './current-month-state';

@Injectable()
export class CurrentMonthStore {
  // ── 1. Dependencies ──
  readonly #budgetApi = inject(BudgetApi);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #invalidationService = inject(BudgetInvalidationService);

  // ── 2. State ──
  readonly #state = signal<CurrentMonthState>(
    createInitialCurrentMonthInternalState(),
  );

  readonly payDayOfMonth = this.#userSettingsApi.payDayOfMonth;

  /** Budget period derived from current date and user's pay cycle */
  readonly currentBudgetPeriod = computed(() => {
    const currentDate = this.#state().currentDate;
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodForDate(currentDate, payDay);
  });

  // ── 3. Resource ──
  readonly #dashboardResource = resource<
    DashboardData,
    { month: string; year: string; version: number }
  >({
    params: () => {
      const period = this.currentBudgetPeriod();
      return {
        month: period.month.toString().padStart(2, '0'),
        year: period.year.toString(),
        version: this.#invalidationService.version(),
      };
    },
    loader: async ({ params }) => this.#loadDashboardData(params),
  });

  // ── 4. Selectors ──
  readonly dashboardData = computed(() => {
    const resourceValue = this.#dashboardResource.value();
    if (resourceValue) return resourceValue;

    const period = this.currentBudgetPeriod();
    const month = period.month.toString().padStart(2, '0');
    const year = period.year.toString();
    const cached = this.#budgetApi.cache.get<DashboardData>([
      'budget',
      'dashboard',
      month,
      year,
    ]);
    return cached?.data ?? null;
  });

  readonly transactions = computed<Transaction[]>(
    () => this.dashboardData()?.transactions || [],
  );

  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

  /** Budget lines including a virtual rollover line for display */
  readonly displayBudgetLines = computed<BudgetLine[]>(() => {
    const lines = [...this.budgetLines()];
    const rollover = this.rolloverAmount();
    const budget = this.dashboardData()?.budget;

    if (rollover !== 0 && budget) {
      const rolloverLine = createRolloverLine({
        budgetId: budget.id,
        amount: rollover,
        month: budget.month,
        year: budget.year,
        previousBudgetId: budget.previousBudgetId,
      });

      lines.unshift(rolloverLine);
    }

    return lines;
  });

  readonly isSettingsLoading = computed(() =>
    this.#userSettingsApi.isLoading(),
  );

  /** Includes settings loading to prevent flash of incorrect period data */
  readonly isLoading = computed(
    () => this.#dashboardResource.isLoading() || this.isSettingsLoading(),
  );
  readonly hasValue = computed(() => this.#dashboardResource.hasValue());
  readonly error = computed(() => this.#dashboardResource.error());
  readonly status = computed(() => {
    const resourceStatus = this.#dashboardResource.status();
    if (resourceStatus === 'loading' && this.dashboardData()) {
      return 'reloading';
    }
    return resourceStatus;
  });

  /** SWR: true only on first load, false during background revalidation */
  readonly isInitialLoading = computed(() => {
    if (this.dashboardData()) return false;
    return (
      this.status() === 'loading' ||
      (this.isSettingsLoading() && !this.hasValue())
    );
  });

  readonly budgetDate = computed(() => this.#state().currentDate);

  readonly rolloverAmount = computed<number>(() => {
    const budget = this.dashboardData()?.budget;
    return budget?.rollover || 0;
  });

  readonly totalIncome = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    return BudgetFormulas.calculateTotalIncome(budgetLines, transactions);
  });

  /** Envelope-aware: only overspend above envelope amount impacts budget */
  readonly totalExpenses = computed<number>(() =>
    BudgetFormulas.calculateTotalExpensesWithEnvelopes(
      this.budgetLines(),
      this.transactions(),
    ),
  );

  readonly totalAvailable = computed<number>(() => {
    const totalIncome = this.totalIncome();
    const rollover = this.rolloverAmount();
    return BudgetFormulas.calculateAvailable(totalIncome, rollover);
  });

  readonly remaining = computed<number>(() => {
    const available = this.totalAvailable();
    const expenses = this.totalExpenses();
    return BudgetFormulas.calculateRemaining(available, expenses);
  });

  // ── 5. Mutations ──
  refreshData(): void {
    if (!this.isLoading()) {
      this.#dashboardResource.reload();
    }
  }

  setCurrentDate(date: Date): void {
    this.#state.update((state) => ({
      ...state,
      currentDate: new Date(date),
    }));
  }

  async addTransaction(transactionData: TransactionCreate): Promise<void> {
    return this.#performOptimisticMutation<Transaction>(
      () => this.#budgetApi.createTransaction$(transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: [...currentData.transactions, response],
      }),
    );
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    return this.#performOptimisticMutation(
      () => this.#budgetApi.deleteTransaction$(transactionId),
      (currentData) => ({
        ...currentData,
        transactions: currentData.transactions.filter(
          (t: Transaction) => t.id !== transactionId,
        ),
      }),
    );
  }

  async updateTransaction(
    transactionId: string,
    transactionData: TransactionUpdate,
  ): Promise<void> {
    return this.#performOptimisticMutation<Transaction>(
      () => this.#budgetApi.updateTransaction$(transactionId, transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: currentData.transactions.map((t: Transaction) =>
          t.id === transactionId ? response : t,
        ),
      }),
    );
  }

  // ── 6. Private utils ──
  async #performOptimisticMutation<T>(
    operation: () => Observable<{ data: T }>,
    updateData: (currentData: DashboardData, response: T) => DashboardData,
  ): Promise<void>;
  async #performOptimisticMutation(
    operation: () => Observable<void>,
    updateData: (currentData: DashboardData) => DashboardData,
  ): Promise<void>;
  async #performOptimisticMutation<T>(
    operation: () => Observable<{ data: T } | void>,
    updateData: (currentData: DashboardData, response?: T) => DashboardData,
  ): Promise<void> {
    const originalData = this.#dashboardResource.value();

    try {
      const response = await firstValueFrom(operation());

      const currentData = this.#dashboardResource.value();
      if (currentData && currentData.budget) {
        const responseData =
          response && typeof response === 'object' && 'data' in response
            ? response.data
            : undefined;
        const updatedData = updateData(currentData, responseData);

        const rollover = updatedData.budget?.rollover || 0;
        const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
          updatedData.budgetLines,
          updatedData.transactions,
          rollover,
        );

        this.#dashboardResource.set({
          ...updatedData,
          budget: {
            ...currentData.budget,
            endingBalance: metrics.endingBalance,
          },
        });

        const budgetId = currentData.budget.id;
        const updatedBudget = await firstValueFrom(
          this.#budgetApi.getBudgetById$(budgetId),
        );

        const latestData = this.#dashboardResource.value();
        if (latestData && latestData.budget && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: {
              ...updatedBudget,
              rollover: latestData.budget.rollover,
              previousBudgetId: latestData.budget.previousBudgetId,
            },
          });
        }
      }
    } catch (error) {
      if (originalData) {
        this.#dashboardResource.set(originalData);
      } else {
        this.refreshData();
      }
      throw error;
    }
  }

  async toggleBudgetLineCheck(budgetLineId: string): Promise<void> {
    const originalData = this.#dashboardResource.value();
    if (!originalData) return;

    const budgetLine = originalData.budgetLines.find(
      (line) => line.id === budgetLineId,
    );
    if (!budgetLine) return;

    const newCheckedAt =
      budgetLine.checkedAt === null ? new Date().toISOString() : null;

    this.#dashboardResource.set({
      ...originalData,
      budgetLines: originalData.budgetLines.map((line) =>
        line.id === budgetLineId ? { ...line, checkedAt: newCheckedAt } : line,
      ),
    });

    try {
      await firstValueFrom(
        this.#budgetApi.toggleBudgetLineCheck$(budgetLineId),
      );
    } catch (error) {
      this.#dashboardResource.set(originalData);
      throw error;
    }
  }

  async toggleTransactionCheck(transactionId: string): Promise<void> {
    const originalData = this.#dashboardResource.value();
    if (!originalData) return;

    const transaction = originalData.transactions.find(
      (tx) => tx.id === transactionId,
    );
    if (!transaction) return;

    const newCheckedAt =
      transaction.checkedAt === null ? new Date().toISOString() : null;

    this.#dashboardResource.set({
      ...originalData,
      transactions: originalData.transactions.map((tx) =>
        tx.id === transactionId ? { ...tx, checkedAt: newCheckedAt } : tx,
      ),
    });

    try {
      await firstValueFrom(
        this.#budgetApi.toggleTransactionCheck$(transactionId),
      );
    } catch (error) {
      this.#dashboardResource.set(originalData);
      throw error;
    }
  }

  async #loadDashboardData(params: {
    month: string;
    year: string;
  }): Promise<DashboardData> {
    const cacheKey: string[] = [
      'budget',
      'dashboard',
      params.month,
      params.year,
    ];
    const cached = this.#budgetApi.cache.get<DashboardData>(cacheKey);

    if (cached?.fresh) return cached.data;

    const freshData = this.#budgetApi.cache.deduplicate(cacheKey, async () => {
      const budget = await firstValueFrom(
        this.#budgetApi.getBudgetForMonth$(params.month, params.year),
      );

      if (!budget) {
        const empty: DashboardData = {
          budget: null,
          transactions: [],
          budgetLines: [],
        };
        return empty;
      }

      // Reuse details already prefetched by PreloadService or BudgetDetailsStore
      const detailsCached = this.#budgetApi.cache.get<{
        budgetLines: BudgetLine[];
        transactions: Transaction[];
        rollover: number;
        previousBudgetId: string | null;
      }>(['budget', 'details', budget.id]);

      if (detailsCached?.fresh) {
        const details = detailsCached.data;
        const result: DashboardData = {
          budget: {
            ...budget,
            rollover: details.rollover,
            previousBudgetId: details.previousBudgetId,
          },
          transactions: details.transactions,
          budgetLines: details.budgetLines,
        };
        return result;
      }

      const response = await firstValueFrom(
        this.#budgetApi.getBudgetWithDetails$(budget.id),
      );

      const result: DashboardData = {
        budget: response.data.budget,
        transactions: response.data.transactions,
        budgetLines: response.data.budgetLines,
      };
      return result;
    });

    return freshData;
  }
}
