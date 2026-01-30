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

  describe('auto-invalidation on version change', () => {
    it('should clear budget list and details when invalidation version changes', async () => {
      const invalidationService = TestBed.inject(BudgetInvalidationService);

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

      expect(service.budgets()).toEqual(mockBudgets);
      expect(service.isBudgetDetailAvailable('1')).toBe(true);

      // Trigger invalidation (simulates a budget mutation)
      invalidationService.invalidate();
      // Flush the effect
      TestBed.flushEffects();

      expect(service.budgets()).toBeNull();
      expect(service.isBudgetDetailAvailable('1')).toBe(false);
    });

    it('should not invalidate on initial version (0)', () => {
      // Just after creation, cache should be in initial state
      expect(service.budgets()).toBeNull();

      // Flush any pending effects
      TestBed.flushEffects();

      // No side effect should have happened
      expect(service.budgets()).toBeNull();
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
});
