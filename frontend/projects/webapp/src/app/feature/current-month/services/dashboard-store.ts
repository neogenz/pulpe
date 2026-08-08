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
// anything. The band is widest on the first day and closes to the floor on the
// last, because a household's outflow is front-loaded — rent, insurance and the
// subscriptions all land in the first days — so against a linear clock a single
// debit on the 3rd outruns the month by definition. A flat band inverted its own
// meaning across the month: 5 points is unreachable on day 2, where the clock
// has elapsed 3%, and generous on day 25. Widening it early is not indulgence,
// it is the sample size: a verdict drawn from three days of evidence is noise,
// and printing it in amber charges the user for recording, which is the one
// behaviour this product cannot afford to discourage.
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
      // "Pas encore prête" plutôt qu'une supposition. Le jour de paie vaut
      // `null` tant que les réglages chargent, et sans lui la période retombe
      // sur le mois calendaire : le 28 janvier avec une paie au 27, la page
      // demandait, cachait et pouvait afficher janvier alors que l'utilisateur
      // est en février — sans spinner, puisque `isInitialLoading` s'éteint dès
      // qu'une donnée existe.
      if (this.payDayOfMonth() === null && this.#isSettingsLoading())
        return undefined;
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

  // Les figures de la page, pas tout ce qui vole. L'historique n'alimente que
  // les blocs repliés par défaut, et il désactivait « Actualiser » : le seul
  // bouton visible restait gris à cause d'une requête servant des cartes hors
  // écran, sans rien pour l'expliquer. Son échec a déjà sa propre lecture,
  // `historyError`, et chaque graphique son propre état.
  readonly isLoading = computed(
    () => this.#dashboardResource.isLoading() || this.#isSettingsLoading(),
  );
  readonly hasValue = computed(() => this.#dashboardResource.hasValue());
  // The page renders this as a full-screen "could not load" card, so it says one
  // thing only: the dashboard could not be fetched. A refused mutation travels
  // back through its own return value — see `addTransaction`.
  readonly error = computed(() => this.#dashboardResource.error());
  // One card renders every way that fetch can fail, and it used to say the same
  // sentence each time: a 403, a rate limit and a payload this client can no
  // longer parse all blamed the user's wifi and offered a retry that could not
  // help. Only a transport failure — no HTTP status and no code — is actually a
  // connection problem; every other failure arrives carrying a reason, and the
  // localizer that names it for the mutations works just as well here.
  readonly loadErrorMessage = computed(() => {
    const error = this.error();
    if (!error) return '';
    const isTransportFailure =
      !isApiError(error) || (error.status === 0 && !error.code);
    return isTransportFailure
      ? this.#transloco.translate('currentMonth.loadErrorMessage')
      : this.#apiErrorLocalizer.localizeApiError(error);
  });
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
    const now = this.#currentDate().getTime();
    const elapsed = now - start;
    // Les deux bornes sont des minuits inclusifs, donc une période de 31 jours
    // ne mesure que 30 jours d'écart entre elles. Le dénominateur amputé faisait
    // lire « 100 % écoulé » au matin du dernier jour, alors qu'il en restait un
    // entier, et desserrait la tolérance de rythme un jour trop tôt.
    const total = end - start + MS_PER_DAY;
    if (total <= 0) return 100;
    const percentage = (elapsed / total) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  // Which day of the period today is, counted from calendar days rather than
  // from elapsed milliseconds: the period bounds are local midnights, so a
  // duration divided by 24h drifts by an hour across a DST change and lands on
  // the wrong day for part of one day a year. Both ends inclusive, so the first
  // day of the period is day 1.
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

  // `totalExpenses` applies envelope logic — `max(line.amount, consumed)` — so it
  // is mostly the PLAN: rent counts in full from the 1st. Comparing it to elapsed
  // time says nothing about behaviour. This is what has actually gone out, and
  // the only figure the pace verdict may be built on.
  //
  // The dashboard used to sum outflow transactions and stop there, which made
  // pointing a prévision worth nothing: a month with 17 of 18 lines pointed read
  // "Dépensé 554" — the one free transaction — against "Engagé 3'947", under a
  // legend defining engagé as what the plan reserves "et que tu n'as pas encore
  // dépensé". The user had just said, seventeen times, that it had been spent.
  // `calculateRealizedExpenses` is the formula the budget-detail page has always
  // used: a pointed outflow line counts at `max(line.amount, consumed)`, an
  // unpointed one counts only its pointed allocated transactions, free pointed
  // transactions add on top, and `isOutflowKind` covers savings — everything
  // that lowers what is left. Two surfaces, one definition, no new formula and
  // so nothing to mirror to iOS.
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

  // The third state is the honest one, and it was missing. Pulpe has no bank
  // sync — every figure `realizedExpenses` sums is one the user typed — so a
  // month with nothing recorded scores 0% against an elapsed 25% and came out
  // "on-track". The page then said "Ton rythme tient." in bold, at the top, on
  // the strength of no evidence whatsoever, and said it more confidently the
  // longer the user stayed away. A verdict drawn from an empty ledger is not a
  // verdict; the card now says so and asks for the transaction that would make
  // one possible.
  // Savings leave the account, so they belong in what has gone out and in the
  // bar. They do not belong in this verdict, which says "tu dépenses plus vite
  // que le mois ne passe": a user who funds their savings on the 3rd has not
  // spent anything, and telling them otherwise charges them for the one habit
  // the product exists to build. Point a 1'500 savings line early against a
  // 5'000 month and the old numerator read 30% against 10% elapsed — amber, on
  // the strength of money the user deliberately put aside.
  // `totalSavingsRealized` alone does not remove every franc of savings from
  // the numerator: it is goal progress, and `calculateRealizedSavings`
  // deliberately skips free transactions, because an unlinked saving would
  // contaminate a goal's confirmed total. `calculateRealizedExpenses` has no
  // such exclusion — `isOutflowKind` sweeps free savings in with the rest. So a
  // 1'500 transfer recorded from this page's own FAB, which never carries a
  // budgetLineId, landed in the numerator and nothing took it back out: the
  // card turned amber and said "tu dépenses plus vite que le mois ne passe" on
  // the strength of money the user had just set aside. Same intent as the line
  // below, applied to the one bucket that formula cannot see.
  readonly #freeSavingsRealized = computed<number>(() =>
    this.transactions()
      .filter(
        (tx) =>
          tx.kind === 'saving' && tx.checkedAt != null && !tx.budgetLineId,
      )
      .reduce((sum, tx) => sum + tx.amount, 0),
  );

  // What the plan did not know about: money spent outside every envelope, plus
  // the part of an envelope spent beyond what it reserved.
  //
  // Realized outflow was the wrong numerator, whatever was subtracted from it.
  // A pointed prévision counts at its full amount the day it lands, so a 1'500
  // rent pointed on the 2nd scored 30% of the budget against 3% of elapsed
  // month and turned the card amber — for performing the gesture the list
  // beside it asks for "dès qu'elle passe sur ton compte". The verdict charged
  // the user for recording, which is the one behaviour this product cannot
  // discourage, and it did so on the plan rather than on behaviour.
  //
  // Savings are absent by the same rule as everywhere else on this card: money
  // set aside is not money spent.
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
    // answer, and it is the common one for most of a month. It gets said out
    // loud rather than folded into a "cannot tell yet".
    const unplanned = this.#unplannedSpending();
    if (unplanned === 0) return 'within-plan';
    const margin = this.#plannedMargin();
    if (margin <= 0) return 'tight';
    const share = Math.round(Math.min(100, (unplanned / margin) * 100));
    const elapsed = this.timeElapsedPercentage();
    const tolerance =
      PACE_TOLERANCE_FLOOR_PERCENT +
      ((PACE_TOLERANCE_START_PERCENT - PACE_TOLERANCE_FLOOR_PERCENT) *
        (100 - elapsed)) /
        100;
    return share <= elapsed + tolerance ? 'on-track' : 'tight';
  });

  // A month can pass its ceiling two ways, and they are not the same news. The
  // plan asking for more than the month brings is a planning problem: nothing
  // has gone wrong yet and the fix is in the budget. An affordable plan pushed
  // past the ceiling by what actually happened is the other one, and the only
  // one where something has really overspent.
  readonly isPlanBeyondAvailable = computed<boolean>(
    () => this.#plannedMargin() < 0,
  );

  // Whether the month has anything in its ledger at all. Realized outflow was
  // the wrong question: an income transaction, or an expense recorded but not
  // yet pointed, is something the user saisi — and a card answering "rien de
  // saisi ce mois" above a Transactions card listing it calls them a liar.
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

  // Sorted, because the card shows five of them and used to pick those five by
  // whatever order the API happened to return: a month with seventeen open
  // forecasts hid twelve on no stated rule, so the reader could not tell
  // whether the rent was among them.
  //
  // Amount alone was not the rule either. It put "Salaire net" and "13ème
  // salaire" in the top two rows — the card sits under a hero that partitions
  // spending, and its first screenful was money coming in. Outflow leads, and
  // inside each direction the largest amounts come first, which keeps what the
  // truncation swallows the least consequential part of the list.
  //
  // Sorted on what the row prints, not on what the line planned. Those diverge
  // the moment a transaction is allocated against a forecast: a 1'500 rent with
  // 1'400 already recorded renders "100" and used to sort above a 600 grocery
  // envelope rendering "600". The reader saw a descending column of amounts
  // that did not descend, and the cap at five hid lines by a size no longer on
  // screen — the one thing the hidden count exists to keep honest.
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

  // Same correction as `realizedExpenses`, and the same reason: this summed
  // checked saving lines and never looked at a transaction, so recording the
  // 500 transfer for a 500 saving line put "Dépensé 500" in the hero legend and
  // "Tu as mis de côté 0 CHF sur 500 prévus" three blocks below it, on one
  // screen. `calculateRealizedSavings` is the savings twin of the formula the
  // hero now uses — same envelope reading, filtered strictly to `saving`.
  // Goal progress plus the savings this page's own FAB records. A transfer
  // added here carries no budgetLineId, and `calculateRealizedSavings` skips
  // free transactions on purpose so an unlinked saving cannot contaminate a
  // goal's confirmed total — correct for a goal, wrong for a card titled
  // "Épargne du mois" whose sentence is "Tu as mis de côté". Without the second
  // term the card answered 0 for money the user had just put aside on this very
  // screen. The pace numerator reads this sum, so the franc is counted once.
  readonly totalSavingsRealized = computed<number>(
    () =>
      BudgetFormulas.calculateRealizedSavings(
        this.budgetLines(),
        this.transactions(),
      ) + this.#freeSavingsRealized(),
  );

  // Counted the way the amount beside it is counted. This filtered on
  // `line.checkedAt` alone while `calculateRealizedSavings` also credits an
  // unpointed line's checked transactions, so one card printed "0 sur 1 mises
  // de côté" directly above "Tu as mis de côté 400 CHF sur 1'000 prévus". A
  // line has met its plan when it is pointed or when what it consumed covers
  // it — the same two branches the formula uses.
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
    // An unallocated transfer already counts in the amount printed beside this
    // tally, and the quick-add form on this very page cannot attach one to a
    // line — so every transfer recorded here landed in the amount and in the
    // bar and never in the count: "0 sur 1 mise de côté" above "500 sur 500
    // prévus", over a bar at 100%. It covers the cheapest shortfalls first,
    // since nothing on screen says which prévision the money was meant for and
    // that order credits the user with the most of what they did put aside.
    let unallocated = this.#freeSavingsRealized();
    for (const shortfall of shortfalls.sort((a, b) => a - b)) {
      if (unallocated < shortfall) break;
      unallocated -= shortfall;
      met += 1;
    }
    return met;
  });

  // The count above says "mise de côté", and money answers that. "C'est fait
  // pour ce mois" says something stricter — that nothing is left to do — and
  // only pointing answers it: a line its transactions already cover still sits
  // in the list beside this card, waiting to be pointed.
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
    // Ré-horodater avant de recharger : sans cela « Actualiser » redemandait au
    // serveur exactement le mois périmé qu'il affichait déjà.
    this.#currentDate.set(this.#clock());
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
  // `uncheckBudgetLine`: the caller has just promised the user an undo, so a
  // transaction that is no longer here answers with a reason rather than the
  // silent success a repeated no-op deserves.
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
