import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError, NEVER, Subject } from 'rxjs';
import { DashboardStore, DASHBOARD_NOW } from './dashboard-store';
import { BudgetApi } from '@core/budget';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { UserSettingsStore } from '@core/user-settings';
import { Logger } from '@core/logging/logger';
import { PostHogService } from '@core/analytics/posthog';
import { ApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { createMockDataCache } from '@core/testing';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { TranslocoService } from '@jsverse/transloco';
import type { Budget, BudgetLine, Transaction } from 'pulpe-shared';
import { API_ERROR_CODES, BudgetFormulas } from 'pulpe-shared';

// ── Fixed date: June 15, 2025 ──
const FIXED_DATE = new Date(2025, 5, 15);

// ── Mock factories ──
function createMockBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    month: 6,
    year: 2025,
    description: '',
    templateId: 'template-1',
    endingBalance: 800,
    rollover: 0,
    remaining: 0,
    previousBudgetId: null,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    ...overrides,
  } as Budget;
}

function createMockBudgetLine(overrides: Partial<BudgetLine>): BudgetLine {
  return {
    id: 'line-1',
    budgetId: 'budget-1',
    templateLineId: null,
    savingsGoalId: null,
    name: 'Test Line',
    amount: 100,
    kind: 'expense',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    ...overrides,
  } as BudgetLine;
}

function createMockTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    budgetId: 'budget-1',
    budgetLineId: null,
    name: 'Test Transaction',
    amount: 50,
    kind: 'expense',
    transactionDate: '2025-06-10T00:00:00Z',
    checkedAt: null,
    tagIds: [],
    createdAt: '2025-06-10T00:00:00Z',
    updatedAt: '2025-06-10T00:00:00Z',
    ...overrides,
  } as Transaction;
}

// ── Mock setup ──
function createMocks() {
  // Real in-flight deduplication, so the specs exercise the shared-promise path.
  // `_fetch` delegates to `deduplicate`, so overriding it here is enough.
  const cache = createMockDataCache();
  const inflight = new Map<string, Promise<unknown>>();
  cache.deduplicate.mockImplementation(
    (key: string[], fn: () => Promise<unknown>) => {
      const k = Array.isArray(key) ? key.join('|') : String(key);
      const existing = inflight.get(k);
      if (existing) return existing;
      const p = Promise.resolve()
        .then(() => fn())
        .finally(() => inflight.delete(k));
      inflight.set(k, p);
      return p;
    },
  );

  return {
    budgetApi: {
      getDashboardData$: vi
        .fn()
        .mockReturnValue(
          of({ budget: null, transactions: [], budgetLines: [] }),
        ),
      getHistoryData$: vi.fn().mockReturnValue(of([])),
      getBudgetById$: vi.fn().mockReturnValue(of(createMockBudget())),
      createTransaction$: vi.fn(),
      deleteTransaction$: vi.fn(),
      toggleBudgetLineCheck$: vi.fn(),
      cache,
    },
    savingsGoalApi: {
      cache: createMockDataCache(),
    },
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
    userSettingsStore: {
      payDayOfMonth: signal<number | null>(1),
      isLoading: signal(false),
    },
    postHogService: {
      captureEvent: vi.fn(),
    },
  };
}

function setup(mocks = createMocks(), now: Date = FIXED_DATE) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      DashboardStore,
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: BudgetApi, useValue: mocks.budgetApi },
      { provide: SavingsGoalApi, useValue: mocks.savingsGoalApi },
      { provide: UserSettingsStore, useValue: mocks.userSettingsStore },
      { provide: Logger, useValue: mocks.logger },
      { provide: PostHogService, useValue: mocks.postHogService },
      { provide: DASHBOARD_NOW, useValue: now },
    ],
  });

  const store = TestBed.inject(DashboardStore);
  return { store, ...mocks };
}

async function setupWithBudgetAndWait(
  budget = createMockBudget(),
  budgetLines: BudgetLine[] = [],
  transactions: Transaction[] = [],
  now: Date = FIXED_DATE,
) {
  const mocks = createMocks();
  mocks.budgetApi.getDashboardData$.mockReturnValue(
    of({ budget, transactions, budgetLines }),
  );
  const result = setup(mocks, now);

  TestBed.tick();
  await vi.waitFor(() => {
    const data = result.store.dashboardData();
    expect(data?.budget?.id).toBe(budget.id);
    expect(data?.budgetLines.length).toBe(budgetLines.length);
    expect(data?.transactions.length).toBe(transactions.length);
  });

  return result;
}

