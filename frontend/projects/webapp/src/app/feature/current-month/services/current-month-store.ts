import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { BudgetApi } from '@core/budget';
import { BudgetCache } from '@core/budget/budget-cache';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { TransactionApi } from '@core/transaction';
import { UserSettingsApi } from '@core/user-settings';
import { createRolloverLine } from '@core/rollover/rollover-types';
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
} from './current-month-state';
import { createInitialCurrentMonthInternalState } from './current-month-state';
import { createDashboardDataLoader } from './current-month-data-loader';

@Injectable()
export class CurrentMonthStore {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCache = inject(BudgetCache);
  readonly #transactionApi = inject(TransactionApi);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #invalidationService = inject(BudgetInvalidationService);

  readonly #state = signal<CurrentMonthState>(
    createInitialCurrentMonthInternalState(),
  );

  readonly payDayOfMonth = this.#userSettingsApi.payDayOfMonth;

  readonly currentBudgetPeriod = computed(() => {
    const currentDate = this.#state().currentDate;
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodForDate(currentDate, payDay);
  });

  readonly #loadDashboardData = createDashboardDataLoader(
    this.#budgetApi,
    this.#budgetCache,
  );

  readonly #dashboardResource = rxResource<
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
    stream: ({ params }) => this.#loadDashboardData(params),
  });

  readonly dashboardData = computed(() => this.#dashboardResource.value());

  readonly transactions = computed<Transaction[]>(
    () => this.dashboardData()?.transactions || [],
  );

  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

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

  readonly isLoading = computed(
    () => this.#dashboardResource.isLoading() || this.isSettingsLoading(),
  );
  readonly hasValue = computed(() => this.#dashboardResource.hasValue());
  readonly error = computed(() => this.#dashboardResource.error());
  readonly status = computed(() => this.#dashboardResource.status());

  readonly isInitialLoading = computed(
    () =>
      this.status() === 'loading' ||
      (this.isSettingsLoading() && !this.hasValue()),
  );

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

  // No mutation queue needed: the dashboard is a single-action-at-a-time view
  // with low concurrency risk. Toggle methods use snapshot-based rollback
  // for optimistic updates. CRUD mutations go through #performOptimisticMutation
  // which does a single atomic set() after API + server reconciliation.

  async addTransaction(transactionData: TransactionCreate): Promise<void> {
    return this.#performOptimisticMutation<Transaction>(
      () => this.#transactionApi.create$(transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: [...currentData.transactions, response],
      }),
    );
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    return this.#performOptimisticMutation(
      () => this.#transactionApi.remove$(transactionId),
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
      () => this.#transactionApi.update$(transactionId, transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: currentData.transactions.map((t: Transaction) =>
          t.id === transactionId ? response : t,
        ),
      }),
    );
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
      this.#invalidateCachedBudgetDetails();
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
      await firstValueFrom(this.#transactionApi.toggleCheck$(transactionId));
      this.#invalidateCachedBudgetDetails();
    } catch (error) {
      this.#dashboardResource.set(originalData);
      throw error;
    }
  }

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
      if (!currentData?.budget) return;

      const responseData =
        response && typeof response === 'object' && 'data' in response
          ? (response as { data: T }).data
          : undefined;
      const updatedData = updateData(currentData, responseData);

      // Fetch server-computed budget (endingBalance, etc.) after mutation is persisted.
      // The server budget already reflects the mutation, so local metrics
      // calculation is unnecessary — we use the authoritative server values.
      const serverBudget = await firstValueFrom(
        this.#budgetApi.getBudgetById$(currentData.budget.id),
      );

      // Single atomic set — avoids a race condition from two sequential set() calls
      // where a concurrent mutation could be overwritten between them.
      // Read latest data right before setting to preserve concurrent toggle updates.
      const latestData = this.#dashboardResource.value();
      if (!latestData?.budget) return;

      this.#dashboardResource.set({
        ...updatedData,
        budget: {
          ...(serverBudget ?? latestData.budget),
          rollover: latestData.budget.rollover,
          previousBudgetId: latestData.budget.previousBudgetId,
        },
      });

      this.#invalidateCachedBudgetDetails();
    } catch (error) {
      if (originalData) {
        this.#dashboardResource.set(originalData);
      } else {
        this.refreshData();
      }
      throw error;
    }
  }

  #invalidateCachedBudgetDetails(): void {
    const budgetId = this.dashboardData()?.budget?.id;
    if (budgetId) {
      this.#budgetCache.invalidateBudgetDetails(budgetId);
    }
  }
}
