import {
  computed,
  effect,
  inject,
  Service,
  LOCALE_ID,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { cachedMutation, cachedResource } from 'ngx-ziflux';
import { BudgetCalculator, calculateAllConsumptions } from '@core/budget';
import { BudgetApi } from '@core/budget/budget-api';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { isApiError } from '@core/api/api-error';
import { Logger } from '@core/logging/logger';
import { formatLocalDate } from '@core/date/format-local-date';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { UserSettingsStore } from '@core/user-settings';
import {
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineDeleteResponse,
  type BudgetLinePostponeResponse,
  type BudgetLineSavingsWithdrawalCreate,
  type BudgetLineSavingsWithdrawalDeleteQuery,
  type BudgetLineSavingsWithdrawalResponse,
  type BudgetLineSpreadCreate,
  type BudgetLineSpreadResponse,
  type BudgetLineUpdate,
  type BudgetPeriod,
  type SpreadFromExistingPeriod,
  type SpreadOccurrence,
  type Transaction,
  type TransactionCreate,
  type TransactionListResponse,
  type TransactionPostponeResponse,
  type TransactionUpdate,
  BudgetFormulas,
  compareBudgetPeriods,
  getBudgetPeriodForDate,
} from 'pulpe-shared';
import type {
  SpreadOccurrenceViewModel,
  SpreadTracker,
} from '@ui/spread-occurrences-list';

import { firstValueFrom, map } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { type BudgetDetailsViewModel } from '../view-models/budget-details.view-model';
import {
  calculateBudgetLineToggle,
  calculateTransactionToggle,
} from './budget-details-check.utils';
import { normalizeText } from '../view-models/budget-item-constants';
import { offsetMonth } from '../budget-line/create/spread.utils';
import { createInitialBudgetDetailsState } from './budget-details-state';
import {
  buildSpreadOccurrenceViewModels,
  buildSpreadTracker,
} from '../spread-occurrences/spread-occurrence.view-model';

const BUDGET_DETAIL_INVALIDATION_KEYS: string[][] = [
  ['budget', 'details'],
  ['budget', 'list'],
  ['budget', 'dashboard'],
  ['budget', 'history'],
  // PUL-17 — a spread write fans out across N months (cross-budget). Invalidate
  // the whole budget tree so every touched month + auto-created budget refreshes.
  ['budget', 'spread'],
];

@Service({ autoProvided: false })
export class BudgetDetailsStore {
  // ── 1. Dependencies ──
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #budgetApi = inject(BudgetApi);
  readonly #savingsGoalApi = inject(SavingsGoalApi);
  readonly #budgetCalculator = inject(BudgetCalculator);
  readonly #logger = inject(Logger);
  readonly #storage = inject(StorageService);
  readonly #transloco = inject(TranslocoService);
  readonly #monthFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    month: 'long',
  });
  readonly #userSettings = inject(UserSettingsStore);

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

  // PUL-292 — budget ids whose "mois un peu juste" card the user dismissed
  // ("Plus tard"). Persisted so the nudge stays hidden per month across refresh.
  readonly #dismissedSavingsWithdrawalCardBudgetIds = signal<string[]>(
    this.#storage.get<string[]>(
      STORAGE_KEYS.SAVINGS_WITHDRAWAL_CARD_DISMISSED,
    ) ?? [],
  );

  constructor() {
    effect(() => {
      this.#storage.set(
        STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED,
        this.#isShowingOnlyUnchecked(),
      );
    });

    effect(() => {
      this.#storage.set(
        STORAGE_KEYS.SAVINGS_WITHDRAWAL_CARD_DISMISSED,
        this.#dismissedSavingsWithdrawalCardBudgetIds(),
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

  // PUL-12 — savings-goal names, so a saving envelope linked to a goal can show
  // and link to it across the detail surfaces. Shares SavingsGoalApi's cache
  // (['savings-goals','list']) → the list is fetched once for the whole app.
  readonly #savingsGoalsResource = cachedResource({
    cache: this.#savingsGoalApi.cache,
    cacheKey: ['savings-goals', 'list'],
    loader: () =>
      this.#savingsGoalApi
        .getAll$()
        .pipe(map((response) => response.data ?? [])),
  });

  // PUL-17 Lot C — cross-month occurrences of a spread group. Suspended (idle)
  // until a `spreadGroupId` is set when the user opens the occurrences panel.
  readonly #spreadGroupId = signal<string | null>(null);
  readonly #spreadOccurrencesResource = cachedResource<
    SpreadOccurrence[],
    { spreadGroupId: string }
  >({
    cache: this.#budgetApi.cache,
    cacheKey: (params) => ['budget', 'spread', params.spreadGroupId],
    params: () => {
      const id = this.#spreadGroupId();
      return id ? { spreadGroupId: id } : undefined;
    },
    loader: ({ params }) =>
      this.#budgetApi.getSpreadOccurrences$(params.spreadGroupId),
  });

  readonly spreadOccurrences = computed(
    () => this.#spreadOccurrencesResource.value() ?? [],
  );
  readonly isSpreadOccurrencesLoading =
    this.#spreadOccurrencesResource.isInitialLoading;
  readonly spreadOccurrencesError = this.#spreadOccurrencesResource.error;

  setSpreadGroupId(spreadGroupId: string | null): void {
    this.#spreadGroupId.set(spreadGroupId);
  }

  // PUL-17 — single source of the spread occurrences derived view, shared by all
  // 5 detail surfaces (was duplicated in each). Pure builders live in the
  // view-model; the store wires them reactively. Reference = the VIEWED budget
  // period (display: dimming/"Ici"); live = today, payDay-aware (realization:
  // "clôturé"). These are intentionally distinct axes.
  readonly #spreadReferencePeriod = computed<BudgetPeriod | null>(() => {
    const budget = this.budgetDetails();
    return budget ? { month: budget.month, year: budget.year } : null;
  });

  readonly #spreadLivePeriod = computed<BudgetPeriod>(() =>
    getBudgetPeriodForDate(new Date(), this.#userSettings.payDayOfMonth()),
  );

  readonly spreadOccurrenceViewModels = computed<SpreadOccurrenceViewModel[]>(
    () => {
      const reference = this.#spreadReferencePeriod();
      if (!reference) return [];
      return buildSpreadOccurrenceViewModels(
        this.spreadOccurrences(),
        reference,
        this.#spreadLivePeriod(),
      );
    },
  );

  readonly spreadTracker = computed<SpreadTracker | null>(() =>
    buildSpreadTracker(this.spreadOccurrenceViewModels()),
  );

  readonly isViewingSpreadCurrentPeriod = computed<boolean>(() => {
    const reference = this.#spreadReferencePeriod();
    if (!reference) return false;
    return compareBudgetPeriods(reference, this.#spreadLivePeriod()) === 0;
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

  // Goal id → name, for the linked-goal affordance on saving envelopes. Empty
  // (renders nothing) while the list is loading or when an id is stale.
  readonly savingsGoalNameById = computed<Map<string, string>>(() => {
    const goals = this.#savingsGoalsResource.value() ?? [];
    return new Map(goals.map((goal) => [goal.id, goal.name]));
  });

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

  /**
   * Next CALENDAR month relative to the current budget (with year rollover).
   * Distinct from `nextBudgetId`, which is the next budget in the sorted list.
   * Used to gate the "report to next month" action (PUL-22, CA5): postponing
   * requires that the target month's budget already exists.
   */
  readonly #nextCalendarMonth = computed<{
    month: number;
    year: number;
  } | null>(() => {
    const details = this.budgetDetails();
    if (!details) return null;
    return details.month === 12
      ? { month: 1, year: details.year + 1 }
      : { month: details.month + 1, year: details.year };
  });

  readonly hasNextMonthBudget = computed<boolean>(() => {
    const next = this.#nextCalendarMonth();
    if (!next) return false;
    return this.#budgetsList().some(
      (b) => b.month === next.month && b.year === next.year,
    );
  });

  readonly nextMonthLabel = computed<string>(() => {
    const next = this.#nextCalendarMonth();
    if (!next) return '';
    return this.#monthFormatter.format(new Date(next.year, next.month - 1, 1));
  });

  readonly displayBudgetLines = computed<BudgetLine[]>(() => {
    const details = this.budgetDetails();
    if (!details) return [];
    return details.budgetLines;
  });

  readonly previousMonthRollover = computed<number>(() => {
    const details = this.budgetDetails();
    return details?.rollover ?? 0;
  });

  readonly previousMonthBudgetId = computed<string | null>(() => {
    const details = this.budgetDetails();
    return details?.previousBudgetId ?? null;
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
    const rollover = this.previousMonthRollover();
    const consumptionMap = calculateAllConsumptions(lines, transactions);

    const income = this.#budgetCalculator.calculatePlannedIncome(lines);
    const { expenses, savings } = this.#aggregatePlannedByKind(
      lines,
      consumptionMap,
    );

    const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
    const transactionImpact =
      this.#budgetCalculator.calculateActualTransactionsAmount(
        freeTransactions,
      );
    const remaining =
      income - expenses - savings + transactionImpact + rollover;

    return { income, expenses, savings, remaining };
  });

  // PUL-292 — the viewed month is current OR future (payDay-aware). Never a
  // closed/past month: the "piocher dans son épargne" nudge only makes sense
  // for a month you can still act on. Reuses the spread period axes.
  readonly #isViewedMonthCurrentOrFuture = computed<boolean>(() => {
    const reference = this.#spreadReferencePeriod();
    if (!reference) return false;
    return compareBudgetPeriods(reference, this.#spreadLivePeriod()) >= 0;
  });

  // PUL-292 (CA1) — the "mois un peu juste" card shows whenever the viewed
  // current/future month runs a deficit worth acting on and wasn't dismissed —
  // an existing pioche does NOT hide it: a month can dip back into deficit
  // after a first withdrawal. Gated on the rounded deficit rather than on raw
  // `remaining`: a month balanced to the cent leaves float dust (-9e-13) that
  // would nudge the user towards a dialog with nothing to pre-fill.
  readonly shouldShowSavingsWithdrawalCard = computed<boolean>(() => {
    const details = this.budgetDetails();
    if (!details) return false;
    if (this.savingsWithdrawalDeficit() <= 0) return false;
    if (!this.#isViewedMonthCurrentOrFuture()) return false;
    return !this.#dismissedSavingsWithdrawalCardBudgetIds().includes(
      details.id,
    );
  });

  // The deficit to pre-fill the withdrawal amount chip (positive magnitude, 0
  // when the month is not in deficit). Rounded to the whole unit here, at the
  // single producer: `remaining` is a float sum, so its magnitude carries IEEE
  // noise (196.95999999999913). The hero and the chip both display it via
  // '1.0-0', so rounding once keeps what the chip shows, what the input gets
  // and what the payload carries the same number.
  readonly savingsWithdrawalDeficit = computed<number>(() => {
    const remaining = this.financialTotals().remaining;
    return remaining < 0 ? Math.round(Math.abs(remaining)) : 0;
  });

  // PUL-292 — origin month label (month − 1, with year rollover) shared by every
  // "Remettre sur ton épargne" line of the viewed budget: they all repay a pioche
  // taken the month before.
  readonly savingsWithdrawalOriginLabel = computed<string>(() => {
    const details = this.budgetDetails();
    if (!details) return '';
    const origin = offsetMonth(
      { year: details.year, month: details.month },
      -1,
    );
    return this.#monthFormatter.format(
      new Date(origin.year, origin.month - 1, 1),
    );
  });

  dismissSavingsWithdrawalCard(budgetId: string): void {
    this.#dismissedSavingsWithdrawalCardBudgetIds.update((ids) =>
      ids.includes(budgetId) ? ids : [...ids, budgetId],
    );
  }

  #aggregatePlannedByKind(
    lines: BudgetLine[],
    consumptionMap: Map<string, { consumed: number; transactionCount: number }>,
  ): { expenses: number; savings: number } {
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
    return { expenses, savings };
  }

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
  }

  // ── 5. Mutations (async/await) ──

  // Same contract as #lastSavingsWithdrawalDeleteError: a create/update failure
  // surfaces via the caller's snackbar (return value) and NEVER the page-level
  // errorMessage, which the page renders as the generic load-error card — a
  // refused line must not make the whole budget look unloadable. Single-flight
  // (one dialog at a time), so a plain field is enough.
  #lastBudgetLineWriteError: string | null = null;

  readonly #createBudgetLineMutation = cachedMutation<
    BudgetLineCreate & { id: string },
    { data: BudgetLine },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (budgetLine) => this.#budgetApi.createBudgetLine$(budgetLine),
    onMutate: (budgetLine) => {
      const previous = this.budgetDetails();
      const optimisticLine: BudgetLine = {
        ...budgetLine,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        templateLineId: null,
        savingsGoalId: budgetLine.savingsGoalId ?? null,
        checkedAt: budgetLine.checkedAt ?? null,
      };
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: [...details.budgetLines, optimisticLine],
      }));
      return previous;
    },
    onSuccess: (response, budgetLine) => {
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: details.budgetLines.map((line) =>
          line.id === budgetLine.id ? response.data : line,
        ),
      }));
      this.#onFinancialMutationSuccess();
    },
    onError: (error, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#lastBudgetLineWriteError = this.#localizeError(
        error,
        'budget.forecastCreateError',
      );
      this.#logger.error('Budget line create failed', error);
    },
  });

  /** Returns the localized error message on failure, or `null` on success. */
  async createBudgetLine(input: BudgetLineCreate): Promise<string | null> {
    const id = input.id ?? uuidv4();
    this.#lastBudgetLineWriteError = null;
    const response = await this.#createBudgetLineMutation.mutate({
      ...input,
      id,
    });
    if (response !== undefined) return null;
    return (
      this.#lastBudgetLineWriteError ??
      this.#transloco.translate('budget.forecastCreateError')
    );
  }

  // PUL-17 — a spread fans out across N months (possibly auto-creating budgets),
  // so there is no single-budget optimistic shape to apply. We rely on the
  // cross-budget invalidation to refetch every touched month.
  readonly #createBudgetLineSpreadMutation = cachedMutation<
    BudgetLineSpreadCreate,
    BudgetLineSpreadResponse,
    void
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (data) => this.#budgetApi.createBudgetLineSpread$(data),
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (error) => this.#handleSpreadError(error),
  });

  async createBudgetLineSpread(
    input: BudgetLineSpreadCreate,
  ): Promise<BudgetLineSpreadResponse['data'] | undefined> {
    const response = await this.#createBudgetLineSpreadMutation.mutate(input);
    return response?.data;
  }

  // PUL-292 — creating the pioche couple fans out across M and M+1 (possibly
  // auto-creating M+1), so there is no single-budget optimistic shape. Like the
  // spread create, we rely on the cross-budget prefix invalidation to refetch
  // every touched month (M's disponible + M+1's new Épargne).
  readonly #createSavingsWithdrawalMutation = cachedMutation<
    BudgetLineSavingsWithdrawalCreate,
    BudgetLineSavingsWithdrawalResponse,
    void
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (data) => this.#budgetApi.createSavingsWithdrawal$(data),
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (error) => this.#handleSavingsWithdrawalError(error),
  });

  async createSavingsWithdrawal(
    input: BudgetLineSavingsWithdrawalCreate,
  ): Promise<BudgetLineSavingsWithdrawalResponse['data'] | undefined> {
    const response = await this.#createSavingsWithdrawalMutation.mutate(input);
    return response?.data;
  }

  // Set by the delete mutation's onError, read by the public method — so a delete
  // failure surfaces via the caller's snackbar (return value) and NEVER the
  // page-level errorMessage: a grouped delete that fails (e.g. the group was
  // already removed in another tab) must not flip the whole page to the generic
  // load-error card. Single-flight (one delete dialog at a time), so a plain
  // field is enough.
  #lastSavingsWithdrawalDeleteError: string | null = null;

  readonly #deleteSavingsWithdrawalMutation = cachedMutation<
    { groupId: string; scope: BudgetLineSavingsWithdrawalDeleteQuery['scope'] },
    BudgetLineDeleteResponse,
    void
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: ({ groupId, scope }) =>
      this.#budgetApi.deleteSavingsWithdrawal$(groupId, scope),
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (error) => {
      this.#lastSavingsWithdrawalDeleteError = this.#localizeError(
        error,
        'budget.savingsWithdrawal.error',
      );
      this.#logger.error('Savings withdrawal delete failed', error);
    },
  });

  /** Returns the localized error message on failure, or `null` on success. */
  async deleteSavingsWithdrawal(
    groupId: string,
    scope: BudgetLineSavingsWithdrawalDeleteQuery['scope'],
  ): Promise<string | null> {
    this.#lastSavingsWithdrawalDeleteError = null;
    const response = await this.#deleteSavingsWithdrawalMutation.mutate({
      groupId,
      scope,
    });
    if (response !== undefined) return null;
    return (
      this.#lastSavingsWithdrawalDeleteError ??
      this.#transloco.translate('budget.savingsWithdrawal.error')
    );
  }

  // PUL-17 v1.1 — total-preserving spread of an EXISTING source (prévision OR
  // free transaction). The server reads the source total, redistributes it,
  // fans out across N months (possibly auto-creating budgets), then DELETES the
  // source — so no single-budget optimistic shape applies. Cross-budget
  // invalidation refetches every touched month; on success we wire the new
  // spreadGroupId so the occurrences panel can reload.
  readonly #spreadExistingBudgetLineMutation = cachedMutation<
    { id: string; periods: SpreadFromExistingPeriod[] },
    BudgetLineSpreadResponse,
    void
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: ({ id, periods }) =>
      this.#budgetApi.spreadExistingBudgetLine$(id, periods),
    onSuccess: (response) => {
      this.setSpreadGroupId(response.data.spreadGroupId);
      this.#onFinancialMutationSuccess();
    },
    onError: (error) => this.#handleSpreadError(error),
  });

  async spreadExistingBudgetLine(
    id: string,
    periods: SpreadFromExistingPeriod[],
  ): Promise<BudgetLineSpreadResponse['data'] | undefined> {
    const response = await this.#spreadExistingBudgetLineMutation.mutate({
      id,
      periods,
    });
    return response?.data;
  }

  readonly #spreadExistingTransactionMutation = cachedMutation<
    { id: string; periods: SpreadFromExistingPeriod[] },
    BudgetLineSpreadResponse,
    void
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: ({ id, periods }) =>
      this.#budgetApi.spreadExistingTransaction$(id, periods),
    onSuccess: (response) => {
      this.setSpreadGroupId(response.data.spreadGroupId);
      this.#onFinancialMutationSuccess();
    },
    onError: (error) => this.#handleSpreadError(error),
  });

  async spreadExistingTransaction(
    id: string,
    periods: SpreadFromExistingPeriod[],
  ): Promise<BudgetLineSpreadResponse['data'] | undefined> {
    const response = await this.#spreadExistingTransactionMutation.mutate({
      id,
      periods,
    });
    return response?.data;
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
    onError: (error, _args, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#lastBudgetLineWriteError = this.#localizeError(
        error,
        'budget.forecastUpdateError',
      );
      this.#logger.error('Budget line update failed', error);
    },
  });

  /** Returns the localized error message on failure, or `null` on success. */
  async updateBudgetLine(data: BudgetLineUpdate): Promise<string | null> {
    this.#lastBudgetLineWriteError = null;
    const response = await this.#updateBudgetLineMutation.mutate(data);
    if (response !== undefined) return null;
    return (
      this.#lastBudgetLineWriteError ??
      this.#transloco.translate('budget.forecastUpdateError')
    );
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
    TransactionCreate & { id: string },
    { data: Transaction },
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (data) => this.#budgetApi.createTransaction$(data),
    onMutate: (data) => {
      const previous = this.budgetDetails();
      const optimisticTransaction: Transaction = {
        ...data,
        budgetLineId: data.budgetLineId ?? null,
        transactionDate: data.transactionDate ?? formatLocalDate(new Date()),
        tagIds: data.tagIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkedAt: data.checkedAt ?? null,
      };
      this.#updateDetails((details) => ({
        ...details,
        transactions: [...details.transactions, optimisticTransaction],
      }));
      return previous;
    },
    onSuccess: (response, data) => {
      this.#updateDetails((details) => ({
        ...details,
        transactions: details.transactions.map((tx) =>
          tx.id === data.id
            ? {
                ...response.data,
                checkedAt: tx.checkedAt ?? response.data.checkedAt,
              }
            : tx,
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
    const id = transactionData.id ?? uuidv4();
    await this.#createAllocatedTransactionMutation.mutate({
      ...transactionData,
      id,
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
      this.#setError(this.#localizeError(error, 'budget.forecastResetError'));
      this.#logger.error('Error resetting budget line from template', error);
    },
  });

  async resetBudgetLineFromTemplate(id: string): Promise<void> {
    if (this.#mutatingIds.has(id)) return;
    this.#mutatingIds.add(id);
    try {
      await this.#resetBudgetLineMutation.mutate(id);
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #postponeBudgetLineMutation = cachedMutation<
    string,
    BudgetLinePostponeResponse,
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (id) => this.#budgetApi.postponeBudgetLine$(id),
    // Optimistically remove the line — it moved to next month's budget.
    onMutate: (id) => {
      const previous = this.budgetDetails();
      this.#updateDetails((details) => ({
        ...details,
        budgetLines: details.budgetLines.filter((line) => line.id !== id),
      }));
      return previous;
    },
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (error, _id, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#handlePostponeError(error);
    },
  });

  async postponeBudgetLine(id: string): Promise<boolean> {
    if (this.#mutatingIds.has(id)) return false;
    this.#mutatingIds.add(id);
    try {
      const result = await this.#postponeBudgetLineMutation.mutate(id);
      return result !== undefined;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #postponeTransactionMutation = cachedMutation<
    string,
    TransactionPostponeResponse,
    BudgetDetailsViewModel | null
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
    mutationFn: (id) => this.#budgetApi.postponeTransaction$(id),
    // Optimistically remove the transaction — it moved to next month's budget.
    onMutate: (id) => {
      const previous = this.budgetDetails();
      this.#updateDetails((details) => ({
        ...details,
        transactions: details.transactions.filter((tx) => tx.id !== id),
      }));
      return previous;
    },
    onSuccess: () => this.#onFinancialMutationSuccess(),
    onError: (error, _id, previous) => {
      if (previous) this.#budgetDetailsResource.set(previous);
      this.#handlePostponeError(error);
    },
  });

  async postponeTransaction(id: string): Promise<boolean> {
    if (this.#mutatingIds.has(id)) return false;
    this.#mutatingIds.add(id);
    try {
      const result = await this.#postponeTransactionMutation.mutate(id);
      return result !== undefined;
    } finally {
      this.#mutatingIds.delete(id);
    }
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
            (tx) => tx.budgetLineId === budgetLineId && tx.checkedAt === null,
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
      (tx) => tx.budgetLineId === budgetLineId && tx.checkedAt === null,
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

  // Shared failure path for the 2 postpone mutations (mirrors #handleSpreadError):
  // localize via the common helper, then log only UNEXPECTED (non-API) errors —
  // expected business errors (already-checked, concurrent-mod) are surfaced to
  // the user, not logged as noise.
  #handlePostponeError(error: unknown): void {
    this.#setError(this.#localizeError(error, 'budget.postponeError'));
    if (!isApiError(error)) {
      this.#logger.error('Error postponing item to next month', error);
    }
  }

  // Localize a mutation error: a typed ApiError's code maps to a precise
  // message; anything else falls back to the operation's generic key.
  #localizeError(error: unknown, fallbackKey: string): string {
    return isApiError(error)
      ? this.#apiErrorLocalizer.localizeApiError(error)
      : this.#transloco.translate(fallbackKey);
  }

  // Shared failure path for the 3 spread mutations (identical key + log).
  #handleSpreadError(error: unknown): void {
    this.#setError(this.#localizeError(error, 'budgetLine.spread.error'));
    this.#logger.error('Spread mutation failed', error);
  }

  // Shared failure path for the 2 savings-withdrawal mutations (PUL-292):
  // localize a typed ApiError via its code, else fall back to the generic key.
  #handleSavingsWithdrawalError(error: unknown): void {
    this.#setError(
      this.#localizeError(error, 'budget.savingsWithdrawal.error'),
    );
    this.#logger.error('Savings withdrawal mutation failed', error);
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
