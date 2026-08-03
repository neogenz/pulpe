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

/**
 * What a mutation that carries a payload gives back: the payload on success, the
 * localized reason on refusal. Mutations with nothing to return say the same
 * thing with a plain `string | null` — `null` meaning it went through.
 *
 * `retryable` says whether replaying the SAME request could land differently.
 * Only the submitters that offer a "Réessayer" action read it; a refusal the
 * server will repeat verbatim must not be offered a button that cannot work.
 */
export interface MutationOutcome<T> {
  data?: T;
  error?: string;
  retryable?: boolean;
}

/**
 * A refusal the server decided on (any 4xx it will reach again from the same
 * body) is final. A timeout, a rate limit, a 5xx or a transport failure is the
 * request not getting a verdict — that is what replaying is for, and for the
 * idempotent creates it is also what heals a lost post-commit response.
 */
function isRetryableFailure(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.status >= 500 || error.status === 408 || error.status === 429;
}

/**
 * Where a mutation's `onError` hands its localized reason back to the one call
 * that made it. `retryable` is omitted by the mutations nobody offers a retry
 * on, which is why it is optional rather than threaded through all of them.
 */
type FailSink = (message: string, retryable?: boolean) => void;

/**
 * A `cachedMutation` built for ONE call, around that call's sink. Structural
 * rather than `CachedMutationRef`, whose `mutate(...args)` rest tuple is a
 * conditional type that cannot resolve against an unbound `TArgs`.
 */
type MutationFactory<TArgs, TResponse> = (fail: FailSink) => {
  mutate: (args: TArgs) => Promise<TResponse | undefined>;
};

/**
 * What one call needs to undo its own optimistic write and nothing else: the
 * state it found (`previous`) and the state it left behind (`optimistic`).
 * `onMutate` captures both, so the pair is always a snapshot of THIS call.
 */
interface RewindPoint {
  previous: BudgetDetailsViewModel;
  optimistic: BudgetDetailsViewModel;
}

/**
 * Takes this call's optimistic edits back out of `current`, row by row, leaving
 * every row a concurrent call has since written. Reference identity is the
 * discriminator: every optimistic writer in this store maps over the arrays and
 * hands back the SAME object for the rows it does not touch, so `now === mine`
 * means "still exactly what I wrote, safe to rewind" and anything else means
 * "someone wrote this after me, it is theirs". With nothing else in flight
 * `current` IS `optimistic`, so the result is `previous` — the whole-snapshot
 * rewind, reached row by row.
 */
