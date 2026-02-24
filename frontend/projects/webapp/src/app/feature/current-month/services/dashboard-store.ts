import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetApi } from '@core/budget';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { UserSettingsApi } from '@core/user-settings';
import { ApiClient } from '@core/api/api-client';
import {
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  BudgetFormulas,
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  budgetSparseListResponseSchema,
} from 'pulpe-shared';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  type DashboardState,
  type DashboardData,
  createInitialDashboardState,
} from './dashboard-state';

export interface HistoryDataPoint {
  id: string;
  month: number;
  year: number;
  income: number;
  expenses: number;
  savings: number;
}

export interface UpcomingMonthForecast {
  month: number;
  year: number;
  hasBudget: boolean;
  income: number | null;
  expenses: number | null;
  savings: number | null;
}

@Injectable()
export class DashboardStore {
  // ── 1. Dependencies ──
  readonly #budgetApi = inject(BudgetApi);
  readonly #apiClient = inject(ApiClient);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #invalidationService = inject(BudgetInvalidationService);

  // ── 2. State ──
  readonly #state = signal<DashboardState>(createInitialDashboardState());

  readonly payDayOfMonth = this.#userSettingsApi.payDayOfMonth;

  /** Budget period derived from current date and user's pay cycle */
  readonly currentBudgetPeriod = computed(() => {
    const currentDate = this.#state().currentDate;
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodForDate(currentDate, payDay);
  });

  // ── 3. Resources ──
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

  readonly #historyResource = resource<HistoryDataPoint[], { version: number }>(
    {
      params: () => ({
        version: this.#invalidationService.version(),
      }),
      loader: async () => this.#loadHistoryData(),
    },
  );

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

  readonly recentTransactions = computed<Transaction[]>(() => {
    const txs = this.transactions();
    return [...txs]
      .sort(
        (a, b) =>
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime(),
      )
      .slice(0, 5);
  });

  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

  readonly isSettingsLoading = computed(() =>
    this.#userSettingsApi.isLoading(),
  );

  readonly isLoading = computed(
    () =>
      this.#dashboardResource.isLoading() ||
      this.isSettingsLoading() ||
      this.#historyResource.isLoading(),
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

  readonly isInitialLoading = computed(() => {
    if (this.dashboardData()) return false;
    return (
      this.status() === 'loading' ||
      (this.isSettingsLoading() && !this.hasValue())
    );
  });

  readonly budgetDate = computed(() => this.#state().currentDate);

  readonly periodDates = computed(() => {
    const period = this.currentBudgetPeriod();
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodDates(period.month, period.year, payDay);
  });

  readonly timeElapsedPercentage = computed(() => {
    const dates = this.periodDates();
    if (!dates) return 0;
    const start = dates.startDate.getTime();
    const end = dates.endDate.getTime();
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const elapsed = now.getTime() - start;
    const total = end - start;
    if (total <= 0) return 100;
    const percentage = (elapsed / total) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  readonly budgetConsumedPercentage = computed(() => {
    const available = this.totalAvailable();
    const expenses = this.totalExpenses();
    if (available <= 0) return expenses > 0 ? 100 : 0;
    const percentage = (expenses / available) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  readonly paceStatus = computed<'on-track' | 'tight'>(() => {
    const consumed = this.budgetConsumedPercentage();
    const elapsed = this.timeElapsedPercentage();
    return consumed <= elapsed + 5 ? 'on-track' : 'tight';
  });

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

  /** Unchecked recurring forecasts for the current month */
  readonly uncheckedForecasts = computed<BudgetLine[]>(() => {
    return this.budgetLines().filter(
      (line) =>
        (line.recurrence === 'fixed' || line.recurrence === 'one_off') &&
        line.checkedAt === null,
    );
  });

  /** Historical 6-month budget data for chart */
  readonly historyData = computed<HistoryDataPoint[]>(() => {
    const all = this.#historyResource.value() ?? [];
    const current = this.currentBudgetPeriod();
    const currentScore = current.year * 12 + current.month;

    const pastAndPresent = all.filter(
      (b) => b.year * 12 + b.month <= currentScore,
    );
    const sorted = pastAndPresent.sort(
      (a, b) => b.year * 12 + b.month - (a.year * 12 + a.month),
    );
    return sorted.slice(0, 6).reverse(); // Oldest first
  });

  /** Forecast for upcoming 12 months */
  readonly upcomingBudgetsData = computed<UpcomingMonthForecast[]>(() => {
    const all = this.#historyResource.value() ?? [];
    const current = this.currentBudgetPeriod();
    const result: UpcomingMonthForecast[] = [];

    let nextMonth = current.month === 12 ? 1 : current.month + 1;
    let nextYear = current.month === 12 ? current.year + 1 : current.year;

    for (let i = 0; i < 12; i++) {
      const budget = all.find(
        (b) => b.month === nextMonth && b.year === nextYear,
      );
      result.push({
        month: nextMonth,
        year: nextYear,
        hasBudget: !!budget,
        income: budget ? budget.income : null,
        expenses: budget ? budget.expenses : null,
        savings: budget ? budget.savings : null,
      });

      nextMonth++;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }
    }

    return result;
  });

  readonly totalSavingsPlanned = computed<number>(() =>
    this.budgetLines()
      .filter((line) => line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0),
  );

  readonly totalSavingsRealized = computed<number>(() =>
    this.transactions()
      .filter((tx) => tx.kind === 'saving')
      .reduce((sum, tx) => sum + tx.amount, 0),
  );

  // ── 5. Mutations ──
  refreshData(): void {
    if (!this.#dashboardResource.isLoading()) {
      this.#dashboardResource.reload();
    }
    if (!this.#historyResource.isLoading()) {
      this.#historyResource.reload();
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

  async #loadHistoryData(): Promise<HistoryDataPoint[]> {
    const cacheKey: string[] = ['budget', 'history'];
    const cached = this.#budgetApi.cache.get<HistoryDataPoint[]>(cacheKey);

    if (cached?.fresh) return cached.data;

    const freshData = this.#budgetApi.cache.deduplicate(cacheKey, async () => {
      // Fetch up to 24 budgets using sparse fields to cover past and future
      const response = await firstValueFrom(
        this.#apiClient.get$(
          '/budgets?fields=month,year,totalIncome,totalExpenses,totalSavings&limit=24',
          budgetSparseListResponseSchema,
        ),
      );

      return response.data.map((b) => ({
        id: b.id,
        month: b.month!,
        year: b.year!,
        income: b.totalIncome ?? 0,
        expenses: b.totalExpenses ?? 0,
        savings: b.totalSavings ?? 0,
      }));
    });

    return freshData;
  }
}
