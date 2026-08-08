import {
  computed,
  inject,
  Service,
  InjectionToken,
  signal,
} from '@angular/core';
import {
  BudgetApi,
  calculateAllConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { cachedMutation, cachedResource } from 'ngx-ziflux';
import { firstValueFrom } from 'rxjs';
import { UserSettingsStore } from '@core/user-settings';
import {
  ANALYTICS_EVENTS,
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  API_ERROR_CODES,
  BudgetFormulas,
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  isOutflowKind,
} from 'pulpe-shared';
import { isApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { TranslocoService } from '@jsverse/transloco';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
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

const CHECK_INVALIDATION_KEYS: string[][] = [
  ['budget', 'dashboard'],
  ['budget', 'details'],
];

const WITHDRAWAL_ERROR_CODES = new Set<string>([
  API_ERROR_CODES.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE,
  API_ERROR_CODES.SAVINGS_GOAL_WITHDRAWAL_CONFLICT,
]);

export const DASHBOARD_NOW = new InjectionToken<Date>('DASHBOARD_NOW', {
  factory: () => new Date(),
});

@Service({ autoProvided: false })
export class DashboardStore {
  // ── 1. Dependencies ──
  readonly #budgetApi = inject(BudgetApi);
  readonly #savingsGoalApi = inject(SavingsGoalApi);
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #transloco = inject(TranslocoService);

  // ── 2. State ──
  readonly #pendingChecks = signal(new Set<string>());
  readonly pendingChecks = this.#pendingChecks.asReadonly();

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

  readonly #isSettingsLoading = computed(() =>
    this.#userSettingsStore.isLoading(),
  );

  readonly isLoading = computed(
    () =>
      this.#dashboardResource.isLoading() ||
      this.#isSettingsLoading() ||
      this.#historyResource.isLoading(),
  );
  readonly hasValue = computed(() => this.#dashboardResource.hasValue());
  // The page renders this as a full-screen "could not load" card, so it says one
  // thing only: the dashboard could not be fetched. A refused mutation travels
  // back through its own return value — see `addTransaction`.
  readonly error = computed(() => this.#dashboardResource.error());
  // Separate from `error` on purpose: history feeds two charts and nothing else,
  // so its failure must not blank a page whose main figures loaded fine. It has
  // to be readable somewhere, though — `historyData()` and `upcomingBudgetsData()`
  // both collapse a failed fetch to `[]`, and both charts read `[]` as "you have
  // no budgets yet". Three months of history became a tidy sentence saying the
  // user had none.
  readonly historyError = computed(() => this.#historyResource.error());
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
      this.#dashboardResource.isInitialLoading() || this.#isSettingsLoading()
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

  // `totalExpenses` applies envelope logic — `max(line.amount, consumed)` — so it
  // is mostly the PLAN: rent counts in full from the 1st. Comparing it to elapsed
  // time says nothing about behaviour. `realizedExpenses` sums the outflow
  // transactions actually recorded, which is the only figure that should grow
  // with the month, and the only one the pace verdict may be built on.
  readonly realizedExpenses = computed<number>(() =>
    this.transactions()
      .filter((tx) => isOutflowKind(tx.kind))
      .reduce((sum, tx) => sum + tx.amount, 0),
  );

  readonly realizedPercentage = computed(() => {
    const available = this.totalAvailable();
    const realized = this.realizedExpenses();
    if (available <= 0) return realized > 0 ? 100 : 0;
    const percentage = (realized / available) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  readonly paceStatus = computed<'on-track' | 'tight'>(() => {
    const realized = this.realizedPercentage();
    const elapsed = this.timeElapsedPercentage();
    return realized <= elapsed + PACE_TOLERANCE_PERCENT ? 'on-track' : 'tight';
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

  // A forecast funded by a savings goal is realized by recording the real
  // income, never by checking it: `toggleBudgetLineCheck` refuses exactly this
  // shape — `sourceSavingsGoalId` set and `checkedAt` still null — with a 422.
  // Listing it under "à pointer" handed the user a button that could not
  // succeed, so the list stops claiming it. Deleting the goal nulls the column
  // (`ON DELETE SET NULL`) and the line becomes pointable again, deliberately.
  readonly #pointableForecasts = computed<BudgetLine[]>(() =>
    this.budgetLines().filter(
      (line) =>
        (line.recurrence === 'fixed' || line.recurrence === 'one_off') &&
        !line.sourceSavingsGoalId,
    ),
  );

  readonly uncheckedForecasts = computed<BudgetLine[]>(() =>
    this.#pointableForecasts().filter((line) => line.checkedAt === null),
  );

  // The denominator the block's subtitle needs: "10" alone said how much work
  // was left without saying how much there was, so it read as a backlog with no
  // end rather than a month two thirds done.
  readonly forecastsTotalCount = computed(
    () => this.#pointableForecasts().length,
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
  // Built around THIS call's sink rather than shared: `cachedMutation` gates
  // onSuccess/onError latest-wins, so a signal on `this` would hand one call the
  // other's verdict. The cell lives in the call frame — see `addTransaction`.
  readonly #addTransactionMutation = (fail: (message: string) => void) =>
    cachedMutation<
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
        this.#postHogService.captureEvent(
          ANALYTICS_EVENTS.TRANSACTION_CREATED,
          {
            type: response.data.kind,
          },
        );
      },
      onError: (error) => {
        fail(
          isApiError(error)
            ? this.#apiErrorLocalizer.localizeApiError(error)
            : this.#transloco.translate('currentMonth.addError'),
        );
        // Un refus de retrait (PUL-329) veut dire que le solde affiché au moment
        // du choix ne vaut plus rien : la prochaine ouverture du formulaire doit
        // relire les options, jamais réafficher le disponible périmé.
        if (isApiError(error) && WITHDRAWAL_ERROR_CODES.has(error.code ?? '')) {
          this.#savingsGoalApi.cache.invalidate(['savings-goals']);
        }
      },
    });

  refreshData(): void {
    this.#dashboardResource.reload();
    this.#historyResource.reload();
  }

  /** Returns the localized reason on refusal, or `null` when it went through. */
  async addTransaction(
    transactionData: TransactionCreate,
  ): Promise<string | null> {
    let reason: string | null = null;
    const mutation = this.#addTransactionMutation((message) => {
      reason = message;
    });
    await mutation.mutate(transactionData);
    return reason;
  }

  // Plain async mutation — `cachedMutation` uses latest-wins for
  // onSuccess/onError callbacks, which would silently drop per-id
  // pending cleanup when toggles overlap. Each toggle's lifecycle must
  // complete independently.
  /** Returns the localized reason on refusal, or `null` when it went through. */
  async checkBudgetLine(budgetLineId: string): Promise<string | null> {
    if (this.#pendingChecks().has(budgetLineId)) return null;
    const budgetLine = this.budgetLines().find((l) => l.id === budgetLineId);
    if (!budgetLine || budgetLine.checkedAt !== null) return null;

    return this.#sendCheckToggle(
      budgetLineId,
      new Date().toISOString(),
      null,
      'currentMonth.updateError',
    );
  }

  // The reversal behind the confirmation toast. Same endpoint — the route is a
  // toggle — with the guards mirrored, but a no-op answers with a reason rather
  // than the `null` above: the caller has just promised the user an undo, so
  // "there was nothing left to undo" is an outcome to surface, not a silent
  // success the way a double tap on the check is.
  async uncheckBudgetLine(budgetLineId: string): Promise<string | null> {
    const undoFailed = () =>
      this.#transloco.translate('currentMonth.undoError');
    if (this.#pendingChecks().has(budgetLineId)) return undoFailed();
    const budgetLine = this.budgetLines().find((l) => l.id === budgetLineId);
    if (!budgetLine || budgetLine.checkedAt === null) return undoFailed();

    return this.#sendCheckToggle(
      budgetLineId,
      null,
      budgetLine.checkedAt,
      'currentMonth.undoError',
    );
  }

  // ── 6. Private utils ──
  // The server refuses some toggles on business grounds and says why. Reporting
  // "vérifie ta connexion" over a considered refusal sends the user to look at
  // their wifi for a rule the response already spelled out; the generic line is
  // the fallback for the failures that really are transport.
  async #sendCheckToggle(
    budgetLineId: string,
    optimisticCheckedAt: string | null,
    rollbackCheckedAt: string | null,
    transportErrorKey: string,
  ): Promise<string | null> {
    this.#pendingChecks.update((s) => new Set([...s, budgetLineId]));
    this.#patchBudgetLineCheckedAt(budgetLineId, optimisticCheckedAt);

    try {
      await firstValueFrom(
        this.#budgetApi.toggleBudgetLineCheck$(budgetLineId),
      );
      for (const key of CHECK_INVALIDATION_KEYS) {
        this.#budgetApi.cache.invalidate(key);
      }
      return null;
    } catch (error: unknown) {
      this.#patchBudgetLineCheckedAt(budgetLineId, rollbackCheckedAt);
      this.#logger.error('Toggle budget line check failed', {
        budgetLineId,
        error,
      });
      return isApiError(error)
        ? this.#apiErrorLocalizer.localizeApiError(error)
        : this.#transloco.translate(transportErrorKey);
    } finally {
      this.#pendingChecks.update((s) => {
        if (!s.has(budgetLineId)) return s;
        const next = new Set(s);
        next.delete(budgetLineId);
        return next;
      });
    }
  }

  #updateDashboard(fn: (data: DashboardData) => DashboardData): void {
    const current = this.#dashboardResource.value();
    if (!current) return;
    this.#dashboardResource.update(() => fn(current));
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