// ── Section 1: Business Scenarios ──
describe('DashboardStore - Business Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User can see their financial situation', () => {
    it('should compute totalAvailable as totalIncome + rollover', async () => {
      const budget = createMockBudget({ rollover: 200 });
      const lines = [
        createMockBudgetLine({
          id: 'inc-1',
          kind: 'income',
          amount: 5000,
        }),
      ];
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      expect(store.totalIncome()).toBe(5000);
      expect(store.rolloverAmount()).toBe(200);
      expect(store.totalAvailable()).toBe(5200);
    });

    it('should compute totalExpenses using envelope logic', async () => {
      const budget = createMockBudget();
      const lines = [
        createMockBudgetLine({
          id: 'exp-1',
          kind: 'expense',
          amount: 300,
        }),
      ];
      const txs = [
        createMockTransaction({
          id: 'tx-alloc',
          budgetLineId: 'exp-1',
          amount: 100,
        }),
        createMockTransaction({
          id: 'tx-free',
          budgetLineId: null,
          amount: 50,
        }),
      ];
      const { store } = await setupWithBudgetAndWait(budget, lines, txs);

      // Envelope: max(300, 100) = 300, free: 50 → total = 350
      const expected = BudgetFormulas.calculateTotalExpenses(lines, txs);
      expect(store.totalExpenses()).toBe(expected);
      expect(store.totalExpenses()).toBe(350);
    });

    it('should compute remaining as available - expenses', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({
          id: 'inc-1',
          kind: 'income',
          amount: 3000,
        }),
        createMockBudgetLine({
          id: 'exp-1',
          kind: 'expense',
          amount: 1000,
        }),
      ];
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      // available = 3000 + 0 = 3000, expenses = 1000, remaining = 2000
      expect(store.remaining()).toBe(2000);
    });

    it('should return rollover from budget data', async () => {
      const budget = createMockBudget({ rollover: -150 });
      const { store } = await setupWithBudgetAndWait(budget, [], []);

      expect(store.rolloverAmount()).toBe(-150);
    });
  });

  describe('Loading states', () => {
    it('should report isInitialLoading true when first loading', () => {
      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(NEVER);
      const { store } = setup(mocks);

      expect(store.isInitialLoading()).toBe(true);
    });

    it('should report isInitialLoading false when data is available', async () => {
      const { store } = await setupWithBudgetAndWait(
        createMockBudget(),
        [],
        [],
      );

      expect(store.dashboardData()).not.toBeNull();
      expect(store.isInitialLoading()).toBe(false);
    });
  });

  describe('User can manage transactions', () => {
    it('should add a transaction and update data', async () => {
      const budget = createMockBudget();
      const newTx = createMockTransaction({
        id: 'tx-new',
        name: 'Courses',
        amount: 80,
      });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: [] }),
      );
      mocks.budgetApi.createTransaction$.mockReturnValue(
        of({ success: true, data: newTx }),
      );
      mocks.budgetApi.getBudgetById$.mockReturnValue(of(budget));
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.dashboardData()).not.toBeNull();
      });

      await store.addTransaction({
        budgetId: 'budget-1',
        name: 'Courses',
        amount: 80,
        kind: 'expense',
      });

      expect(mocks.budgetApi.createTransaction$).toHaveBeenCalled();
      expect(store.transactions().length).toBe(1);
      expect(store.transactions()[0].id).toBe('tx-new');
      expect(mocks.postHogService.captureEvent).toHaveBeenCalledWith(
        'transaction_created',
        { type: 'expense' },
      );
    });

    it('should not insert transaction and should set error signal when addTransaction fails', async () => {
      const budget = createMockBudget();
      const existingTx = createMockTransaction({ id: 'tx-existing' });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({
          budget,
          transactions: [existingTx],
          budgetLines: [],
        }),
      );
      mocks.budgetApi.createTransaction$.mockReturnValue(
        throwError(() => new Error('API error')),
      );
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.transactions().length).toBe(1);
      });

      // cachedMutation.mutate() never rejects — the reason comes back returned.
      const outcome = await store.addTransaction({
        budgetId: 'budget-1',
        name: 'Fail',
        amount: 100,
        kind: 'expense',
      });

      // Should rollback to original data (via onError)
      expect(store.transactions().length).toBe(1);
      expect(store.transactions()[0].id).toBe('tx-existing');
      expect(outcome).toEqual({ reason: expect.any(String) });
      expect(mocks.postHogService.captureEvent).not.toHaveBeenCalled();
    });

    // A refused withdrawal has a precise reason the user must read: it says the
    // income was NOT created. Kept in the store's return value, not in `error`,
    // which the dashboard renders as a full-screen "could not load" card.
    it('hands back the localized reason when the server refuses a withdrawal', async () => {
      const budget = createMockBudget();
      const refusal = new ApiError(
        'insufficient',
        API_ERROR_CODES.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE,
        422,
        undefined,
      );

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: [] }),
      );
      mocks.budgetApi.createTransaction$.mockReturnValue(
        throwError(() => refusal),
      );
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.dashboardData()).not.toBeNull();
      });

      const outcome = await store.addTransaction({
        budgetId: 'budget-1',
        name: 'Retrait Maison',
        amount: 100,
        kind: 'income',
        sourceSavingsGoalId: '11111111-1111-4111-8111-111111111111',
      });

      const localizer = TestBed.inject(ApiErrorLocalizer);
      expect(outcome).toEqual({ reason: localizer.localizeApiError(refusal) });
      expect(store.error()).toBeUndefined();
    });

    // What the confirmation toast promises. A transaction recorded by mistake
    // was previously only removable from another page, so the id has to survive
    // the create for the undo to have anything to delete.
    it('should hand back the created id so the write can be undone', async () => {
      const budget = createMockBudget();
      const newTx = createMockTransaction({ id: 'tx-new', name: 'Courses' });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: [] }),
      );
      mocks.budgetApi.createTransaction$.mockReturnValue(
        of({ success: true, data: newTx }),
      );
      mocks.budgetApi.deleteTransaction$.mockReturnValue(of(undefined));
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.dashboardData()).not.toBeNull();
      });

      const outcome = await store.addTransaction({
        budgetId: 'budget-1',
        name: 'Courses',
        amount: 80,
        kind: 'expense',
      });
      expect(outcome).toEqual({ transactionId: 'tx-new' });

      const refusal = await store.deleteTransaction('tx-new');

      expect(refusal).toBeNull();
      expect(mocks.budgetApi.deleteTransaction$).toHaveBeenCalledWith('tx-new');
      expect(store.transactions()).toEqual([]);
    });

    it('should put the transaction back when the undo fails', async () => {
      const budget = createMockBudget();
      const existingTx = createMockTransaction({ id: 'tx-existing' });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [existingTx], budgetLines: [] }),
      );
      mocks.budgetApi.deleteTransaction$.mockReturnValue(
        throwError(() => new Error('API error')),
      );
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.transactions().length).toBe(1);
      });

      const refusal = await store.deleteTransaction('tx-existing');

      expect(refusal).toBeTruthy();
      expect(store.transactions()).toEqual([existingTx]);
    });
  });

  describe('User can check budget lines', () => {
    it('should optimistically set checkedAt when checking unchecked line', async () => {
      const budget = createMockBudget();
      const line = createMockBudgetLine({
        id: 'line-check',
        checkedAt: null,
      });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: [line] }),
      );
      mocks.budgetApi.toggleBudgetLineCheck$.mockReturnValue(
        of({
          success: true,
          data: { ...line, checkedAt: '2025-06-15T12:00:00Z' },
        }),
      );
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.budgetLines().length).toBe(1);
      });

      await store.checkBudgetLine('line-check');

      expect(store.budgetLines()[0].checkedAt).not.toBeNull();
    });

    it('should be a no-op for already-checked items', async () => {
      const budget = createMockBudget();
      const line = createMockBudgetLine({
        id: 'line-already-checked',
        checkedAt: '2025-06-10T00:00:00Z',
      });

      const { store, budgetApi } = await setupWithBudgetAndWait(
        budget,
        [line],
        [],
      );

      await store.checkBudgetLine('line-already-checked');

      expect(budgetApi.toggleBudgetLineCheck$).not.toHaveBeenCalled();
      expect(store.budgetLines()[0].checkedAt).toBe('2025-06-10T00:00:00Z');
    });

    it('should be a no-op for items already in pendingChecks (dedup)', async () => {
      const budget = createMockBudget();
      const line = createMockBudgetLine({
        id: 'line-dedup',
        checkedAt: null,
      });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: [line] }),
      );
      // Never resolves — keeps the first call in-flight
      mocks.budgetApi.toggleBudgetLineCheck$.mockReturnValue(NEVER);
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.budgetLines().length).toBe(1);
      });

      // Fire first call (will stay pending)
      store.checkBudgetLine('line-dedup');

      // Second call should be a no-op
      await store.checkBudgetLine('line-dedup');

      expect(mocks.budgetApi.toggleBudgetLineCheck$).toHaveBeenCalledTimes(1);
    });

    it('should drop checked line from uncheckedForecasts immediately and track it in pendingChecks', async () => {
      const budget = createMockBudget();
      const lines = [
        createMockBudgetLine({
          id: 'line-a',
          recurrence: 'fixed',
          checkedAt: null,
        }),
        createMockBudgetLine({
          id: 'line-b',
          recurrence: 'one_off',
          checkedAt: null,
        }),
      ];

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: lines }),
      );
      // Never resolves — keeps the mutation in flight
      mocks.budgetApi.toggleBudgetLineCheck$.mockReturnValue(NEVER);
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.uncheckedForecasts().length).toBe(2);
      });

      // Check line-a — store applies optimistic checkedAt, line drops from
      // uncheckedForecasts immediately. Component owns the exit animation.
      store.checkBudgetLine('line-a');

      await vi.waitFor(() => {
        expect(store.uncheckedForecasts().length).toBe(1);
        expect(store.uncheckedForecasts()[0].id).toBe('line-b');
        expect(store.pendingChecks().has('line-a')).toBe(true);
      });
    });

    it('should rollback on API error and remove from pendingChecks', async () => {
      const budget = createMockBudget();
      const line = createMockBudgetLine({
        id: 'line-fail',
        checkedAt: null,
        recurrence: 'fixed',
      });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: [line] }),
      );
      mocks.budgetApi.toggleBudgetLineCheck$.mockReturnValue(
        throwError(() => new Error('Toggle failed')),
      );
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.budgetLines().length).toBe(1);
      });

      const refusal = await store.checkBudgetLine('line-fail');

      // Hands the reason back to the caller, which is what raises the snackbar —
      // the `error` signal would collapse the whole page into a "could not load"
      // card.
      expect(refusal).not.toBeNull();
      expect(store.error()).toBeUndefined();
      // Should rollback checkedAt to null
      expect(store.budgetLines()[0].checkedAt).toBeNull();
      // Should be removed from pendingChecks → reappear in uncheckedForecasts
      expect(store.uncheckedForecasts().length).toBe(1);
      expect(store.pendingChecks().size).toBe(0);
    });

    it('should handle two rapid calls for different items independently', async () => {
      const budget = createMockBudget();
      const lines = [
        createMockBudgetLine({
          id: 'line-x',
          recurrence: 'fixed',
          checkedAt: null,
        }),
        createMockBudgetLine({
          id: 'line-y',
          recurrence: 'one_off',
          checkedAt: null,
        }),
      ];

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: lines }),
      );
      mocks.budgetApi.toggleBudgetLineCheck$.mockReturnValue(
        of({ success: true }),
      );
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.uncheckedForecasts().length).toBe(2);
      });

      // Fire both concurrently
      await Promise.all([
        store.checkBudgetLine('line-x'),
        store.checkBudgetLine('line-y'),
      ]);

      expect(mocks.budgetApi.toggleBudgetLineCheck$).toHaveBeenCalledTimes(2);
      expect(store.budgetLines()[0].checkedAt).not.toBeNull();
      expect(store.budgetLines()[1].checkedAt).not.toBeNull();
      // Lines drop from uncheckedForecasts immediately (component owns exit animation)
      expect(store.uncheckedForecasts().length).toBe(0);
      // Pending cleared atomically by mutation onSuccess
      await vi.waitFor(() => {
        expect(store.pendingChecks().size).toBe(0);
      });
    });

    it('should not leak pending entries when SWR refetch fires during mutation (PUL-148)', async () => {
      const budget = createMockBudget();
      const lineA = createMockBudgetLine({
        id: 'line-a',
        recurrence: 'fixed',
        checkedAt: null,
      });

      const mocks = createMocks();
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({ budget, transactions: [], budgetLines: [lineA] }),
      );

      // Subject lets us resolve the mutation on demand to simulate slow API
      const toggleSubject = new Subject<{ data: BudgetLine }>();
      mocks.budgetApi.toggleBudgetLineCheck$.mockReturnValue(
        toggleSubject.asObservable(),
      );

      const { store } = setup(mocks);
      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.budgetLines().length).toBe(1);
      });

      // 1. Click — onMutate adds pending + optimistic checkedAt
      store.checkBudgetLine('line-a');
      await vi.waitFor(() => {
        expect(store.pendingChecks().has('line-a')).toBe(true);
      });

      // Verify optimistic state is set
      expect(store.budgetLines()[0].checkedAt).not.toBeNull();
      expect(store.uncheckedForecasts().some((l) => l.id === 'line-a')).toBe(
        false,
      );

      // 2. SWR refetch returns line still unchecked (server hasn't saved yet)
      mocks.budgetApi.getDashboardData$.mockReturnValue(
        of({
          budget,
          transactions: [],
          budgetLines: [{ ...lineA, checkedAt: null }],
        }),
      );
      store.refreshData();
      await vi.waitFor(() => {
        expect(mocks.budgetApi.getDashboardData$).toHaveBeenCalledTimes(2);
      });

      // Verify pending survived the refetch
      await vi.waitFor(() => {
        expect(store.pendingChecks().has('line-a')).toBe(true);
      });

      // 3. Mutation resolves successfully (server saved the toggle)
      toggleSubject.next({
        data: { ...lineA, checkedAt: '2025-06-15T12:00:00Z' },
      });
      toggleSubject.complete();

      // 4. Pending must be cleared — PRE-FIX leaks because effect re-run
      //    cancelled the prior 500ms timer and confirmed was empty after refetch
      await vi.waitFor(
        () => {
          expect(store.pendingChecks().size).toBe(0);
        },
        { timeout: 1500 },
      );
    });
  });

  describe('User can undo a check', () => {
    it('should clear checkedAt and put the line back in the unchecked list', async () => {
      const budget = createMockBudget();
      const line = createMockBudgetLine({
        id: 'line-undo',
        checkedAt: '2025-06-15T12:00:00Z',
      });

      const { store, budgetApi } = await setupWithBudgetAndWait(
        budget,
        [line],
        [],
      );
      budgetApi.toggleBudgetLineCheck$.mockReturnValue(
        of({ success: true, data: { ...line, checkedAt: null } }),
      );

      const refusal = await store.uncheckBudgetLine('line-undo');

      expect(refusal).toBeNull();
      expect(store.budgetLines()[0].checkedAt).toBeNull();
      expect(store.uncheckedForecasts().length).toBe(1);
    });

    it('should restore the original timestamp when the undo is refused', async () => {
      const budget = createMockBudget();
      const line = createMockBudgetLine({
        id: 'line-undo-fail',
        checkedAt: '2025-06-15T12:00:00Z',
      });

      const { store, budgetApi } = await setupWithBudgetAndWait(
        budget,
        [line],
        [],
      );
      budgetApi.toggleBudgetLineCheck$.mockReturnValue(
        throwError(() => new Error('Toggle failed')),
      );

      const refusal = await store.uncheckBudgetLine('line-undo-fail');

      expect(refusal).not.toBeNull();
      expect(store.budgetLines()[0].checkedAt).toBe('2025-06-15T12:00:00Z');
      expect(store.pendingChecks().size).toBe(0);
    });

    it('should report failure rather than silence when there is nothing to undo', async () => {
      const budget = createMockBudget();
      const line = createMockBudgetLine({
        id: 'line-never-checked',
        checkedAt: null,
      });

      const { store, budgetApi } = await setupWithBudgetAndWait(
        budget,
        [line],
        [],
      );

      const refusal = await store.uncheckBudgetLine('line-never-checked');

      expect(refusal).not.toBeNull();
      expect(budgetApi.toggleBudgetLineCheck$).not.toHaveBeenCalled();
    });
  });

  describe('Computed selectors', () => {
    it('should return recentTransactions sorted by date desc, limited to 5', async () => {
      const budget = createMockBudget();
      const txs = Array.from({ length: 8 }, (_, i) =>
        createMockTransaction({
          id: `tx-${i}`,
          name: `TX ${i}`,
          transactionDate: `2025-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        }),
      );
      const { store } = await setupWithBudgetAndWait(budget, [], txs);

      const recent = store.recentTransactions();
      expect(recent.length).toBe(5);
      // Most recent first (tx-7 is June 8, tx-6 is June 7, etc.)
      expect(recent[0].id).toBe('tx-7');
      expect(recent[4].id).toBe('tx-3');
    });

    it('should filter uncheckedForecasts by recurrence and checkedAt', async () => {
      const budget = createMockBudget();
      const lines = [
        createMockBudgetLine({
          id: 'fixed-unchecked',
          recurrence: 'fixed',
          checkedAt: null,
        }),
        createMockBudgetLine({
          id: 'one-off-unchecked',
          recurrence: 'one_off',
          checkedAt: null,
        }),
        createMockBudgetLine({
          id: 'fixed-checked',
          recurrence: 'fixed',
          checkedAt: '2025-06-01T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      const unchecked = store.uncheckedForecasts();
      expect(unchecked.length).toBe(2);
      expect(unchecked.map((l) => l.id)).toEqual([
        'fixed-unchecked',
        'one-off-unchecked',
      ]);
    });

    it('should list outflow forecasts before income, largest first', async () => {
      const budget = createMockBudget();
      const lines = [
        createMockBudgetLine({
          id: 'salary',
          kind: 'income',
          amount: 3500,
          checkedAt: null,
        }),
        createMockBudgetLine({
          id: 'groceries',
          kind: 'expense',
          amount: 400,
          checkedAt: null,
        }),
        createMockBudgetLine({
          id: 'rent',
          kind: 'expense',
          amount: 1200,
          checkedAt: null,
        }),
      ];
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      // Sorting on amount alone put the salary first on a card that asks what
      // has been spent — the biggest number, and the least relevant one.
      expect(store.uncheckedForecasts().map((l) => l.id)).toEqual([
        'rent',
        'groceries',
        'salary',
      ]);
    });

    it('should report the month within plan when nothing has gone beyond it', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 1000 }),
        createMockBudgetLine({ id: 'exp-1', kind: 'expense', amount: 900 }),
      ];
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      expect(store.paceStatus()).toBe('within-plan');
    });

    it('should stay on-track when unplanned spending trails the elapsed month', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({
          id: 'inc-1',
          kind: 'income',
          amount: 1000,
        }),
        createMockBudgetLine({
          id: 'exp-1',
          kind: 'expense',
          amount: 500,
        }),
      ];
      // The plan leaves 500 free. 100 of it has gone on something the plan did
      // not name: 20% of the margin against ~47% elapsed → on-track.
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'expense',
          amount: 100,
          budgetLineId: null,
          checkedAt: '2025-06-10T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.paceStatus()).toBe('on-track');
    });

    // The decision this verdict now encodes: the card asks the user to point a
    // prévision "dès qu'elle passe sur ton compte", and doing so on the 2nd
    // used to score the rent's full amount against 3% of elapsed month and turn
    // the hero amber. A pointed prévision is the plan being met, not a rhythm.
    it('should stay calm when a large forecast is pointed early in the month', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({
          id: 'rent',
          kind: 'expense',
          amount: 1500,
          checkedAt: '2025-06-02T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        [],
        new Date('2025-06-02T12:00:00Z'),
      );

      expect(store.realizedExpenses()).toBe(1500);
      expect(store.paceStatus()).toBe('within-plan');
    });

    // Spending inside an envelope is spending the plan already reserved, so it
    // moves the bar and the legend and leaves the verdict alone. Only the part
    // that runs past what the envelope reserved is the plan being exceeded.
    it('should count only the part of an envelope spent beyond its amount', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 2000 }),
        createMockBudgetLine({
          id: 'groceries',
          kind: 'expense',
          amount: 600,
        }),
      ];
      const withinEnvelope = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'expense',
          amount: 600,
          budgetLineId: 'groceries',
          checkedAt: '2025-06-03T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        withinEnvelope,
        new Date('2025-06-03T12:00:00Z'),
      );

      expect(store.paceStatus()).toBe('within-plan');
    });

    it('should return tight when realized spending outruns the elapsed month past its tolerance', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({
          id: 'inc-1',
          kind: 'income',
          amount: 1000,
        }),
        createMockBudgetLine({
          id: 'exp-1',
          kind: 'expense',
          amount: 900,
        }),
      ];
      // The plan leaves 100 free and 900 has gone outside it entirely: the
      // margin is spent nine times over against ~47% elapsed → tight.
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'expense',
          amount: 900,
          budgetLineId: null,
          checkedAt: '2025-06-10T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.paceStatus()).toBe('tight');
    });

    // The band is widest on the first day and closes to 5 on the last, because
    // household outflow is front-loaded: rent, insurance and the subscriptions
    // land in the first days, so against a linear clock one debit outruns the
    // month by definition. A flat 5 points made the card amber for doing the
    // one thing the product needs — recording.
    it('should not call the pace tight for one early-month debit', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 2000 }),
        createMockBudgetLine({ id: 'exp-1', kind: 'expense', amount: 1000 }),
      ];
      // The plan leaves 1'000 free and 200 of it has gone outside any envelope:
      // 20% of the margin against ~7% elapsed, over a flat 5-point band but
      // inside the ~24 points the start of a month is worth.
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'expense',
          amount: 200,
          budgetLineId: null,
          checkedAt: '2025-06-02T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
        new Date('2025-06-03T12:00:00Z'),
      );

      expect(store.paceStatus()).toBe('on-track');
    });

    // A transfer recorded from the page's own FAB carries no budgetLineId, and
    // calculateRealizedSavings skips free transactions on purpose so an
    // unlinked saving cannot contaminate a goal's confirmed total. Only
    // calculateRealizedExpenses sees it, via isOutflowKind — so subtracting
    // goal progress alone left the whole 1'500 in the numerator and the card
    // said "tu dépenses plus vite que le mois ne passe" over money set aside.
    it('should draw no pace verdict from savings recorded as a free transaction', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'exp-1', kind: 'expense', amount: 3000 }),
        createMockBudgetLine({ id: 'sav-1', kind: 'saving', amount: 1500 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'saving',
          amount: 1500,
          budgetLineId: null,
          checkedAt: '2025-06-01T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
        new Date('2025-06-02T12:00:00Z'),
      );

      // The money is out, so it belongs in what has gone out — but the verdict
      // speaks about spending, and money set aside is not money spent.
      expect(store.realizedExpenses()).toBe(1500);
      expect(store.totalSavingsRealized()).toBe(1500);
      expect(store.paceStatus()).toBe('within-plan');
    });

    // The order the reader sees has to be the order of the numbers the reader
    // sees. Sorting on the plan put a nearly-consumed 1'500 envelope rendering
    // "100" above an untouched 600 one rendering "600", and the cap at five then
    // hid rows by a size no longer printed anywhere.
    it('should order the forecasts by what each row still expects', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'rent', kind: 'expense', amount: 1500 }),
        createMockBudgetLine({ id: 'groceries', kind: 'expense', amount: 600 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'expense',
          amount: 1400,
          budgetLineId: 'rent',
          checkedAt: '2025-06-02T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.uncheckedForecasts().map((line) => line.id)).toEqual([
        'groceries',
        'rent',
      ]);
    });

    // What the user reported: 17 of 18 prévisions pointed, and the card said
    // "Dépensé 554" — the single free transaction — while calling the other
    // 3'947 "engagé", i.e. reserved and not yet spent. Pointing is the gesture
    // that says it happened; it has to move this number.
    it('should count a pointed forecast as spent, not as merely engaged', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({
          id: 'rent',
          kind: 'expense',
          amount: 1200,
          checkedAt: '2025-06-01T00:00:00Z',
        }),
        createMockBudgetLine({
          id: 'savings',
          kind: 'saving',
          amount: 300,
          checkedAt: '2025-06-01T00:00:00Z',
        }),
        createMockBudgetLine({ id: 'groceries', kind: 'expense', amount: 400 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-free',
          kind: 'expense',
          amount: 54,
          checkedAt: '2025-06-10T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      // Rent 1200 + savings 300 — everything that lowers what is left — plus
      // the free transaction. The unpointed 400 stays out.
      expect(store.realizedExpenses()).toBe(1554);
    });

    // Savings leave the account, so they count in what has gone out and in the
    // bar. They must not count in a verdict that says "tu dépenses plus vite
    // que le mois ne passe": funding an objective on the 3rd is not spending,
    // and the card turned amber for the one habit the product exists to build.
    it('should not call the pace tight for savings funded early', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'exp-1', kind: 'expense', amount: 2000 }),
        createMockBudgetLine({
          id: 'goal',
          kind: 'saving',
          amount: 1500,
          checkedAt: '2025-06-03T00:00:00Z',
        }),
      ];
      // 1500 of savings put aside, 500 spent outside any envelope against the
      // 1500 the plan left free. Only the 500 reaches the verdict; with the
      // savings in the numerator it was 40%.
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'expense',
          amount: 500,
          budgetLineId: null,
          checkedAt: '2025-06-05T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
        new Date('2025-06-05T12:00:00Z'),
      );

      expect(store.realizedExpenses()).toBe(2000);
      expect(store.paceStatus()).toBe('on-track');
    });

    // The savings card summed checked saving lines and never looked at a
    // transaction, so recording the transfer without pointing the line put
    // "Dépensé 500" in the hero legend and "Tu as mis de côté 0 CHF sur 500
    // prévus" three blocks below it, on the same screen.
    it('should credit a recorded transfer to the savings it realizes', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'goal', kind: 'saving', amount: 500 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-transfer',
          kind: 'saving',
          amount: 500,
          budgetLineId: 'goal',
          checkedAt: '2025-06-10T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.totalSavingsRealized()).toBe(500);
      expect(store.realizedExpenses()).toBe(500);
    });

    // The hero's red state means "something went past its envelope", and that
    // is only true when the plan itself fits. A plan already above the ceiling
    // reaches the same deficit without anything having gone wrong, and the card
    // has its own sentence for it.
    it('should separate a plan above the ceiling from spending that went past it', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const overCommitted = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'exp-1', kind: 'expense', amount: 3600 }),
        createMockBudgetLine({ id: 'goal', kind: 'saving', amount: 1500 }),
      ];
      const { store } = await setupWithBudgetAndWait(budget, overCommitted, []);

      expect(store.isPlanBeyondAvailable()).toBe(true);

      const affordable = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'exp-1', kind: 'expense', amount: 3000 }),
      ];
      const { store: affordableStore } = await setupWithBudgetAndWait(
        budget,
        affordable,
        [],
      );

      expect(affordableStore.isPlanBeyondAvailable()).toBe(false);
    });

    // "Rien de saisi ce mois" keyed on realized outflow, which counts neither
    // an income transaction nor an expense recorded and not yet pointed.
    it('should count an unpointed transaction as something the user recorded', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'exp-1', kind: 'expense', amount: 1000 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-1',
          kind: 'expense',
          amount: 80,
          budgetLineId: null,
          checkedAt: null,
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.realizedExpenses()).toBe(0);
      expect(store.hasRecordedActivity()).toBe(true);
    });

    // The quick-add form on this page cannot attach a transfer to a line, so
    // every transfer recorded from it moved the amount and the bar and never
    // the count: "0 sur 1 mise de côté" above "500 sur 500 prévus", over a bar
    // at 100%.
    it('should credit an unallocated transfer to the tally beside its amount', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'goal', kind: 'saving', amount: 500 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-transfer',
          kind: 'saving',
          amount: 500,
          budgetLineId: null,
          checkedAt: '2025-06-10T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.totalSavingsRealized()).toBe(500);
      expect(store.savingsCheckedCount()).toBe(1);
      // The money is set aside; the prévision is still not pointed, and the
      // list beside this card still offers it.
      expect(store.areSavingsFullyPointed()).toBe(false);
    });

    it('should not credit a transfer that covers none of the plan', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'goal', kind: 'saving', amount: 500 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-transfer',
          kind: 'saving',
          amount: 200,
          budgetLineId: null,
          checkedAt: '2025-06-10T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.savingsCheckedCount()).toBe(0);
    });

    // The count credits a covered line, which is right for "mise de côté" and
    // wrong for "c'est fait": that line still waits in the list beside it.
    it('should not call the savings pointed when a covered line is unpointed', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({ id: 'inc-1', kind: 'income', amount: 5000 }),
        createMockBudgetLine({ id: 'goal', kind: 'saving', amount: 500 }),
      ];
      const transactions = [
        createMockTransaction({
          id: 'tx-transfer',
          kind: 'saving',
          amount: 500,
          budgetLineId: 'goal',
          checkedAt: '2025-06-10T00:00:00Z',
        }),
      ];
      const { store } = await setupWithBudgetAndWait(
        budget,
        lines,
        transactions,
      );

      expect(store.savingsCheckedCount()).toBe(1);
      expect(store.areSavingsFullyPointed()).toBe(false);
    });

    it('should clamp budgetConsumedPercentage to [0, 100]', async () => {
      const budget = createMockBudget({ rollover: 0 });
      const lines = [
        createMockBudgetLine({
          id: 'inc-1',
          kind: 'income',
          amount: 100,
        }),
        createMockBudgetLine({
          id: 'exp-1',
          kind: 'expense',
          amount: 200,
        }),
      ];
      // consumed = 200/100 = 200% → clamped to 100
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      expect(store.budgetConsumedPercentage()).toBe(100);
    });

    it('should compute timeElapsedPercentage from period dates', async () => {
      const { store } = await setupWithBudgetAndWait(
        createMockBudget(),
        [],
        [],
      );

      const elapsed = store.timeElapsedPercentage();
      // June 1–30 with current date June 15: ~47-48%
      expect(elapsed).toBeGreaterThan(40);
      expect(elapsed).toBeLessThan(55);
    });

    it('should count today as the day of the period, both ends included', () => {
      const { store } = setup();

      expect(store.elapsedDayOfPeriod()).toBe(15);
    });

    it('should count the day from the pay day, not from the 1st', () => {
      const mocks = createMocks();
      mocks.userSettingsStore.payDayOfMonth.set(27);
      const { store } = setup(mocks);

      // Period runs 27 May – 26 June, so 15 June is its 20th day.
      expect(store.elapsedDayOfPeriod()).toBe(20);
    });
  });

  describe('Empty states', () => {
    it('should handle no budget gracefully', async () => {
      const mocks = createMocks();
      // Default mock already returns { budget: null, ... }
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        const data = store.dashboardData();
        expect(data).not.toBeNull();
        expect(data!.budget).toBeNull();
      });

      expect(store.transactions()).toEqual([]);
      expect(store.budgetLines()).toEqual([]);
      expect(store.rolloverAmount()).toBe(0);
      expect(store.totalIncome()).toBe(0);
      expect(store.totalExpenses()).toBe(0);
      expect(store.remaining()).toBe(0);
    });
  });
});

// ── Section 2: Pay Day Integration ──
describe('DashboardStore - Pay Day Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute period as June 2025 with payDay=1', () => {
    const { store } = setup();

    expect(store.currentBudgetPeriod()).toEqual({ month: 6, year: 2025 });
  });

  it('should compute period with payDay=27 (2nd quinzaine)', () => {
    const mocks = createMocks();
    mocks.userSettingsStore.payDayOfMonth.set(27);
    const { store } = setup(mocks);

    // June 15 with payDay=27: day < 27 → previous month → May
    // quinzaine rule: payDay > 15 → +1 month → June 2025
    expect(store.currentBudgetPeriod()).toEqual({ month: 6, year: 2025 });
  });

  it('should compute period with payDay=5 (1st quinzaine)', () => {
    const mocks = createMocks();
    mocks.userSettingsStore.payDayOfMonth.set(5);
    const { store } = setup(mocks);

    // June 15 with payDay=5: day >= 5 → June
    // quinzaine rule: payDay <= 15 → no shift → June 2025
    expect(store.currentBudgetPeriod()).toEqual({ month: 6, year: 2025 });
  });

  it('should fall back to calendar month with payDay=null', () => {
    const mocks = createMocks();
    mocks.userSettingsStore.payDayOfMonth.set(null);
    const { store } = setup(mocks);

    expect(store.currentBudgetPeriod()).toEqual({ month: 6, year: 2025 });
  });

  it('should compute correct periodDates for payDay=1', () => {
    const { store } = setup();

    const dates = store.periodDates();
    expect(dates.startDate.getMonth()).toBe(5); // June (0-indexed)
    expect(dates.startDate.getDate()).toBe(1);
    expect(dates.endDate.getMonth()).toBe(5);
    expect(dates.endDate.getDate()).toBe(30);
  });

  it('should call API with computed budget period month/year', async () => {
    const mocks = createMocks();
    setup(mocks);

    TestBed.tick();

    await vi.waitFor(() => {
      expect(mocks.budgetApi.getDashboardData$).toHaveBeenCalledWith(
        '06',
        '2025',
      );
    });
  });
});

// ── Section 3: Savings ──
describe('DashboardStore - Savings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute totalSavingsPlanned from budget lines with kind=saving', async () => {
    const budget = createMockBudget();
    const lines = [
      createMockBudgetLine({
        id: 'sav-1',
        kind: 'saving',
        amount: 500,
      }),
      createMockBudgetLine({
        id: 'sav-2',
        kind: 'saving',
        amount: 300,
      }),
      createMockBudgetLine({
        id: 'exp-1',
        kind: 'expense',
        amount: 200,
      }),
    ];
    const { store } = await setupWithBudgetAndWait(budget, lines, []);

    expect(store.totalSavingsPlanned()).toBe(800);
  });

  it('should compute totalSavingsRealized from checked budget lines with kind=saving', async () => {
    const budget = createMockBudget();
    const lines = [
      createMockBudgetLine({
        id: 'sav-checked-1',
        kind: 'saving',
        amount: 200,
        checkedAt: '2025-06-10T00:00:00Z',
      }),
      createMockBudgetLine({
        id: 'sav-checked-2',
        kind: 'saving',
        amount: 100,
        checkedAt: '2025-06-12T00:00:00Z',
      }),
      createMockBudgetLine({
        id: 'sav-unchecked',
        kind: 'saving',
        amount: 300,
        checkedAt: null,
      }),
      createMockBudgetLine({
        id: 'exp-checked',
        kind: 'expense',
        amount: 500,
        checkedAt: '2025-06-01T00:00:00Z',
      }),
    ];
    const { store } = await setupWithBudgetAndWait(budget, lines, []);

    expect(store.totalSavingsRealized()).toBe(300);
  });

  it('should return 0 for savings when none exist', async () => {
    const budget = createMockBudget();
    const lines = [
      createMockBudgetLine({
        id: 'exp-1',
        kind: 'expense',
        amount: 100,
      }),
    ];
    const { store } = await setupWithBudgetAndWait(budget, lines, []);

    expect(store.totalSavingsPlanned()).toBe(0);
    expect(store.totalSavingsRealized()).toBe(0);
  });

  it('should compute savingsCheckedCount from checked saving lines', async () => {
    const budget = createMockBudget();
    const lines = [
      createMockBudgetLine({
        id: 'sav-1',
        kind: 'saving',
        amount: 200,
        checkedAt: '2025-06-10T00:00:00Z',
      }),
      createMockBudgetLine({
        id: 'sav-2',
        kind: 'saving',
        amount: 100,
        checkedAt: null,
      }),
      createMockBudgetLine({
        id: 'sav-3',
        kind: 'saving',
        amount: 300,
        checkedAt: '2025-06-12T00:00:00Z',
      }),
      createMockBudgetLine({
        id: 'exp-1',
        kind: 'expense',
        amount: 500,
        checkedAt: '2025-06-01T00:00:00Z',
      }),
    ];
    const { store } = await setupWithBudgetAndWait(budget, lines, []);

    expect(store.savingsCheckedCount()).toBe(2);
  });

  it('should compute savingsTotalCount from all saving lines', async () => {
    const budget = createMockBudget();
    const lines = [
      createMockBudgetLine({
        id: 'sav-1',
        kind: 'saving',
        amount: 200,
      }),
      createMockBudgetLine({
        id: 'sav-2',
        kind: 'saving',
        amount: 100,
      }),
      createMockBudgetLine({
        id: 'exp-1',
        kind: 'expense',
        amount: 500,
      }),
    ];
    const { store } = await setupWithBudgetAndWait(budget, lines, []);

    expect(store.savingsTotalCount()).toBe(2);
  });
});

// ── Section 4: History & Upcoming Data ──

async function setupWithHistory(
  historyEntries: {
    id: string;
    month: number;
    year: number;
    totalIncome?: number;
    totalExpenses?: number;
    totalSavings?: number;
  }[],
) {
  const mocks = createMocks();
  mocks.budgetApi.getHistoryData$.mockReturnValue(
    of(
      historyEntries.map((e) => ({
        id: e.id,
        month: e.month,
        year: e.year,
        income: e.totalIncome ?? 0,
        expenses: e.totalExpenses ?? 0,
        savings: e.totalSavings ?? 0,
      })),
    ),
  );
  const result = setup(mocks);

  TestBed.tick();
  await vi.waitFor(() => {
    expect(mocks.budgetApi.getHistoryData$).toHaveBeenCalled();
  });
  TestBed.tick();

  return result;
}

describe('DashboardStore - History Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return history data filtered to past and present months only', async () => {
    // FIXED_DATE = June 15 2025, currentBudgetPeriod = { month: 6, year: 2025 }
    // Include past, present, and future months
    const { store } = await setupWithHistory([
      { id: 'h1', month: 4, year: 2025, totalIncome: 4000 },
      { id: 'h2', month: 5, year: 2025, totalIncome: 4500 },
      { id: 'h3', month: 6, year: 2025, totalIncome: 5000 }, // current
      { id: 'h4', month: 7, year: 2025, totalIncome: 5500 }, // future
      { id: 'h5', month: 8, year: 2025, totalIncome: 6000 }, // future
    ]);

    await vi.waitFor(() => {
      const history = store.historyData();
      expect(history.length).toBe(3);
      expect(history.map((h) => h.month)).toEqual([4, 5, 6]);
    });
  });

  it('should return data in chronological ascending order', async () => {
    // Provide data in random order
    const { store } = await setupWithHistory([
      { id: 'h3', month: 6, year: 2025 },
      { id: 'h1', month: 3, year: 2025 },
      { id: 'h2', month: 5, year: 2025 },
      { id: 'h4', month: 4, year: 2025 },
    ]);

    await vi.waitFor(() => {
      const history = store.historyData();
      expect(history.length).toBe(4);
      expect(history.map((h) => h.month)).toEqual([3, 4, 5, 6]);
    });
  });

  it('should limit to 6 months maximum', async () => {
    // Provide 10 past months
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: `h${i}`,
      month: ((i + 9 - 1) % 12) + 1, // Sept 2024 through June 2025
      year: i < 4 ? 2024 : 2025,
      totalIncome: 1000 * (i + 1),
    }));

    const { store } = await setupWithHistory(entries);

    await vi.waitFor(() => {
      const history = store.historyData();
      expect(history.length).toBe(6);
      // Should be the 6 most recent (Jan–June 2025)
      expect(history[0].month).toBe(1);
      expect(history[0].year).toBe(2025);
      expect(history[5].month).toBe(6);
      expect(history[5].year).toBe(2025);
    });
  });

  it('should return empty array when no history data', async () => {
    const { store } = await setupWithHistory([]);

    await vi.waitFor(() => {
      expect(store.historyData()).toEqual([]);
    });
  });
});

describe('DashboardStore - Upcoming Budgets Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate exactly 12 forecast entries starting from next month', async () => {
    // currentBudgetPeriod = { month: 6, year: 2025 }, so next month = July 2025
    const { store } = await setupWithHistory([]);

    await vi.waitFor(() => {
      const upcoming = store.upcomingBudgetsData();
      expect(upcoming.length).toBe(12);
      expect(upcoming[0]).toEqual(
        expect.objectContaining({ month: 7, year: 2025 }),
      );
      expect(upcoming[11]).toEqual(
        expect.objectContaining({ month: 6, year: 2026 }),
      );
    });
  });

  it('should still fill twelve months when the history request fails', async () => {
    const mocks = createMocks();
    mocks.budgetApi.getHistoryData$.mockReturnValue(
      throwError(() => new Error('history unreachable')),
    );
    const { store } = setup(mocks);

    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.historyError()).toBeDefined();
    });

    // The list is a calendar, not a result set: it is generated from the
    // current period and stays full whatever came back. So its length can
    // never tell a caller whether the fetch worked, and the "Mois prochain"
    // block has to ask historyError() first — behind a length test, its error
    // state is unreachable and a dead request renders as "no budget yet".
    expect(store.upcomingBudgetsData().length).toBe(12);
    expect(store.upcomingBudgetsData()[0].hasBudget).toBe(false);
  });

  it('should name a refused dashboard request instead of blaming the connection', async () => {
    const mocks = createMocks();
    const refusal = new ApiError(
      'Unauthorized',
      API_ERROR_CODES.AUTH_UNAUTHORIZED,
      401,
      undefined,
    );
    mocks.budgetApi.getDashboardData$.mockReturnValue(
      throwError(() => refusal),
    );
    const { store } = setup(mocks);

    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.error()).toBeDefined();
    });

    const localizer = TestBed.inject(ApiErrorLocalizer);
    const connectionCopy = TestBed.inject(TranslocoService).translate(
      'currentMonth.loadErrorMessage',
    );
    expect(store.loadErrorMessage()).toBe(localizer.localizeApiError(refusal));
    expect(store.loadErrorMessage()).not.toBe(connectionCopy);
  });

  it('should keep the connection wording when the request never reached the server', async () => {
    const mocks = createMocks();
    mocks.budgetApi.getDashboardData$.mockReturnValue(
      throwError(() => new Error('Network request failed')),
    );
    const { store } = setup(mocks);

    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.error()).toBeDefined();
    });

    expect(store.loadErrorMessage()).toBe(
      TestBed.inject(TranslocoService).translate(
        'currentMonth.loadErrorMessage',
      ),
    );
  });

  it('should map history data when matching month/year found', async () => {
    const { store } = await setupWithHistory([
      {
        id: 'h1',
        month: 7,
        year: 2025,
        totalIncome: 5000,
        totalExpenses: 3000,
        totalSavings: 500,
      },
      {
        id: 'h2',
        month: 9,
        year: 2025,
        totalIncome: 5500,
        totalExpenses: 3200,
        totalSavings: 600,
      },
    ]);

    await vi.waitFor(() => {
      const upcoming = store.upcomingBudgetsData();
      // July 2025 (index 0) should have budget data
      expect(upcoming[0]).toEqual({
        month: 7,
        year: 2025,
        hasBudget: true,
        income: 5000,
        expenses: 3000,
        savings: 500,
      });
      // September 2025 (index 2) should have budget data
      expect(upcoming[2]).toEqual({
        month: 9,
        year: 2025,
        hasBudget: true,
        income: 5500,
        expenses: 3200,
        savings: 600,
      });
    });
  });

  it('should return null financials when no matching history month', async () => {
    const { store } = await setupWithHistory([]);

    await vi.waitFor(() => {
      const upcoming = store.upcomingBudgetsData();
      expect(upcoming[0]).toEqual({
        month: 7,
        year: 2025,
        hasBudget: false,
        income: null,
        expenses: null,
        savings: null,
      });
    });
  });

  it('should handle year rollover correctly', async () => {
    // Set payDay to cause December period
    const mocks = createMocks();
    // Use a date in December
    const decemberDate = new Date(2025, 11, 15); // December 15, 2025
    mocks.budgetApi.getHistoryData$.mockReturnValue(of([]));

    const { store } = setup(mocks, decemberDate);

    TestBed.tick();
    await vi.waitFor(() => {
      expect(mocks.budgetApi.getHistoryData$).toHaveBeenCalled();
    });
    TestBed.tick();

    await vi.waitFor(() => {
      const upcoming = store.upcomingBudgetsData();
      expect(upcoming.length).toBe(12);
      // December period → first forecast is January next year
      expect(upcoming[0]).toEqual(
        expect.objectContaining({ month: 1, year: 2026 }),
      );
      expect(upcoming[11]).toEqual(
        expect.objectContaining({ month: 12, year: 2026 }),
      );
    });
  });
});
