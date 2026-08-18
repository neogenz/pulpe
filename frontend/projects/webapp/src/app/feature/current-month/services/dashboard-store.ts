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
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { cachedMutation, cachedResource } from 'ngx-ziflux';
import { filter, firstValueFrom, fromEvent } from 'rxjs';
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
  moneyDifference,
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
const MS_PER_DAY = 86_400_000;
// How far ahead of the clock a month's spending may run before the card says
// anything. Widest on the first day, closing to the floor on the last: a
// household's outflow is front-loaded, so against a linear clock a single debit
// on the 3rd outruns the month by definition. Early width is sample size, not
// indulgence — a verdict drawn from three days of evidence is noise, and
// printing it charges the user for recording, which this product cannot afford.
const PACE_TOLERANCE_FLOOR_PERCENT = 5;
const PACE_TOLERANCE_START_PERCENT = 25;

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

// Une horloge, pas un instant. Un `InjectionToken` avec `factory` est fourni
// dans l'injecteur racine : sa valeur est calculée une fois et gardée pour toute
// la durée de vie de l'application. Un `Date` y devenait donc l'heure du premier
// chargement — l'onglet laissé ouvert une nuit affichait « Jour 12 sur 31 » le
// 13, puis, passé le jour de paie, allait chercher le budget du mois précédent
// et l'annonçait comme le mois courant. Ni « Actualiser » ni le rafraîchissement
// au retour d'arrière-plan ne le rattrapaient : tous deux rechargent la
// ressource avec les mêmes paramètres périmés.
export const DASHBOARD_NOW = new InjectionToken<() => Date>('DASHBOARD_NOW', {
  factory: () => () => new Date(),
});

/**
 * The id of what was written, or the localized reason nothing was. The id is
 * what makes the write reversible: without it the caller can confirm the
 * transaction but not take it back.
 */
