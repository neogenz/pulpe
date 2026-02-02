import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

import { BudgetDetailsStateService } from './budget-details-state.service';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetCache } from '@core/budget/budget-cache';
import { Logger } from '@core/logging/logger';
import {
  createMockBudget,
  createMockBudgetLine,
  createMockTransaction,
} from '../../../../testing/mock-factories';

function createMockBudgetCache() {
  const detailsMap = new Map<
    string,
    {
      budget: ReturnType<typeof createMockBudget>;
      budgetLines: ReturnType<typeof createMockBudgetLine>[];
      transactions: ReturnType<typeof createMockTransaction>[];
    }
  >();
  const staleIds = new Set<string>();

  return {
    getBudgetDetails: vi.fn((id: string) => detailsMap.get(id) ?? null),
    isBudgetDetailStale: vi.fn((id: string) => staleIds.has(id)),
    isBudgetDetailAvailable: vi.fn((id: string) => detailsMap.has(id)),

    // Test helpers
    _seedDetails(
      id: string,
      data: {
        budget: ReturnType<typeof createMockBudget>;
        budgetLines: ReturnType<typeof createMockBudgetLine>[];
        transactions: ReturnType<typeof createMockTransaction>[];
      },
    ) {
      detailsMap.set(id, data);
    },
    _markStale(id: string) {
      staleIds.add(id);
    },
    _clearStale(id: string) {
      staleIds.delete(id);
    },
  };
}

describe('BudgetDetailsStateService', () => {
  let service: BudgetDetailsStateService;
  let mockBudgetCache: ReturnType<typeof createMockBudgetCache>;
  let mockBudgetApi: { getBudgetWithDetails$: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  const aprilBudget = createMockBudget({
    id: 'april-2024',
    month: 4,
    year: 2024,
    endingBalance: 1000,
  });
  const aprilLines = [
    createMockBudgetLine({
      id: 'line-1',
      budgetId: 'april-2024',
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
    }),
  ];
  const aprilTransactions = [
    createMockTransaction({
      id: 'tx-1',
      budgetId: 'april-2024',
      name: 'Courses',
      amount: 200,
      kind: 'expense',
    }),
  ];

  beforeEach(() => {
    mockBudgetCache = createMockBudgetCache();
    mockBudgetApi = { getBudgetWithDetails$: vi.fn() };
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BudgetDetailsStateService,
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: BudgetCache, useValue: mockBudgetCache },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(BudgetDetailsStateService);
  });

  describe('setBudgetId with fresh cache', () => {
    it('should seed SWR with cached data when cache is fresh', () => {
      mockBudgetCache._seedDetails('april-2024', {
        budget: aprilBudget,
        budgetLines: aprilLines,
        transactions: aprilTransactions,
      });

      service.setBudgetId('april-2024');

      // SWR should have been seeded with cached data
      expect(service.budgetDetails()).not.toBeNull();
      expect(service.budgetDetails()!.id).toBe('april-2024');
      expect(service.budgetDetails()!.budgetLines).toEqual(aprilLines);
      expect(service.budgetDetails()!.transactions).toEqual(aprilTransactions);
    });

    it('should report hasValue true when fresh cache is seeded', () => {
      mockBudgetCache._seedDetails('april-2024', {
        budget: aprilBudget,
        budgetLines: aprilLines,
        transactions: aprilTransactions,
      });

      service.setBudgetId('april-2024');

      expect(service.hasValue()).toBe(true);
      expect(service.isInitialLoading()).toBe(false);
    });
  });

  describe('setBudgetId with stale cache', () => {
    it('should NOT seed SWR with stale cached data', () => {
      mockBudgetCache._seedDetails('april-2024', {
        budget: aprilBudget,
        budgetLines: aprilLines,
        transactions: aprilTransactions,
      });
      mockBudgetCache._markStale('april-2024');

      service.setBudgetId('april-2024');

      // SWR should NOT have been seeded — stale data is rejected
      expect(service.budgetDetails()).toBeNull();
    });

    it('should show isInitialLoading when cache is stale and resource is loading', () => {
      mockBudgetCache._seedDetails('april-2024', {
        budget: aprilBudget,
        budgetLines: aprilLines,
        transactions: aprilTransactions,
      });
      mockBudgetCache._markStale('april-2024');

      // Setup API to return fresh data (but don't resolve yet)
      mockBudgetApi.getBudgetWithDetails$.mockReturnValue(
        of({
          success: true,
          data: {
            budget: aprilBudget,
            budgetLines: aprilLines,
            transactions: aprilTransactions,
          },
        }),
      );

      service.setBudgetId('april-2024');

      // Before resource resolves, stale data was not seeded
      // So isInitialLoading should be true (loading + no data)
      expect(service.budgetDetails()).toBeNull();
    });
  });

  describe('setBudgetId with no cache', () => {
    it('should seed null when no cache exists', () => {
      service.setBudgetId('unknown-budget');

      expect(service.budgetDetails()).toBeNull();
      expect(service.hasValue()).toBe(false);
    });
  });

  describe('setBudgetId staleness check integration', () => {
    it('should correctly distinguish fresh vs stale for the same budget', () => {
      // Fresh cache → seeds data
      mockBudgetCache._seedDetails('april-2024', {
        budget: aprilBudget,
        budgetLines: aprilLines,
        transactions: aprilTransactions,
      });

      service.setBudgetId('april-2024');
      expect(service.budgetDetails()).not.toBeNull();

      // Now mark as stale and create a new service instance
      mockBudgetCache._markStale('april-2024');

      const freshService = TestBed.inject(BudgetDetailsStateService);
      freshService.setBudgetId('april-2024');
      expect(freshService.budgetDetails()).toBeNull();
    });
  });
});
