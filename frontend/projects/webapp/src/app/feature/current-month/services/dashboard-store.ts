import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  resource,
  signal,
} from '@angular/core';
import {
  BudgetApi,
  calculateAllConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { UserSettingsApi } from '@core/user-settings';
import {
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  BudgetFormulas,
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
} from 'pulpe-shared';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  type DashboardData,
  type HistoryDataPoint,
  type UpcomingMonthForecast,
} from './dashboard-state';

const RECENT_TRANSACTIONS_LIMIT = 5;
const HISTORY_MONTHS_LIMIT = 6;
const UPCOMING_MONTHS_LIMIT = 12;
const PACE_TOLERANCE_PERCENT = 5;

export const DASHBOARD_NOW = new InjectionToken<Date>('DASHBOARD_NOW', {
  factory: () => new Date(),
});

@Injectable()
export class DashboardStore {
  // ── 1. Dependencies ──
  readonly #budgetApi = inject(BudgetApi);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #invalidationService = inject(BudgetInvalidationService);

  // ── 2. State ──
  readonly #pendingChecks = signal(new Set<string>());
  readonly pendingChecks = this.#pendingChecks.asReadonly();

  readonly #currentDate = inject(DASHBOARD_NOW);

  readonly payDayOfMonth = this.#userSettingsApi.payDayOfMonth;