export type AddTransactionOutcome =
  | { readonly transactionId: string }
  | { readonly reason: string };

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

  readonly #clock = inject(DASHBOARD_NOW);
  readonly #currentDate = signal(this.#clock());

  constructor() {
    // Le seul moment où l'on sait que l'utilisateur regarde à nouveau la page.
    // Ré-horodater ici suffit à corriger la dérive : la date alimente
    // `currentBudgetPeriod`, qui est le paramètre de la ressource, donc un
    // changement de mois déclenche de lui-même le rechargement.
    const document = inject(DOCUMENT);
    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.#currentDate.set(this.#clock()));
  }

  readonly payDayOfMonth = this.#userSettingsStore.payDayOfMonth;

  readonly currentBudgetPeriod = computed(() => {
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodForDate(this.#currentDate(), payDay);
  });

  // ── 3. Resources ──
  readonly #dashboardResource = cachedResource<
    DashboardData,
    { month: string; year: string }
  >({
    cache: this.#budgetApi.cache,
    cacheKey: (params) => ['budget', 'dashboard', params.month, params.year],
    params: () => {
      // "Pas encore prête" plutôt qu'une supposition : sans jour de paie la
      // période retombe sur le mois calendaire, et la page cacherait un mois
      // faux sans même afficher de spinner.
      //
      // C'est la ressource qui dit si les réglages sont connus, jamais la
      // valeur : `payDayOfMonth` vaut légitimement `null` pour qui suit le
      // calendrier, et `isLoading` est un `isInitialLoading` qui retombe à
      // `false` dès que la requête ÉCHOUE. Un échec ne repart pas d'ici : il
      // remonte dans `error`.
      if (this.#userSettingsStore.settings() === undefined) return undefined;
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

  // Les figures de la page, pas tout ce qui vole : l'historique n'alimente que
  // des blocs repliés, il a sa propre lecture d'échec et chaque graphique son
  // propre état.
  readonly isLoading = computed(
    () => this.#dashboardResource.isLoading() || this.#isSettingsLoading(),
  );
  // Readable on its own for the one caller that has to wait for history: the
  // refresh confirmation, which would otherwise judge the outcome before the
  // slower half answered.
  readonly isHistoryLoading = computed(() => this.#historyResource.isLoading());
  // Rendered as a full-screen "could not load" card, so it says one thing only:
  // the dashboard could not be fetched. Settings count, since the request above
  // never fires without them. A refused mutation returns its own reason.
  readonly error = computed(
    () => this.#dashboardResource.error() ?? this.#userSettingsStore.error(),
  );
  // One card renders every way a fetch can fail. Only a transport failure — no
  // HTTP status and no code — is a connection problem; every other failure
  // arrives carrying a reason the mutation localizer already knows how to name.
  readonly loadErrorMessage = computed(() => {
    const error = this.error();
    if (!error) return '';
    const isTransportFailure =
      !isApiError(error) || (error.status === 0 && !error.code);
    return isTransportFailure
      ? this.#transloco.translate('currentMonth.loadErrorMessage')
      : this.#apiErrorLocalizer.localizeApiError(error);
  });
  // Separate from `error`: history feeds two charts, so its failure must not
  // blank a page whose figures loaded. Readable here because both charts
  // collapse a failed fetch to `[]`, which they render as "no budgets yet".
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
    const now = this.#currentDate().getTime();
    const elapsed = now - start;
    // Les deux bornes sont des minuits inclusifs : une période de 31 jours ne
    // mesure que 30 jours d'écart entre elles, d'où le jour ajouté. Sans lui le
    // dernier jour est annoncé écoulé dès son matin.
    const total = end - start + MS_PER_DAY;
    if (total <= 0) return 100;
    const percentage = (elapsed / total) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  // Which day of the period today is, counted in calendar days rather than in
  // elapsed milliseconds: the bounds are local midnights, so dividing a duration
  // by 24h drifts across a DST change. Both ends inclusive, first day is day 1.
  readonly elapsedDayOfPeriod = computed(() => {
    const dates = this.periodDates();
    if (!dates) return 0;
    const startOfDay = (date: Date): number =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const elapsed =
      Math.round(
        (startOfDay(this.#currentDate()) - startOfDay(dates.startDate)) /
          MS_PER_DAY,
      ) + 1;
    const totalDays =
      Math.round(
        (startOfDay(dates.endDate) - startOfDay(dates.startDate)) / MS_PER_DAY,
      ) + 1;
    return Math.min(Math.max(elapsed, 1), Math.max(totalDays, 1));
  });

  readonly budgetConsumedPercentage = computed(() => {
    const available = this.totalAvailable();
    const expenses = this.totalExpenses();
    if (available <= 0) return expenses > 0 ? 100 : 0;
    const percentage = (expenses / available) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  // What has actually gone out, as opposed to `totalExpenses`, which is envelope
  // logic and therefore mostly the plan. Counts a pointed outflow line at
  // `max(line.amount, consumed)`, an unpointed one at its pointed allocated
  // transactions only, free pointed transactions on top, savings included.
  // Shared with the budget-detail page, so there is no formula to mirror to iOS.
  readonly realizedExpenses = computed<number>(() =>
    BudgetFormulas.calculateRealizedExpenses(
      this.budgetLines(),
      this.transactions(),
    ),
  );

  readonly realizedPercentage = computed(() => {
    const available = this.totalAvailable();
    const realized = this.realizedExpenses();
    if (available <= 0) return realized > 0 ? 100 : 0;
    const percentage = (realized / available) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  // L'épargne pointée rattachée à aucune ligne. `calculateRealizedSavings`
  // l'écarte délibérément — elle fausserait le total confirmé d'un objectif — et
  // les deux lecteurs d'ici la veulent. Hors du verdict de rythme, qui n'admet
  // que des `expense`.
  readonly #freeSavingsRealized = computed<number>(() =>
    this.transactions()
      .filter(
        (tx) =>
          tx.kind === 'saving' && tx.checkedAt != null && !tx.budgetLineId,
      )
      .reduce((sum, tx) => sum + tx.amount, 0),
  );

  // What the plan did not know about: money spent outside every envelope, plus
  // the part of an envelope spent beyond what it reserved. Realized outflow
  // cannot serve here — a pointed prévision counts in full the day it lands, so
  // the verdict would follow the plan rather than the behaviour. Savings are
  // out: money set aside is not money spent.
  readonly #unplannedSpending = computed<number>(() => {
    const consumedByLine = new Map<string, number>();
    let freeSpending = 0;
    for (const tx of this.transactions()) {
      if (tx.checkedAt == null || tx.kind !== 'expense') continue;
      if (!tx.budgetLineId) {
        freeSpending += tx.amount;
        continue;
      }
      consumedByLine.set(
        tx.budgetLineId,
        (consumedByLine.get(tx.budgetLineId) ?? 0) + tx.amount,
      );
    }
    let overspend = 0;
    for (const line of this.budgetLines()) {
      if (line.kind !== 'expense') continue;
      overspend += Math.max(
        0,
        (consumedByLine.get(line.id) ?? 0) - line.amount,
      );
    }
    return freeSpending + overspend;
  });

  // What the plan left free, read off the plan rather than off `totalExpenses`.
  // That total is an envelope figure: it already absorbs free transactions and
  // envelope overshoot, which is precisely the money being measured against it,
  // so using it would net the numerator out of its own denominator.
  readonly #plannedMargin = computed<number>(() => {
    let plannedOutflow = 0;
    for (const line of this.budgetLines()) {
      if (isOutflowKind(line.kind)) plannedOutflow += line.amount;
    }
    return this.totalAvailable() - plannedOutflow;
  });

  readonly paceStatus = computed<'on-track' | 'tight' | 'within-plan'>(() => {
    // Nothing beyond the plan is not an absence of evidence — it is the good
    // answer, and the common one. Said out loud, never folded into a
    // "cannot tell yet".
    const unplanned = this.#unplannedSpending();
    if (moneyDifference(unplanned, 0) === 0) return 'within-plan';
    const margin = this.#plannedMargin();
    if (moneyDifference(margin, 0) <= 0) return 'tight';
    const share = Math.round(Math.min(100, (unplanned / margin) * 100));
    const elapsed = this.timeElapsedPercentage();
    const tolerance =
      PACE_TOLERANCE_FLOOR_PERCENT +
      ((PACE_TOLERANCE_START_PERCENT - PACE_TOLERANCE_FLOOR_PERCENT) *
        (100 - elapsed)) /
        100;
    return share <= elapsed + tolerance ? 'on-track' : 'tight';
  });

  // A month passes its ceiling two ways, and they are not the same news: a plan
  // asking for more than the month brings is a planning problem with nothing
  // gone wrong yet, and only the other one is real overspending.
  readonly isPlanBeyondAvailable = computed<boolean>(
    () => moneyDifference(this.#plannedMargin(), 0) < 0,
  );

  // Whether the month has anything in its ledger at all — not whether anything
  // has gone out. An income, or an expense recorded but not yet pointed, is
  // something the user saisi, and the card beside this one lists it.
  readonly hasRecordedActivity = computed<boolean>(
    () =>
      this.transactions().length > 0 ||
      this.budgetLines().some((line) => line.checkedAt != null),
  );

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
  // income, never by checking it: `toggleBudgetLineCheck` refuses that shape
  // with a 422, so listing it under "à pointer" would offer a button that
  // cannot succeed. Deleting the goal nulls the column (`ON DELETE SET NULL`)
  // and the line becomes pointable again, deliberately.
  readonly #pointableForecasts = computed<BudgetLine[]>(() =>
    this.budgetLines().filter(
      (line) =>
        (line.recurrence === 'fixed' || line.recurrence === 'one_off') &&
        !line.sourceSavingsGoalId,
    ),
  );

  // Sorted, because the card shows five: the truncation has to swallow the
  // least consequential part of the list, which API order cannot promise.
  // Outflow leads — the card sits under a hero that partitions spending — then
  // the largest amounts. Sorted on what the row prints, never on what the line
  // planned: allocation makes those diverge, and the reader only sees the first.
  readonly uncheckedForecasts = computed<BudgetLine[]>(() => {
    const consumptions = this.consumptions();
    const remainingOf = (line: BudgetLine): number =>
      Math.max(0, consumptions.get(line.id)?.remaining ?? line.amount);
    return this.#pointableForecasts()
      .filter((line) => line.checkedAt === null)
      .toSorted(
        (a, b) =>
          Number(isOutflowKind(b.kind)) - Number(isOutflowKind(a.kind)) ||
          remainingOf(b) - remainingOf(a),
      );
  });

  // The denominator the block's subtitle needs: "10" alone reads as a backlog
  // with no end, "10 sur 30" as a month two thirds done.
  readonly forecastsTotalCount = computed(
    () => this.#pointableForecasts().length,
  );

  readonly consumptions = computed<Map<string, BudgetLineConsumption>>(() =>
    calculateAllConsumptions(this.budgetLines(), this.transactions()),
  );

  // The chart draws "Dépenses" and "Épargne" as two bars of one month, so they
  // have to be disjoint. `totalExpenses` is not: it counts every outflow line,
  // savings included, because it answers `available - totalExpenses`. Subtracted
  // here rather than in the chart, so the tooltip, the axis and the aria
  // sentence cannot disagree.
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
      .toReversed()
      .map((b) => ({ ...b, expenses: Math.max(0, b.expenses - b.savings) }));
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

  // Goal progress, plus the transfers this page's own FAB records. The formula
  // is the savings twin of `realizedExpenses` and skips free transactions on
  // purpose, so an unlinked saving cannot contaminate a goal's confirmed total
  // — right for a goal, wrong for a card that says "Tu as mis de côté", hence
  // the second term.
  readonly totalSavingsRealized = computed<number>(
    () =>
      BudgetFormulas.calculateRealizedSavings(
        this.budgetLines(),
        this.transactions(),
      ) + this.#freeSavingsRealized(),
  );

  // Counted the way the amount beside it is counted, or the card contradicts
  // itself: a line has met its plan when it is pointed, or when what it
  // consumed covers it — the two branches `calculateRealizedSavings` uses.
  readonly savingsCheckedCount = computed<number>(() => {
    const consumedByLine = new Map<string, number>();
    for (const tx of this.transactions()) {
      if (tx.kind !== 'saving' || tx.checkedAt == null || !tx.budgetLineId) {
        continue;
      }
      consumedByLine.set(
        tx.budgetLineId,
        (consumedByLine.get(tx.budgetLineId) ?? 0) + tx.amount,
      );
    }
    const shortfalls: number[] = [];
    let met = 0;
    for (const line of this.budgetLines()) {
      if (line.kind !== 'saving') continue;
      const consumed = consumedByLine.get(line.id) ?? 0;
      if (line.checkedAt !== null || consumed >= line.amount) {
        met += 1;
        continue;
      }
      shortfalls.push(line.amount - consumed);
    }
    // An unallocated transfer counts in the amount printed beside this tally,
    // and the quick-add form here cannot attach one to a line — ignoring it
    // would keep every transfer recorded on this screen out of the count. It
    // covers the cheapest shortfalls first: nothing says which prévision the
    // money was meant for, and that order credits the most of what was set aside.
    let unallocated = this.#freeSavingsRealized();
    for (const shortfall of shortfalls.sort((a, b) => a - b)) {
      if (unallocated < shortfall) break;
      unallocated -= shortfall;
      met += 1;
    }
    return met;
  });

  // The count above says "mise de côté", which money answers. "C'est fait pour
  // ce mois" is stricter — nothing left to do — and only pointing answers it: a
  // line its transactions cover still waits in the list beside this card.
  readonly areSavingsFullyPointed = computed<boolean>(() =>
    this.budgetLines()
      .filter((line) => line.kind === 'saving')
      .every((line) => line.checkedAt !== null),
  );

  readonly savingsTotalCount = computed<number>(
    () => this.budgetLines().filter((line) => line.kind === 'saving').length,
  );

  // ── 5. Mutations ──
  // Built around THIS call's sink rather than shared: `cachedMutation` gates
  // onSuccess/onError latest-wins, so a signal on `this` would hand one call the
  // other's verdict. The cell lives in the call frame — see `addTransaction`.
  readonly #addTransactionMutation = (
    succeed: (transactionId: string) => void,
    fail: (message: string) => void,
  ) =>
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
        succeed(response.data.id);
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
    // Ré-horodater avant de recharger : sans cela « Actualiser » redemande au
    // serveur exactement le mois périmé qu'il affiche déjà.
    this.#currentDate.set(this.#clock());
    // Les réglages d'abord, parce qu'ils commandent la requête suivante : leur
    // échec est une des façons dont cette page tombe en erreur, et le bouton de
    // la carte d'erreur arrive ici.
    this.#userSettingsStore.reload();
    this.#dashboardResource.reload();
    this.#historyResource.reload();
  }

  async addTransaction(
    transactionData: TransactionCreate,
  ): Promise<AddTransactionOutcome> {
    let outcome: AddTransactionOutcome = {
      reason: this.#transloco.translate('currentMonth.addError'),
    };
    const mutation = this.#addTransactionMutation(
      (transactionId) => {
        outcome = { transactionId };
      },
      (message) => {
        outcome = { reason: message };
      },
    );
    await mutation.mutate(transactionData);
    return outcome;
  }

  // The reversal behind the confirmation toast, on the same terms as
  // `uncheckBudgetLine`: the caller has just promised an undo, so a transaction
  // that is no longer here answers with a reason, never a silent success.
  /** Returns the localized reason on refusal, or `null` when it went through. */
  async deleteTransaction(transactionId: string): Promise<string | null> {
    const deleteFailed = () =>
      this.#transloco.translate('currentMonth.undoTransactionError');
    const removed = this.transactions().find((t) => t.id === transactionId);
    if (!removed) return deleteFailed();

    this.#patchTransactions((transactions) =>
      transactions.filter((t) => t.id !== transactionId),
    );

    try {
      await firstValueFrom(this.#budgetApi.deleteTransaction$(transactionId));
      for (const key of DASHBOARD_INVALIDATION_KEYS) {
        this.#budgetApi.cache.invalidate(key);
      }
      return null;
    } catch (error: unknown) {
      // Appended rather than spliced back at its index: `recentTransactions`
      // sorts by date, so position in this array carries nothing.
      this.#patchTransactions((transactions) => [...transactions, removed]);
      this.#logger.error('Delete transaction failed', {
        transactionId,
        error,
      });
      return isApiError(error)
        ? this.#apiErrorLocalizer.localizeApiError(error)
        : deleteFailed();
    }
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
  // than the `null` above: the caller has just promised an undo, so "there was
  // nothing left to undo" is an outcome to surface, not the silent success a
  // double tap on the check deserves.
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
  // The server refuses some toggles on business grounds and says why: reporting
  // "vérifie ta connexion" over a considered refusal sends the user to their
  // wifi for a rule the response spelled out. The generic line is the fallback.
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

  #patchTransactions(fn: (transactions: Transaction[]) => Transaction[]): void {
    this.#updateDashboard((data) => ({
      ...data,
      transactions: fn(data.transactions),
    }));
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