function rewindRows<T extends { id: string }>(
  current: readonly T[],
  previous: readonly T[],
  optimistic: readonly T[],
): T[] {
  const currentById = new Map(current.map((row) => [row.id, row]));
  const optimisticById = new Map(optimistic.map((row) => [row.id, row]));
  const rewound: T[] = [];

  // Rows older than this call, kept in their original order.
  for (const was of previous) {
    const now = currentById.get(was.id);
    const mine = optimisticById.get(was.id);
    if (was === mine) {
      // Never mine to rewind — including when a sibling has since deleted it.
      if (now !== undefined) rewound.push(now);
    } else if (now === mine) {
      // Mine and untouched since. `undefined === undefined` lands here too: the
      // row this call optimistically removed comes back, in place.
      rewound.push(was);
    } else if (now !== undefined) {
      rewound.push(now);
    }
  }

  // Rows born after this call: drop the ones it added, keep a sibling's.
  const previousIds = new Set(previous.map((row) => row.id));
  for (const row of current) {
    if (!previousIds.has(row.id) && row !== optimisticById.get(row.id)) {
      rewound.push(row);
    }
  }

  return rewound;
}

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
  // The page renders this as a card that REPLACES the whole budget, so it means
  // one thing only: the budget could not be loaded. A refused mutation is not an
  // unloadable budget — it travels back through its own return value instead.
  readonly error = this.#budgetDetailsResource.error;
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

  // Nothing about a call's outcome lives on `this`. Every mutation is a factory
  // taking the sink its one call reads back from, because a `cachedMutation`
  // object holds ONE `callCounter` shared by every `mutate()` on it: a call that
  // is no longer the latest runs NEITHER onSuccess NOR onError, so its rollback
  // never fires and it writes no message anywhere. Two ids toggled inside one
  // network window, or a dialog-driven create overlapping a row toggle, are
  // enough to hit that. A fresh object per call starts its own counter at 0, so
  // `thisCallId === callCounter` always holds and the callbacks always run.
  //
  // Reading the sink is also the ONLY valid failure test: `mutate()` resolves
  // `undefined` on error, but two of these mutations are typed `void`, so
  // `undefined` is their success value too.
  //
  // Because the callbacks now always run, so does every rollback — which is why
  // none of them restores a whole snapshot any more. `previous` is captured in
  // `onMutate`, so it predates every write a concurrent call has made since:
  // replaying it wholesale erases a sibling's ALREADY CONFIRMED row while that
  // sibling's own `mutate()` has returned success, leaving the user no signal at
  // all. Nothing heals that on its own — `invalidateKeys` runs on ziflux's
  // success path, so a failure invalidates nothing. `#rollback` therefore rewinds
  // per row (see `rewindRows`) and yields any row someone else has written.
  //
  // Bounded, deliberate limit: when a sibling has overwritten the very row this
  // call wrote, the rewind leaves the sibling's value in place rather than
  // arbitrating between them. That one case does heal — a sibling can only have
  // written a confirmed row by succeeding, and its success invalidated the
  // budget keys, so a refetch is already on its way.

  readonly #createBudgetLineMutation = (fail: FailSink) =>
    cachedMutation<
      BudgetLineCreate & { id: string },
      { data: BudgetLine },
      RewindPoint | null
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
        return this.#rewindPoint(previous);
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
      onError: (error, _args, rewind) => {
        this.#rollback(rewind);
        fail(this.#localizeError(error, 'budget.forecastCreateError'));
        this.#logger.error('Budget line create failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async createBudgetLine(input: BudgetLineCreate): Promise<string | null> {
    const id = input.id ?? uuidv4();
    const { error } = await this.#runMutation(this.#createBudgetLineMutation, {
      ...input,
      id,
    });
    return error;
  }

  // PUL-17 — a spread fans out across N months (possibly auto-creating budgets),
  // so there is no single-budget optimistic shape to apply. We rely on the
  // cross-budget invalidation to refetch every touched month.
  readonly #createBudgetLineSpreadMutation = (fail: FailSink) =>
    cachedMutation<BudgetLineSpreadCreate, BudgetLineSpreadResponse, void>({
      cache: this.#budgetApi.cache,
      invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
      mutationFn: (data) => this.#budgetApi.createBudgetLineSpread$(data),
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error) => this.#handleSpreadError(fail, error),
    });

  async createBudgetLineSpread(
    input: BudgetLineSpreadCreate,
  ): Promise<MutationOutcome<BudgetLineSpreadResponse['data']>> {
    const { data, error, retryable } = await this.#runMutation(
      this.#createBudgetLineSpreadMutation,
      input,
    );
    return error !== null ? { error, retryable } : { data: data?.data };
  }

  // PUL-292 — creating the pioche couple fans out across M and M+1 (possibly
  // auto-creating M+1), so there is no single-budget optimistic shape. Like the
  // spread create, we rely on the cross-budget prefix invalidation to refetch
  // every touched month (M's disponible + M+1's new Épargne).
  readonly #createSavingsWithdrawalMutation = (fail: FailSink) =>
    cachedMutation<
      BudgetLineSavingsWithdrawalCreate,
      BudgetLineSavingsWithdrawalResponse,
      void
    >({
      cache: this.#budgetApi.cache,
      invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
      mutationFn: (data) => this.#budgetApi.createSavingsWithdrawal$(data),
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error) => this.#handleSavingsWithdrawalError(fail, error),
    });

  async createSavingsWithdrawal(
    input: BudgetLineSavingsWithdrawalCreate,
  ): Promise<MutationOutcome<BudgetLineSavingsWithdrawalResponse['data']>> {
    const { data, error, retryable } = await this.#runMutation(
      this.#createSavingsWithdrawalMutation,
      input,
    );
    return error !== null ? { error, retryable } : { data: data?.data };
  }

  readonly #deleteSavingsWithdrawalMutation = (fail: FailSink) =>
    cachedMutation<
      {
        groupId: string;
        scope: BudgetLineSavingsWithdrawalDeleteQuery['scope'];
      },
      BudgetLineDeleteResponse,
      void
    >({
      cache: this.#budgetApi.cache,
      invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
      mutationFn: ({ groupId, scope }) =>
        this.#budgetApi.deleteSavingsWithdrawal$(groupId, scope),
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error) => {
        fail(this.#localizeError(error, 'budget.savingsWithdrawal.error'));
        this.#logger.error('Savings withdrawal delete failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async deleteSavingsWithdrawal(
    groupId: string,
    scope: BudgetLineSavingsWithdrawalDeleteQuery['scope'],
  ): Promise<string | null> {
    const { error } = await this.#runMutation(
      this.#deleteSavingsWithdrawalMutation,
      { groupId, scope },
    );
    return error;
  }

  // PUL-17 v1.1 — total-preserving spread of an EXISTING source (prévision OR
  // free transaction). The server reads the source total, redistributes it,
  // fans out across N months (possibly auto-creating budgets), then DELETES the
  // source — so no single-budget optimistic shape applies. Cross-budget
  // invalidation refetches every touched month; on success we wire the new
  // spreadGroupId so the occurrences panel can reload.
  readonly #spreadExistingBudgetLineMutation = (fail: FailSink) =>
    cachedMutation<
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
      onError: (error) => this.#handleSpreadError(fail, error),
    });

  async spreadExistingBudgetLine(
    id: string,
    periods: SpreadFromExistingPeriod[],
  ): Promise<MutationOutcome<BudgetLineSpreadResponse['data']>> {
    const { data, error } = await this.#runMutation(
      this.#spreadExistingBudgetLineMutation,
      { id, periods },
    );
    return error !== null ? { error } : { data: data?.data };
  }

  readonly #spreadExistingTransactionMutation = (fail: FailSink) =>
    cachedMutation<
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
      onError: (error) => this.#handleSpreadError(fail, error),
    });

  async spreadExistingTransaction(
    id: string,
    periods: SpreadFromExistingPeriod[],
  ): Promise<MutationOutcome<BudgetLineSpreadResponse['data']>> {
    const { data, error } = await this.#runMutation(
      this.#spreadExistingTransactionMutation,
      { id, periods },
    );
    return error !== null ? { error } : { data: data?.data };
  }

  readonly #updateBudgetLineMutation = (fail: FailSink) =>
    cachedMutation<BudgetLineUpdate, { data: BudgetLine }, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
      },
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error, _args, rewind) => {
        this.#rollback(rewind);
        fail(this.#localizeError(error, 'budget.forecastUpdateError'));
        this.#logger.error('Budget line update failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async updateBudgetLine(data: BudgetLineUpdate): Promise<string | null> {
    const { error } = await this.#runMutation(
      this.#updateBudgetLineMutation,
      data,
    );
    return error;
  }

  readonly #updateTransactionMutation = (fail: FailSink) =>
    cachedMutation<
      { id: string; data: TransactionUpdate },
      { data: Transaction },
      RewindPoint | null
    >({
      cache: this.#budgetApi.cache,
      invalidateKeys: () => BUDGET_DETAIL_INVALIDATION_KEYS,
      mutationFn: ({ id, data }) =>
        this.#budgetApi.updateTransaction$(id, data),
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
        return this.#rewindPoint(previous);
      },
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error, _args, rewind) => {
        this.#rollback(rewind);
        fail(this.#transloco.translate('budget.transactionUpdateError'));
        this.#logger.error('Transaction update failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async updateTransaction(
    id: string,
    data: TransactionUpdate,
  ): Promise<string | null> {
    const { error } = await this.#runMutation(this.#updateTransactionMutation, {
      id,
      data,
    });
    return error;
  }

  readonly #deleteBudgetLineMutation = (fail: FailSink) =>
    cachedMutation<string, void, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
      },
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error, _args, rewind) => {
        this.#rollback(rewind);
        fail(this.#transloco.translate('budget.forecastDeleteError'));
        this.#logger.error('Budget line delete failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async deleteBudgetLine(id: string): Promise<string | null> {
    const { error } = await this.#runMutation(
      this.#deleteBudgetLineMutation,
      id,
    );
    return error;
  }

  readonly #deleteTransactionMutation = (fail: FailSink) =>
    cachedMutation<string, void, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
      },
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error, _args, rewind) => {
        this.#rollback(rewind);
        fail(this.#transloco.translate('budget.transactionDeleteError'));
        this.#logger.error('Transaction delete failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async deleteTransaction(id: string): Promise<string | null> {
    const { error } = await this.#runMutation(
      this.#deleteTransactionMutation,
      id,
    );
    return error;
  }

  readonly #createAllocatedTransactionMutation = (fail: FailSink) =>
    cachedMutation<
      TransactionCreate & { id: string },
      { data: Transaction },
      RewindPoint | null
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
        return this.#rewindPoint(previous);
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
      onError: (error, _args, rewind) => {
        this.#rollback(rewind);
        fail(this.#transloco.translate('budget.transactionCreateError'));
        this.#logger.error('Allocated transaction create failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async createAllocatedTransaction(
    transactionData: TransactionCreate,
  ): Promise<string | null> {
    const id = transactionData.id ?? uuidv4();
    const { error } = await this.#runMutation(
      this.#createAllocatedTransactionMutation,
      { ...transactionData, id },
    );
    return error;
  }

  readonly #resetBudgetLineMutation = (fail: FailSink) =>
    cachedMutation<string, { data: BudgetLine }, void>({
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
        fail(this.#localizeError(error, 'budget.forecastResetError'));
        this.#logger.error('Error resetting budget line from template', error);
      },
    });

  /**
   * Returns the localized error message on failure, or `null` on success.
   * A guard that skips the call also returns `null`: the gesture was a duplicate
   * of one already in flight, so there is nothing to tell the user about.
   */
  async resetBudgetLineFromTemplate(id: string): Promise<string | null> {
    if (this.#mutatingIds.has(id)) return null;
    this.#mutatingIds.add(id);
    try {
      return (await this.#runMutation(this.#resetBudgetLineMutation, id)).error;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #postponeBudgetLineMutation = (fail: FailSink) =>
    cachedMutation<string, BudgetLinePostponeResponse, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
      },
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error, _id, rewind) => {
        this.#rollback(rewind);
        this.#handlePostponeError(fail, error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async postponeBudgetLine(id: string): Promise<string | null> {
    if (this.#mutatingIds.has(id)) return null;
    this.#mutatingIds.add(id);
    try {
      return (await this.#runMutation(this.#postponeBudgetLineMutation, id))
        .error;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #postponeTransactionMutation = (fail: FailSink) =>
    cachedMutation<string, TransactionPostponeResponse, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
      },
      onSuccess: () => this.#onFinancialMutationSuccess(),
      onError: (error, _id, rewind) => {
        this.#rollback(rewind);
        this.#handlePostponeError(fail, error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async postponeTransaction(id: string): Promise<string | null> {
    if (this.#mutatingIds.has(id)) return null;
    this.#mutatingIds.add(id);
    try {
      return (await this.#runMutation(this.#postponeTransactionMutation, id))
        .error;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #toggleCheckMutation = (fail: FailSink) =>
    cachedMutation<string, { data: BudgetLine }, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
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
      onError: (error, _id, rewind) => {
        this.#rollback(rewind);
        fail(this.#transloco.translate('budget.forecastToggleError'));
        this.#logger.error('Budget line check toggle failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async toggleCheck(id: string): Promise<string | null> {
    if (this.#mutatingIds.has(id)) return null;

    const details = this.budgetDetails();
    if (!details) return null;

    const lineExists = details.budgetLines.some((l) => l.id === id);
    if (!lineExists) return null;

    this.#mutatingIds.add(id);
    try {
      return (await this.#runMutation(this.#toggleCheckMutation, id)).error;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #toggleTransactionCheckMutation = (fail: FailSink) =>
    cachedMutation<string, { data: Transaction }, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
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
      onError: (error, _id, rewind) => {
        this.#rollback(rewind);
        fail(this.#transloco.translate('budget.transactionToggleError'));
        this.#logger.error('Transaction check toggle failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async toggleTransactionCheck(id: string): Promise<string | null> {
    if (this.#mutatingIds.has(id)) return null;
    this.#mutatingIds.add(id);
    try {
      return (await this.#runMutation(this.#toggleTransactionCheckMutation, id))
        .error;
    } finally {
      this.#mutatingIds.delete(id);
    }
  }

  readonly #checkAllAllocatedMutation = (fail: FailSink) =>
    cachedMutation<string, TransactionListResponse, RewindPoint | null>({
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
        return this.#rewindPoint(previous);
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
      onError: (error, _id, rewind) => {
        this.#rollback(rewind);
        fail(this.#transloco.translate('budget.checkAllError'));
        this.#logger.error('Bulk check-all failed', error);
      },
    });

  /** Returns the localized error message on failure, or `null` on success. */
  async checkAllAllocatedTransactions(
    budgetLineId: string,
  ): Promise<string | null> {
    if (this.#mutatingIds.has(budgetLineId)) return null;
    const details = this.budgetDetails();
    if (!details) return null;
    const hasUnchecked = details.transactions.some(
      (tx) => tx.budgetLineId === budgetLineId && tx.checkedAt === null,
    );
    if (!hasUnchecked) return null;
    this.#mutatingIds.add(budgetLineId);
    try {
      return (
        await this.#runMutation(this.#checkAllAllocatedMutation, budgetLineId)
      ).error;
    } finally {
      this.#mutatingIds.delete(budgetLineId);
    }
  }

  reloadBudgetDetails(): void {
    this.#budgetDetailsResource.reload();
  }

  // ── 6. Private utility methods ──

  /**
   * Runs ONE call of `factory` and hands back both halves of its outcome: the
   * response it resolved and the localized reason it refused. The sink lives
   * here, in the call frame, which is what keeps a call's outcome off `this` —
   * overlapping calls each read their own cell. Public methods project this into
   * whichever shape they promise: `.error` alone, or the pair.
   */
  async #runMutation<TArgs, TResponse>(
    factory: MutationFactory<TArgs, TResponse>,
    args: TArgs,
  ): Promise<{
    data: TResponse | undefined;
    error: string | null;
    retryable: boolean;
  }> {
    let error: string | null = null;
    let retryable = false;
    const mutation = factory((message, isRetryable = false) => {
      error = message;
      retryable = isRetryable;
    });
    const data = await mutation.mutate(args);
    return { data, error, retryable };
  }

  /** The pair `#rollback` needs, or `null` when there is nothing to undo. */
  #rewindPoint(previous: BudgetDetailsViewModel | null): RewindPoint | null {
    const optimistic = this.budgetDetails();
    return previous && optimistic ? { previous, optimistic } : null;
  }

  #rollback(rewind: RewindPoint | null | undefined): void {
    if (!rewind) return;
    const { previous, optimistic } = rewind;
    this.#updateDetails((current) => ({
      ...current,
      budgetLines: rewindRows(
        current.budgetLines,
        previous.budgetLines,
        optimistic.budgetLines,
      ),
      transactions: rewindRows(
        current.transactions,
        previous.transactions,
        optimistic.transactions,
      ),
    }));
  }

  #updateDetails(
    fn: (details: BudgetDetailsViewModel) => BudgetDetailsViewModel,
  ): void {
    this.#budgetDetailsResource.update((details) => {
      // Early return when resource has no value — cast required by cachedResource.update() signature
      if (!details) return details as unknown as BudgetDetailsViewModel;
      return fn(details);
    });
  }

  // Shared failure path for the 2 postpone mutations (mirrors #handleSpreadError):
  // localize via the common helper, then log only UNEXPECTED (non-API) errors —
  // expected business errors (already-checked, concurrent-mod) are surfaced to
  // the user, not logged as noise.
  #handlePostponeError(fail: FailSink, error: unknown): void {
    fail(this.#localizeError(error, 'budget.postponeError'));
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
  #handleSpreadError(fail: FailSink, error: unknown): void {
    fail(
      this.#localizeError(error, 'budgetLine.spread.error'),
      isRetryableFailure(error),
    );
    this.#logger.error('Spread mutation failed', error);
  }

  // Shared failure path for the 2 savings-withdrawal mutations (PUL-292):
  // localize a typed ApiError via its code, else fall back to the generic key.
  #handleSavingsWithdrawalError(fail: FailSink, error: unknown): void {
    fail(
      this.#localizeError(error, 'budget.savingsWithdrawal.error'),
      isRetryableFailure(error),
    );
    this.#logger.error('Savings withdrawal mutation failed', error);
  }

  #onFinancialMutationSuccess(): void {
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
