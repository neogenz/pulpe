import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import {
  type Budget,
  type BudgetDetailsResponse,
  type BudgetLine,
  type Transaction,
} from 'pulpe-shared';
import { BudgetCache } from './budget-cache';
import { BudgetApi } from './budget-api';
import { BudgetInvalidationService } from './budget-invalidation.service';
import { Logger } from '../logging/logger';

/** Flush toObservable internal effect + microtask emission pipeline */
async function flushObservable(): Promise<void> {
  TestBed.flushEffects();
  await new Promise((r) => setTimeout(r));
}

function createMockBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    month: 1,
    year: 2024,
    description: 'Monthly Budget',
    templateId: 'template-1',
    endingBalance: 1000,
    rollover: 0,
    remaining: 500,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user-1',
    previousBudgetId: null,
    ...overrides,
  };
}

function createMockBudgetDetailsResponse(
  overrides: Partial<BudgetDetailsResponse> = {},
): BudgetDetailsResponse {
  const budget = createMockBudget();
  return {
    success: true,
    data: {
      budget,
      budgetLines: [],
      transactions: [],
    },
    ...overrides,
  };
}

describe('BudgetCache', () => {
  let service: BudgetCache;
  let mockBudgetApi: {
    getAllBudgets$: ReturnType<typeof vi.fn>;
    getBudgetWithDetails$: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockBudgetApi = {
      getAllBudgets$: vi.fn(),
      getBudgetWithDetails$: vi.fn(),
    };

    mockLogger = {
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BudgetCache,
        BudgetInvalidationService,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(BudgetCache);
    // Flush initial toObservable effect so skip(1) consumes the initial emission
    TestBed.flushEffects();
  });

  describe('Initial state', () => {
    it('should have null budgets initially', () => {
      expect(service.budgets()).toBeNull();
    });

    it('should have hasBudgets false initially', () => {
      expect(service.hasBudgets()).toBe(false);
    });

    it('should not be list loading initially', () => {
      expect(service.isListLoading()).toBe(false);
    });
  });

  describe('preloadBudgetList', () => {
    it('should call API and store result in signal', async () => {
      const mockBudgets: Budget[] = [
        createMockBudget({ id: '1' }),
        createMockBudget({ id: '2' }),
      ];

      mockBudgetApi.getAllBudgets$.mockReturnValue(of(mockBudgets));

      const result = await service.preloadBudgetList();

      expect(result).toEqual(mockBudgets);
      expect(service.budgets()).toEqual(mockBudgets);
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalledOnce();
    });

    it('should use cached value if already loaded', async () => {
      const mockBudgets: Budget[] = [createMockBudget({ id: '1' })];

      mockBudgetApi.getAllBudgets$.mockReturnValue(of(mockBudgets));

      const result1 = await service.preloadBudgetList();
      const result2 = await service.preloadBudgetList();

      expect(result1).toEqual(mockBudgets);
      expect(result2).toEqual(mockBudgets);
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalledOnce();
    });

    it('should set isListLoading to true during load', async () => {
      const mockBudgets: Budget[] = [createMockBudget({ id: '1' })];

      mockBudgetApi.getAllBudgets$.mockReturnValue(of(mockBudgets));

      const promise = service.preloadBudgetList();

      expect(service.isListLoading()).toBe(true);

      await promise;
      expect(service.isListLoading()).toBe(false);
    });

    it('should return empty array on error', async () => {
      mockBudgetApi.getAllBudgets$.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      const result = await service.preloadBudgetList();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should set isListLoading to false even on error', async () => {
      mockBudgetApi.getAllBudgets$.mockReturnValue(
        throwError(() => new Error('API error')),
      );

      await service.preloadBudgetList();

      expect(service.isListLoading()).toBe(false);
    });
  });

  describe('preloadBudgetDetails', () => {
    it('should load details and store in map', async () => {
      const budgetId = 'budget-1';
      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: budgetId }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(mockResponse));

      await service.preloadBudgetDetails([budgetId]);

      expect(service.isBudgetDetailAvailable(budgetId)).toBe(true);
      const cached = service.getBudgetDetails(budgetId);
      expect(cached?.budget.id).toBe(budgetId);
      expect(mockBudgetApi.getBudgetWithDetails$).toHaveBeenCalledWith(
        budgetId,
      );
    });

    it('should skip already cached budget details', async () => {
      const budgetId = 'budget-1';
      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: budgetId }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(mockResponse));

      await service.preloadBudgetDetails([budgetId]);
      mockBudgetApi.getBudgetWithDetails$.mockClear();

      await service.preloadBudgetDetails([budgetId]);

      expect(mockBudgetApi.getBudgetWithDetails$).not.toHaveBeenCalled();
    });

    it('should load multiple budget details in parallel', async () => {
      const budgetIds = ['budget-1', 'budget-2'];
      const mockResponse1 = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: 'budget-1' }),
          budgetLines: [],
          transactions: [],
        },
      });
      const mockResponse2 = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: 'budget-2' }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getBudgetWithDetails$
        .mockReturnValueOnce(of(mockResponse1))
        .mockReturnValueOnce(of(mockResponse2));

      await service.preloadBudgetDetails(budgetIds);

      expect(service.isBudgetDetailAvailable('budget-1')).toBe(true);
      expect(service.isBudgetDetailAvailable('budget-2')).toBe(true);
    });

    it('should set isBudgetDetailLoading during load', async () => {
      const budgetId = 'budget-1';
      let loadingDuringFetch = false;

      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: budgetId }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getBudgetWithDetails$.mockImplementation(() => {
        loadingDuringFetch = service.isBudgetDetailLoading(budgetId);
        return of(mockResponse);
      });

      await service.preloadBudgetDetails([budgetId]);
      expect(loadingDuringFetch).toBe(true);
      expect(service.isBudgetDetailLoading(budgetId)).toBe(false);
    });

    it('should handle failed detail loads and log error', async () => {
      const budgetId = 'budget-1';

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(
        throwError(() => new Error('Detail load failed')),
      );

      await service.preloadBudgetDetails([budgetId]);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(service.isBudgetDetailAvailable(budgetId)).toBe(false);
    });

    it('should clear loading state even on error', async () => {
      const budgetId = 'budget-1';

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(
        throwError(() => new Error('Detail load failed')),
      );

      await service.preloadBudgetDetails([budgetId]);

      expect(service.isBudgetDetailLoading(budgetId)).toBe(false);
    });

    it('should return early if no ids to load', async () => {
      await service.preloadBudgetDetails([]);

      expect(mockBudgetApi.getBudgetWithDetails$).not.toHaveBeenCalled();
    });
  });

  describe('getBudgetDetails', () => {
    it('should return null if not cached', () => {
      const result = service.getBudgetDetails('budget-1');

      expect(result).toBeNull();
    });

    it('should return entry if cached', async () => {
      const budgetId = 'budget-1';
      const budgetLines: BudgetLine[] = [
        { id: 'line-1', name: 'Line 1', amount: 500 },
      ] as BudgetLine[];
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          budgetId: budgetId,
          budgetLineId: null,
          name: 'Transaction 1',
          amount: 100,
          kind: 'expense',
          transactionDate: '2024-01-01T00:00:00Z',
          category: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          checkedAt: null,
        },
      ];

      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: budgetId }),
          budgetLines,
          transactions,
        },
      });

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(mockResponse));

      await service.preloadBudgetDetails([budgetId]);

      const result = service.getBudgetDetails(budgetId);

      expect(result).not.toBeNull();
      expect(result?.budget.id).toBe(budgetId);
      expect(result?.budgetLines).toEqual(budgetLines);
      expect(result?.transactions).toEqual(transactions);
    });
  });

  describe('isBudgetDetailLoading', () => {
    it('should return false initially', () => {
      expect(service.isBudgetDetailLoading('budget-1')).toBe(false);
    });

    it('should return true during load', async () => {
      const budgetId = 'budget-1';
      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: budgetId }),
          budgetLines: [],
          transactions: [],
        },
      });

      let loadingState = false;

      mockBudgetApi.getBudgetWithDetails$.mockImplementation(() => {
        loadingState = service.isBudgetDetailLoading(budgetId);
        return of(mockResponse);
      });

      await service.preloadBudgetDetails([budgetId]);
      expect(loadingState).toBe(true);
      expect(service.isBudgetDetailLoading(budgetId)).toBe(false);
    });
  });

  describe('isBudgetDetailAvailable', () => {
    it('should return false initially', () => {
      expect(service.isBudgetDetailAvailable('budget-1')).toBe(false);
    });

    it('should return true after preload', async () => {
      const budgetId = 'budget-1';
      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: budgetId }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(mockResponse));

      await service.preloadBudgetDetails([budgetId]);

      expect(service.isBudgetDetailAvailable(budgetId)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should reset all state to initial values', async () => {
      const mockBudgets: Budget[] = [createMockBudget({ id: '1' })];
      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: '1' }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getAllBudgets$.mockReturnValue(of(mockBudgets));
      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(mockResponse));

      await service.preloadBudgetList();
      await service.preloadBudgetDetails(['1']);

      expect(service.budgets()).not.toBeNull();
      expect(service.isBudgetDetailAvailable('1')).toBe(true);

      service.clear();

      expect(service.budgets()).toBeNull();
      expect(service.hasBudgets()).toBe(false);
      expect(service.isBudgetDetailAvailable('1')).toBe(false);
      expect(service.isListLoading()).toBe(false);
    });
  });

  describe('revalidation on version change', () => {
    it('should clear list, mark details stale, and trigger background re-fetch on version change', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);

      const initialBudgets: Budget[] = [createMockBudget({ id: '1' })];
      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: '1' }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getAllBudgets$.mockReturnValue(of(initialBudgets));
      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(mockResponse));

      await service.preloadBudgetList();
      await service.preloadBudgetDetails(['1']);

      expect(service.budgets()).toEqual(initialBudgets);
      expect(service.isBudgetDetailAvailable('1')).toBe(true);

      mockBudgetApi.getAllBudgets$.mockReset();
      mockBudgetApi.getBudgetWithDetails$.mockReset();

      // Trigger invalidation (simulates a budget mutation)
      invalidationService.invalidate();
      await flushObservable();

      // List cache is cleared (no auto-refetch of list)
      expect(service.budgets()).toBeNull();
      expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();

      // Background re-fetch was triggered for stale details (failed due to mockReset)
      expect(service.isBudgetDetailAvailable('1')).toBe(true);
      expect(service.isBudgetDetailStale('1')).toBe(true);
      expect(mockBudgetApi.getBudgetWithDetails$).toHaveBeenCalledWith('1');
    });

    it('should not invalidate on initial version (0)', async () => {
      // Just after creation, cache should be in initial state
      expect(service.budgets()).toBeNull();

      // Flush internal effect + microtask
      await flushObservable();

      // No side effect should have happened (skip(1) ignores initial)
      expect(service.budgets()).toBeNull();
      expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
    });
  });

  describe('preloadBudgetList deduplication', () => {
    it('should share the same API call for concurrent requests', async () => {
      const mockBudgets: Budget[] = [createMockBudget({ id: '1' })];
      mockBudgetApi.getAllBudgets$.mockReturnValue(of(mockBudgets));

      const [result1, result2] = await Promise.all([
        service.preloadBudgetList(),
        service.preloadBudgetList(),
      ]);

      expect(result1).toEqual(mockBudgets);
      expect(result2).toEqual(mockBudgets);
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalledOnce();
    });
  });

  describe('waitForBudgetDetails', () => {
    it('should return immediately if already cached', async () => {
      const budgetId = 'budget-1';
      const mockResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({ id: budgetId }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(mockResponse));

      await service.preloadBudgetDetails([budgetId]);

      const result = await service.waitForBudgetDetails(budgetId);

      expect(result!.budget.id).toBe(budgetId);
    });
  });

  describe('Navigation scenarios with cache revalidation', () => {
    const budget1 = createMockBudget({ id: 'jan-2024', month: 1, year: 2024 });
    const budget2 = createMockBudget({ id: 'feb-2024', month: 2, year: 2024 });
    const budget3 = createMockBudget({ id: 'mar-2024', month: 3, year: 2024 });
    const allBudgets = [budget1, budget2, budget3];

    function createDetailsResponse(budget: Budget): BudgetDetailsResponse {
      return createMockBudgetDetailsResponse({
        data: { budget, budgetLines: [], transactions: [] },
      });
    }

    function setupInitialPreload(): void {
      mockBudgetApi.getAllBudgets$.mockReturnValue(of(allBudgets));
      mockBudgetApi.getBudgetWithDetails$.mockImplementation((id: string) => {
        const target = allBudgets.find((bgt) => bgt.id === id);
        return of(createDetailsResponse(target ?? budget1));
      });
    }

    it('Scenario 1: Initial preload → navigate to budget → cache hit', async () => {
      setupInitialPreload();

      // Phase 1: App preloads all data on login
      const budgets = await service.preloadBudgetList();
      await service.preloadBudgetDetails(budgets.map((b) => b.id));

      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalledOnce();
      expect(mockBudgetApi.getBudgetWithDetails$).toHaveBeenCalledTimes(3);
      mockBudgetApi.getAllBudgets$.mockClear();
      mockBudgetApi.getBudgetWithDetails$.mockClear();

      // Phase 2: User navigates to january budget → cache hit, zero API calls
      const jan = service.getBudgetDetails('jan-2024');
      expect(jan).not.toBeNull();
      expect(jan!.budget.month).toBe(1);
      expect(mockBudgetApi.getBudgetWithDetails$).not.toHaveBeenCalled();

      // Phase 3: User navigates to february budget → still cache hit
      const feb = service.getBudgetDetails('feb-2024');
      expect(feb).not.toBeNull();
      expect(feb!.budget.month).toBe(2);
      expect(mockBudgetApi.getBudgetWithDetails$).not.toHaveBeenCalled();
    });

    it('Scenario 2: Edit in budget details → cache invalidated, background re-fetch triggered', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);
      setupInitialPreload();

      // Phase 1: Initial preload
      await service.preloadBudgetList();
      await service.preloadBudgetDetails(allBudgets.map((b) => b.id));

      expect(service.budgets()).not.toBeNull();
      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(true);

      mockBudgetApi.getAllBudgets$.mockReset();
      mockBudgetApi.getBudgetWithDetails$.mockReset();

      // Phase 2: User edits within budget → triggers invalidation
      invalidationService.invalidate();
      await flushObservable();

      // List is cleared (no auto-refetch of list)
      expect(service.budgets()).toBeNull();
      expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();

      // Background re-fetch was triggered for stale details (failed due to mockReset)
      expect(mockBudgetApi.getBudgetWithDetails$).toHaveBeenCalled();

      // Details still in cache but marked stale (re-fetch failed)
      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(true);
      expect(service.isBudgetDetailStale('jan-2024')).toBe(true);
      expect(service.getBudgetDetails('jan-2024')).not.toBeNull();
    });

    it('Scenario 3: Navigate back to list after edit → cache miss triggers refetch', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);
      setupInitialPreload();

      // Phase 1: Initial preload
      await service.preloadBudgetList();
      await service.preloadBudgetDetails(allBudgets.map((b) => b.id));

      expect(service.budgets()).not.toBeNull();

      // Phase 2: User edits → invalidation (clears cache)
      mockBudgetApi.getAllBudgets$.mockReturnValue(of(allBudgets));
      invalidationService.invalidate();
      await flushObservable();

      expect(service.budgets()).toBeNull();

      mockBudgetApi.getAllBudgets$.mockClear();
      mockBudgetApi.getAllBudgets$.mockReturnValue(of(allBudgets));

      // Phase 3: User navigates back to budget list → cache miss, triggers refetch
      const budgets = await service.preloadBudgetList();
      expect(budgets).toHaveLength(3);
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalledOnce();
    });

    it('Scenario 4: Navigate to different budget after edit → data already refreshed by background re-fetch', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);
      setupInitialPreload();

      // Phase 1: Initial preload
      await service.preloadBudgetList();
      await service.preloadBudgetDetails(allBudgets.map((b) => b.id));

      mockBudgetApi.getAllBudgets$.mockReset();
      mockBudgetApi.getBudgetWithDetails$.mockReset();

      // Phase 2: User is on jan-2024, edits something → invalidation
      // Background re-fetch fails (mockReset), so stale data persists
      invalidationService.invalidate();
      await flushObservable();

      expect(service.budgets()).toBeNull();

      // Phase 3: Stale data still available for display
      const staleMarch = service.getBudgetDetails('mar-2024');
      expect(staleMarch).not.toBeNull();
      expect(staleMarch!.budget.month).toBe(3);
      expect(service.isBudgetDetailStale('mar-2024')).toBe(true);

      // Phase 4: Explicit re-fetch via preloadBudgetDetails
      const freshResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({
            id: 'mar-2024',
            month: 3,
            year: 2024,
            remaining: 888,
          }),
          budgetLines: [],
          transactions: [],
        },
      });
      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(freshResponse));

      await service.preloadBudgetDetails(['mar-2024']);

      expect(service.isBudgetDetailStale('mar-2024')).toBe(false);
      expect(service.getBudgetDetails('mar-2024')!.budget.remaining).toBe(888);
    });

    it('Scenario 5: Budget not in cache (cache miss) → falls back to API', async () => {
      // No preload happened
      const result = service.getBudgetDetails('unknown-budget');
      expect(result).toBeNull();
      expect(service.isBudgetDetailLoading('unknown-budget')).toBe(false);
    });

    it('Scenario 6: Rapid mutations trigger background re-fetch', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);
      setupInitialPreload();

      await service.preloadBudgetList();
      await service.preloadBudgetDetails(['jan-2024']);

      expect(service.budgets()).not.toBeNull();
      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(true);

      mockBudgetApi.getAllBudgets$.mockReset();
      mockBudgetApi.getBudgetWithDetails$.mockReset();

      // Trigger 3 rapid invalidations
      invalidationService.invalidate();
      invalidationService.invalidate();
      invalidationService.invalidate();
      await flushObservable();

      // Cache is cleared, background re-fetch attempted (failed due to mockReset)
      expect(service.budgets()).toBeNull();
      expect(service.isBudgetDetailStale('jan-2024')).toBe(true);
      expect(mockBudgetApi.getAllBudgets$).not.toHaveBeenCalled();
      // Background re-fetch was triggered
      expect(mockBudgetApi.getBudgetWithDetails$).toHaveBeenCalled();
    });

    it('Scenario 7: preloadBudgetList after invalidation refetches data', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);
      setupInitialPreload();

      await service.preloadBudgetList();
      expect(service.budgets()).not.toBeNull();

      mockBudgetApi.getAllBudgets$.mockClear();
      mockBudgetApi.getAllBudgets$.mockReturnValue(of(allBudgets));

      // Trigger invalidation (clears cache)
      invalidationService.invalidate();
      await flushObservable();

      expect(service.budgets()).toBeNull();

      // Manual refetch via preloadBudgetList
      const storeResult = await service.preloadBudgetList();

      expect(storeResult).toHaveLength(3);
      expect(service.budgets()).not.toBeNull();
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalledOnce();
    });

    it('Scenario 8: invalidateBudgetList only clears list, not details', () => {
      setupInitialPreload();

      // Preload list only, then manually invalidate list
      service.preloadBudgetList().then(() => {
        service.invalidateBudgetList();
        // List is cleared
        expect(service.budgets()).toBeNull();
      });
    });

    it('Scenario 9: invalidateBudgetDetails only clears specific budget', async () => {
      setupInitialPreload();

      await service.preloadBudgetList();
      await service.preloadBudgetDetails(['jan-2024', 'feb-2024']);

      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(true);
      expect(service.isBudgetDetailAvailable('feb-2024')).toBe(true);

      // Invalidate only january
      service.invalidateBudgetDetails('jan-2024');

      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(false);
      expect(service.isBudgetDetailAvailable('feb-2024')).toBe(true);
    });

    it('Scenario 10: clear() resets all state including stale flags for logout', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);
      setupInitialPreload();

      await service.preloadBudgetList();
      await service.preloadBudgetDetails(['jan-2024']);

      expect(service.budgets()).not.toBeNull();
      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(true);

      // Prevent background re-fetch from succeeding
      mockBudgetApi.getBudgetWithDetails$.mockReset();

      // Trigger invalidation to mark details as stale
      invalidationService.invalidate();
      await flushObservable();

      expect(service.budgets()).toBeNull(); // Cleared by invalidation
      expect(service.isBudgetDetailStale('jan-2024')).toBe(true);

      service.clear();

      expect(service.budgets()).toBeNull();
      expect(service.hasBudgets()).toBe(false);
      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(false);
      expect(service.isBudgetDetailStale('jan-2024')).toBe(false);
      expect(service.isListLoading()).toBe(false);
    });

    it('Scenario 11: Fresh entry (never invalidated) → 0 API calls on preloadBudgetDetails', async () => {
      setupInitialPreload();

      // Phase 1: Initial preload
      await service.preloadBudgetList();
      await service.preloadBudgetDetails(allBudgets.map((b) => b.id));
      mockBudgetApi.getBudgetWithDetails$.mockClear();

      // Phase 2: No mutation happened — entries are fresh
      expect(service.isBudgetDetailStale('jan-2024')).toBe(false);
      expect(service.isBudgetDetailStale('feb-2024')).toBe(false);

      // Phase 3: preloadBudgetDetails for fresh entries → 0 API calls
      await service.preloadBudgetDetails(['jan-2024', 'feb-2024']);
      expect(mockBudgetApi.getBudgetWithDetails$).not.toHaveBeenCalled();
    });

    it('Scenario 12: Stale detail is re-fetched on preloadBudgetDetails call', async () => {
      setupInitialPreload();

      // Phase 1: Initial preload
      await service.preloadBudgetList();
      await service.preloadBudgetDetails(allBudgets.map((b) => b.id));

      // Phase 2: Mark all details as stale (simulates what #revalidate does)
      service.markAllDetailsStale();
      expect(service.isBudgetDetailStale('jan-2024')).toBe(true);

      // Phase 3: Re-fetch stale detail
      const freshResponse = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({
            id: 'jan-2024',
            month: 1,
            year: 2024,
            remaining: 777,
          }),
          budgetLines: [],
          transactions: [],
        },
      });
      mockBudgetApi.getBudgetWithDetails$.mockClear();
      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(of(freshResponse));

      await service.preloadBudgetDetails(['jan-2024']);

      expect(mockBudgetApi.getBudgetWithDetails$).toHaveBeenCalledOnce();
      expect(service.isBudgetDetailStale('jan-2024')).toBe(false);
      expect(service.getBudgetDetails('jan-2024')!.budget.remaining).toBe(777);
    });

    it('Scenario 13: Invalidation triggers background re-fetch of stale details', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);
      setupInitialPreload();

      // Phase 1: Initial preload
      await service.preloadBudgetList();
      await service.preloadBudgetDetails(allBudgets.map((b) => b.id));

      expect(service.isBudgetDetailStale('jan-2024')).toBe(false);

      // Phase 2: Prepare fresh responses for revalidation
      const freshJan = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({
            id: 'jan-2024',
            month: 1,
            year: 2024,
            remaining: 999,
          }),
          budgetLines: [],
          transactions: [],
        },
      });
      const freshFeb = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({
            id: 'feb-2024',
            month: 2,
            year: 2024,
            remaining: 888,
          }),
          budgetLines: [],
          transactions: [],
        },
      });
      const freshMar = createMockBudgetDetailsResponse({
        data: {
          budget: createMockBudget({
            id: 'mar-2024',
            month: 3,
            year: 2024,
            remaining: 777,
          }),
          budgetLines: [],
          transactions: [],
        },
      });

      mockBudgetApi.getBudgetWithDetails$.mockClear();
      mockBudgetApi.getBudgetWithDetails$.mockImplementation((id: string) => {
        if (id === 'jan-2024') return of(freshJan);
        if (id === 'feb-2024') return of(freshFeb);
        return of(freshMar);
      });

      // Phase 3: Trigger invalidation → should auto re-fetch all stale details
      invalidationService.invalidate();
      await flushObservable();

      // Wait for background re-fetch to complete
      await vi.waitFor(() => {
        expect(mockBudgetApi.getBudgetWithDetails$).toHaveBeenCalledTimes(3);
      });

      // Phase 4: All details are now fresh
      expect(service.isBudgetDetailStale('jan-2024')).toBe(false);
      expect(service.isBudgetDetailStale('feb-2024')).toBe(false);
      expect(service.isBudgetDetailStale('mar-2024')).toBe(false);
      expect(service.getBudgetDetails('jan-2024')!.budget.remaining).toBe(999);
      expect(service.getBudgetDetails('feb-2024')!.budget.remaining).toBe(888);
      expect(service.getBudgetDetails('mar-2024')!.budget.remaining).toBe(777);
    });

    it('Scenario 14: Stale data remains available for instant display', async () => {
      setupInitialPreload();

      // Phase 1: Initial preload
      await service.preloadBudgetList();
      await service.preloadBudgetDetails(allBudgets.map((b) => b.id));

      const originalDetail = service.getBudgetDetails('jan-2024');
      expect(originalDetail).not.toBeNull();

      // Phase 2: Mark as stale
      service.markAllDetailsStale();

      // Stale entry is still returned by getBudgetDetails for instant display
      const staleDetail = service.getBudgetDetails('jan-2024');
      expect(staleDetail).not.toBeNull();
      expect(staleDetail).toEqual(originalDetail);
      expect(service.isBudgetDetailStale('jan-2024')).toBe(true);
      expect(service.isBudgetDetailAvailable('jan-2024')).toBe(true);
    });
  });
});
