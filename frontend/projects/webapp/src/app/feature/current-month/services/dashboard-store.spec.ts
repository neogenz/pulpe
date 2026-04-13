import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError, NEVER } from 'rxjs';
import { DashboardStore, DASHBOARD_NOW } from './dashboard-store';
import { BudgetApi } from '@core/budget';
import { UserSettingsStore } from '@core/user-settings';
import type { Budget, BudgetLine, Transaction } from 'pulpe-shared';
import { BudgetFormulas } from 'pulpe-shared';

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
    category: null,
    createdAt: '2025-06-10T00:00:00Z',
    updatedAt: '2025-06-10T00:00:00Z',
    ...overrides,
  } as Transaction;
}

// ── Mock setup ──
function createMocks() {
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
      toggleBudgetLineCheck$: vi.fn(),
      cache: {
        version: signal(0),
        get: vi.fn().mockReturnValue(null),
        set: vi.fn(),
        invalidate: vi.fn(),
        deduplicate: vi
          .fn()
          .mockImplementation((_key: unknown, fn: () => Promise<unknown>) =>
            fn(),
          ),
        prefetch: vi.fn(),
        clearDirty: vi.fn(),
      },
    },
    userSettingsStore: {
      payDayOfMonth: signal<number | null>(1),
      isLoading: signal(false),
    },
  };
}

function setup(mocks = createMocks()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      DashboardStore,
      provideZonelessChangeDetection(),
      { provide: BudgetApi, useValue: mocks.budgetApi },
      { provide: UserSettingsStore, useValue: mocks.userSettingsStore },
      { provide: DASHBOARD_NOW, useValue: FIXED_DATE },
    ],
  });

  const store = TestBed.inject(DashboardStore);
  return { store, ...mocks };
}

async function setupWithBudgetAndWait(
  budget = createMockBudget(),
  budgetLines: BudgetLine[] = [],
  transactions: Transaction[] = [],
) {
  const mocks = createMocks();
  mocks.budgetApi.getDashboardData$.mockReturnValue(
    of({ budget, transactions, budgetLines }),
  );
  const result = setup(mocks);

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
    });

    it('should rollback on addTransaction error', async () => {
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

      // cachedMutation.mutate() never rejects — errors go to error signal
      await store.addTransaction({
        budgetId: 'budget-1',
        name: 'Fail',
        amount: 100,
        kind: 'expense',
      });

      // Should rollback to original data (via onError)
      expect(store.transactions().length).toBe(1);
      expect(store.transactions()[0].id).toBe('tx-existing');
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

    it('should keep pending items visible in uncheckedForecasts for exit animation', async () => {
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
      // Never resolves — keeps it pending
      mocks.budgetApi.toggleBudgetLineCheck$.mockReturnValue(NEVER);
      const { store } = setup(mocks);

      TestBed.tick();
      await vi.waitFor(() => {
        expect(store.uncheckedForecasts().length).toBe(2);
      });

      // Check line-a — stays visible in uncheckedForecasts while pending (exit animation)
      store.checkBudgetLine('line-a');

      await vi.waitFor(() => {
        expect(store.uncheckedForecasts().length).toBe(2);
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

      await store.checkBudgetLine('line-fail');

      // Should set error signal
      expect(store.error()).toBeTruthy();
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
      // Items stay visible during exit animation (removed after CHECK_EXIT_DELAY_MS)
      expect(store.uncheckedForecasts().length).toBe(2);
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

    it('should return on-track when consumed <= elapsed + 5', async () => {
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
          amount: 400,
        }),
      ];
      // consumed = 400/1000 = 40%, elapsed ~ 47-48%, 40 <= 48+5 → on-track
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      expect(store.paceStatus()).toBe('on-track');
    });

    it('should return tight when consumed > elapsed + 5', async () => {
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
      // consumed = 900/1000 = 90%, elapsed ~ 47-48%, 90 > 48+5 → tight
      const { store } = await setupWithBudgetAndWait(budget, lines, []);

      expect(store.paceStatus()).toBe('tight');
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

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        provideZonelessChangeDetection(),
        { provide: BudgetApi, useValue: mocks.budgetApi },
        { provide: UserSettingsStore, useValue: mocks.userSettingsStore },
        { provide: DASHBOARD_NOW, useValue: decemberDate },
      ],
    });

    const store = TestBed.inject(DashboardStore);

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
