import {
  computed,
  effect,
  inject,
  Injectable,
  InjectionToken,
  signal,
  untracked,
} from '@angular/core';
import {
  BudgetApi,
  calculateAllConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { cachedMutation, cachedResource } from 'ngx-ziflux';
import { UserSettingsStore } from '@core/user-settings';
import {
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  BudgetFormulas,
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
} from 'pulpe-shared';
import {
  type DashboardData,
  type HistoryDataPoint,
  type UpcomingMonthForecast,
} from './dashboard-state';

const RECENT_TRANSACTIONS_LIMIT = 5;
const HISTORY_MONTHS_LIMIT = 6;
const UPCOMING_MONTHS_LIMIT = 12;
const PACE_TOLERANCE_PERCENT = 5;

const DASHBOARD_INVALIDATION_KEYS: string[][] = [
  ['budget', 'list'],
  ['budget', 'details'],
  ['budget', 'dashboard'],
  ['budget', 'history'],
];

export const DASHBOARD_NOW = new InjectionToken<Date>('DASHBOARD_NOW', {
  factory: () => new Date(),
});

@Injectable()
export class DashboardStore {
  // ── 1. Dependencies ──
  readonly #budgetApi = inject(BudgetApi);
  readonly #userSettingsStore = inject(UserSettingsStore);

  // ── 2. State ──
  readonly #pendingChecks = signal(new Set<string>());
  readonly pendingChecks = this.#pendingChecks.asReadonly();
  readonly #errorMessage = signal<string | null>(null);

  readonly #currentDate = inject(DASHBOARD_NOW);

  readonly payDayOfMonth = this.#userSettingsStore.payDayOfMonth;

  readonly currentBudgetPeriod = computed(() => {
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodForDate(this.#currentDate, payDay);
  });

  // ── 3. Resources ──
  readonly #dashboardResource = cachedResource<
    DashboardData,
    { month: string; year: string }
  >({
    cache: this.#budgetApi.cache,
    cacheKey: (params) => ['budget', 'dashboard', params.month, params.year],
    params: () => {
      const period = this.currentBudgetPeriod();
      return {
        month: period.month.toString().padStart(2, '0'),
        year: period.year.toString(),
      };
    },
    loader: ({ params }) =>
      this.#budgetApi.getDashboardData$(params.month, params.year),
  });

  readonly #historyResource = cachedResource<HistoryDataPoint[], object>({
    cache: this.#budgetApi.cache,
    cacheKey: ['budget', 'history'],
    loader: () => this.#budgetApi.getHistoryData$(),
  });

  // ── 4. Selectors ──
  readonly dashboardData = computed(
    () => this.#dashboardResource.value() ?? null,
  );

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
    this.#userSettingsStore.isLoading(),
  );

  readonly isLoading = computed(
    () =>
      this.#dashboardResource.isLoading() ||
      this.isSettingsLoading() ||
      this.#historyResource.isLoading(),
  );
  readonly hasValue = computed(() => this.#dashboardResource.hasValue());
  readonly error = computed(
    () => this.#dashboardResource.error() ?? this.#errorMessage(),
  );
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
      this.#dashboardResource.isInitialLoading() || this.isSettingsLoading()
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
    BudgetFormulas.calculateTotalSavings(this.budgetLines(), []),
  );

  readonly totalSavingsRealized = computed<number>(() =>
    BudgetFormulas.calculateTotalSavings(
      this.budgetLines().filter((line) => line.checkedAt !== null),
    ),
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
  readonly #addTransactionMutation = cachedMutation<
    TransactionCreate,
    { data: Transaction },
    DashboardData | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => DASHBOARD_INVALIDATION_KEYS,
    mutationFn: (data) => this.#budgetApi.createTransaction$(data),
    onSuccess: (response) => {
      this.#updateDashboard((current) => ({
        ...current,
        transactions: [...current.transactions, response.data],
      }));
    },
    onError: () => {
      this.#setError('transaction-add-failed');
    },
  });

  constructor() {
    effect(() => {
      const lines = this.budgetLines();
      const pending = this.#pendingChecks();
      if (pending.size === 0) return;

      const confirmed = new Set(
        [...pending].filter((id) => {
          const line = lines.find((l) => l.id === id);
          return line?.checkedAt !== null;
        }),
      );

      if (confirmed.size > 0) {
        untracked(() => {
          this.#pendingChecks.update((s) => {
            const next = new Set(s);
            confirmed.forEach((id) => next.delete(id));
            return next;
          });
        });
      }
    });
  }

  refreshData(): void {
    this.#clearError();
    if (!this.#dashboardResource.isLoading()) {
      this.#dashboardResource.reload();
    }
    if (!this.#historyResource.isLoading()) {
      this.#historyResource.reload();
    }
  }

  async addTransaction(transactionData: TransactionCreate): Promise<void> {
    await this.#addTransactionMutation.mutate(transactionData);
  }

  readonly #checkBudgetLineMutation = cachedMutation<
    string,
    { data: BudgetLine },
    void
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => DASHBOARD_INVALIDATION_KEYS,
    mutationFn: (budgetLineId) =>
      this.#budgetApi.toggleBudgetLineCheck$(budgetLineId),
    onMutate: (budgetLineId) => {
      this.#pendingChecks.update((s) => new Set([...s, budgetLineId]));
      this.#patchBudgetLineCheckedAt(budgetLineId, new Date().toISOString());
    },
    onError: (_err, budgetLineId) => {
      this.#pendingChecks.update((s) => {
        const next = new Set(s);
        next.delete(budgetLineId);
        return next;
      });
      this.#patchBudgetLineCheckedAt(budgetLineId, null);
    },
  });

  async checkBudgetLine(budgetLineId: string): Promise<void> {
    if (this.#pendingChecks().has(budgetLineId)) return;
    const budgetLine = this.budgetLines().find((l) => l.id === budgetLineId);
    if (!budgetLine || budgetLine.checkedAt !== null) return;
    this.#clearError();
    const result = await this.#checkBudgetLineMutation.mutate(budgetLineId);
    if (result === undefined) {
      this.#setError('check-failed');
    }
  }

  // ── 6. Private utils ──
  #updateDashboard(fn: (data: DashboardData) => DashboardData): void {
    this.#dashboardResource.update((data) => {
      if (!data) return data as unknown as DashboardData;
      return fn(data);
    });
  }

  #setError(message: string): void {
    this.#errorMessage.set(message);
  }

  #clearError(): void {
    this.#errorMessage.set(null);
  }

  #patchBudgetLineCheckedAt(
    budgetLineId: string,
    checkedAt: string | null,
  ): void {
    this.#updateDashboard((data) => ({
      ...data,
      budgetLines: data.budgetLines.map((line) =>
        line.id === budgetLineId ? { ...line, checkedAt } : line,
      ),
    }));
  }
}