  readonly currentBudgetPeriod = computed(() => {
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodForDate(this.#currentDate, payDay);
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
    loader: async ({ params }) =>
      firstValueFrom(
        this.#budgetApi.getDashboardData$(params.month, params.year),
      ),
  });

  readonly #historyResource = resource<HistoryDataPoint[], { version: number }>(
    {
      params: () => ({
        version: this.#invalidationService.version(),
      }),
      loader: async () => firstValueFrom(this.#budgetApi.getHistoryData$()),
    },
  );

  // ── 4. Selectors ──
  readonly dashboardData = computed(() => {
    const resourceValue = this.#dashboardResource.value();
    if (resourceValue) return resourceValue;

    const period = this.currentBudgetPeriod();
    const month = period.month.toString().padStart(2, '0');
    const year = period.year.toString();
    return this.#budgetApi.getDashboardCached(month, year);
  });

  readonly transactions = computed<Transaction[]>(
    () => this.dashboardData()?.transactions ?? [],
  );

  readonly recentTransactions = computed<Transaction[]>(() => {
    const txs = this.transactions();
    return txs
      .toSorted(
        (a, b) =>
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime(),
      )
      .slice(0, RECENT_TRANSACTIONS_LIMIT);
  });

  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines ?? [],
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
    const now = this.#currentDate.getTime();
    const elapsed = now - start;
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
    return consumed <= elapsed + PACE_TOLERANCE_PERCENT ? 'on-track' : 'tight';
  });

  readonly rolloverAmount = computed<number>(() => {
    const budget = this.dashboardData()?.budget;
    return budget?.rollover ?? 0;
  });

  readonly #metrics = computed(() =>
    BudgetFormulas.calculateAllMetrics(
      this.budgetLines(),
      this.transactions(),
      this.rolloverAmount(),
    ),
  );

  readonly totalIncome = computed<number>(() => this.#metrics().totalIncome);
  readonly totalExpenses = computed<number>(
    () => this.#metrics().totalExpenses,
  );
  readonly totalAvailable = computed<number>(() => this.#metrics().available);
  readonly remaining = computed<number>(() => this.#metrics().remaining);

  readonly uncheckedForecasts = computed<BudgetLine[]>(() =>
    this.budgetLines().filter(
      (line) =>
        (line.recurrence === 'fixed' || line.recurrence === 'one_off') &&
        line.checkedAt === null &&
        !this.#pendingChecks().has(line.id),
    ),
  );

  readonly consumptions = computed<Map<string, BudgetLineConsumption>>(() =>
    calculateAllConsumptions(this.budgetLines(), this.transactions()),
  );

  readonly historyData = computed<HistoryDataPoint[]>(() => {
    const all = this.#historyResource.value() ?? [];
    const current = this.currentBudgetPeriod();
    const currentScore = current.year * 12 + current.month;

    const pastAndPresent = all.filter(
      (b) => b.year * 12 + b.month <= currentScore,
    );
    return pastAndPresent
      .toSorted((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
      .slice(0, HISTORY_MONTHS_LIMIT)
      .toReversed();
  });

  readonly upcomingBudgetsData = computed<UpcomingMonthForecast[]>(() => {
    const all = this.#historyResource.value() ?? [];
    const current = this.currentBudgetPeriod();
    const result: UpcomingMonthForecast[] = [];

    let nextMonth = current.month === 12 ? 1 : current.month + 1;
    let nextYear = current.month === 12 ? current.year + 1 : current.year;

    for (let i = 0; i < UPCOMING_MONTHS_LIMIT; i++) {
      const budget = all.find(
        (b) => b.month === nextMonth && b.year === nextYear,
      );
      result.push({
        month: nextMonth,
        year: nextYear,
        hasBudget: !!budget,
        income: budget?.income ?? null,
        expenses: budget?.expenses ?? null,
        savings: budget?.savings ?? null,
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
    this.budgetLines()
      .filter((line) => line.kind === 'saving' && line.checkedAt !== null)
      .reduce((sum, line) => sum + line.amount, 0),
  );

  readonly savingsCheckedCount = computed<number>(
    () =>
      this.budgetLines().filter(
        (line) => line.kind === 'saving' && line.checkedAt !== null,
      ).length,
  );

  readonly savingsTotalCount = computed<number>(
    () => this.budgetLines().filter((line) => line.kind === 'saving').length,
  );

  // ── 5. Mutations ──
  refreshData(): void {
    if (!this.#dashboardResource.isLoading()) {
      this.#pendingChecks.set(new Set());
      this.#dashboardResource.reload();
    }
    if (!this.#historyResource.isLoading()) {
      this.#historyResource.reload();
    }
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

  async checkBudgetLine(budgetLineId: string): Promise<void> {
    if (this.#pendingChecks().has(budgetLineId)) return;

    const budgetLine = this.budgetLines().find((l) => l.id === budgetLineId);
    if (!budgetLine || budgetLine.checkedAt !== null) return;

    this.#pendingChecks.update((s) => new Set([...s, budgetLineId]));
    this.#patchBudgetLineCheckedAt(budgetLineId, new Date().toISOString());

    try {
      await firstValueFrom(
        this.#budgetApi.toggleBudgetLineCheck$(budgetLineId),
      );
      // Item stays in pendingChecks until resource reloads with checkedAt !== null.
      // Can't clean here — tap() already bumped version, resource is loading,
      // and removing from pendingChecks would cause flicker (see PUL-84).
      // Cleanup happens on refreshData() or store destruction.
    } catch (error) {
      this.#pendingChecks.update((s) => {
        const next = new Set(s);
        next.delete(budgetLineId);
        return next;
      });
      this.#patchBudgetLineCheckedAt(budgetLineId, null);
      throw error;
    }
  }

  // ── 6. Private utils ──
  #patchBudgetLineCheckedAt(
    budgetLineId: string,
    checkedAt: string | null,
  ): void {
    this.#dashboardResource.update((data) => {
      if (!data) return data;
      return {
        ...data,
        budgetLines: data.budgetLines.map((line) =>
          line.id === budgetLineId ? { ...line, checkedAt } : line,
        ),
      };
    });
    const current = this.#dashboardResource.value();
    if (current) this.#syncDashboardCache(current);
  }

  #syncDashboardCache(data: DashboardData): void {
    const period = this.currentBudgetPeriod();
    const month = period.month.toString().padStart(2, '0');
    const year = period.year.toString();
    this.#budgetApi.seedDashboardCache(month, year, data);
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
      if (currentData && currentData.budget) {
        const responseData =
          response && typeof response === 'object' && 'data' in response
            ? response.data
            : undefined;
        const updatedData = updateData(currentData, responseData);

        const rollover = updatedData.budget?.rollover ?? 0;
        const metrics = BudgetFormulas.calculateAllMetrics(
          updatedData.budgetLines,
          updatedData.transactions,
          rollover,
        );

        const withMetrics = {
          ...updatedData,
          budget: {
            ...currentData.budget,
            endingBalance: metrics.endingBalance,
          },
        };
        this.#dashboardResource.set(withMetrics);
        this.#syncDashboardCache(withMetrics);

        const budgetId = currentData.budget.id;
        const updatedBudget = await firstValueFrom(
          this.#budgetApi.getBudgetById$(budgetId),
        );

        const latestData = this.#dashboardResource.value();
        if (latestData && latestData.budget && updatedBudget) {
          const withBudget = {
            ...latestData,
            budget: {
              ...updatedBudget,
              rollover: latestData.budget.rollover,
              previousBudgetId: latestData.budget.previousBudgetId,
            },
          };
          this.#dashboardResource.set(withBudget);
          this.#syncDashboardCache(withBudget);
        }
      }
    } catch (error) {
      if (originalData) {
        this.#dashboardResource.set(originalData);
        this.#syncDashboardCache(originalData);
      } else {
        this.refreshData();
      }
      throw error;
    }
  }
}
