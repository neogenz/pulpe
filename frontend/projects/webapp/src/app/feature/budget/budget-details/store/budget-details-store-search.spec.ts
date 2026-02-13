import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { BudgetDetailsStore } from './budget-details-store';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import { TransactionApi } from '@core/transaction/transaction-api';
import { Logger } from '@core/logging/logger';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { PostHogService } from '@core/analytics/posthog';
import {
  createMockBudgetLine,
  createMockBudgetDetailsResponse,
  createMockTransaction,
} from '../../../../testing/mock-factories';

const mockBudgetId = 'budget-search-test';

const mockBudgetDetailsResponse = createMockBudgetDetailsResponse({
  budget: { id: mockBudgetId },
  budgetLines: [
    createMockBudgetLine({
      id: 'line-loyer',
      budgetId: mockBudgetId,
      name: 'Loyer',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
      checkedAt: null,
    }),
    createMockBudgetLine({
      id: 'line-salaire',
      budgetId: mockBudgetId,
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
      checkedAt: null,
    }),
    createMockBudgetLine({
      id: 'line-courses',
      budgetId: mockBudgetId,
      name: 'Courses alimentaires',
      amount: 400,
      kind: 'expense',
      recurrence: 'fixed',
      checkedAt: null,
    }),
    createMockBudgetLine({
      id: 'line-epargne',
      budgetId: mockBudgetId,
      name: 'Épargne mensuelle',
      amount: 1500,
      kind: 'saving',
      recurrence: 'fixed',
      checkedAt: '2024-01-15T10:00:00Z',
    }),
  ],
  transactions: [
    createMockTransaction({
      id: 'tx-allocated',
      budgetId: mockBudgetId,
      budgetLineId: 'line-loyer',
      name: 'Virement propriétaire',
      amount: 1500,
      kind: 'expense',
    }),
    createMockTransaction({
      id: 'tx-allocated-courses',
      budgetId: mockBudgetId,
      budgetLineId: 'line-courses',
      name: 'Migros',
      amount: 87,
      kind: 'expense',
    }),
    createMockTransaction({
      id: 'tx-free',
      budgetId: mockBudgetId,
      budgetLineId: null,
      name: 'Achat imprévu',
      amount: 75,
      kind: 'expense',
      checkedAt: null,
    }),
    createMockTransaction({
      id: 'tx-free-checked',
      budgetId: mockBudgetId,
      budgetLineId: null,
      name: 'Cadeau anniversaire',
      amount: 150,
      kind: 'expense',
      checkedAt: '2024-01-15T10:00:00Z',
    }),
  ],
});

describe('BudgetDetailsStore - Search Filtering', () => {
  let store: BudgetDetailsStore;
  let httpMock: HttpTestingController;

  const waitForResourceStable = async (timeout = 1000): Promise<void> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (!store.isLoading()) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (!store.isLoading()) return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Resource did not stabilize within ${timeout}ms`);
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        BudgetDetailsStore,
        {
          provide: BudgetApi,
          useValue: {
            getBudgetWithDetails$: vi
              .fn()
              .mockReturnValue(of(mockBudgetDetailsResponse)),
            getAllBudgets$: vi.fn().mockReturnValue(of([])),
            cache: {
              get: vi.fn().mockReturnValue(null),
              set: vi.fn(),
              has: vi.fn().mockReturnValue(false),
              invalidate: vi.fn(),
              deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) =>
                fn(),
              ),
              clear: vi.fn(),
            },
          },
        },
        {
          provide: BudgetLineApi,
          useValue: {
            createBudgetLine$: vi.fn(),
            updateBudgetLine$: vi.fn(),
            deleteBudgetLine$: vi.fn(),
            toggleCheck$: vi.fn(),
          },
        },
        {
          provide: TransactionApi,
          useValue: {
            create$: vi.fn(),
            remove$: vi.fn(),
          },
        },
        { provide: Logger, useValue: { error: vi.fn() } },
        {
          provide: ApplicationConfiguration,
          useValue: {
            backendApiUrl: vi
              .fn()
              .mockReturnValue('http://localhost:3000/api/v1'),
          },
        },
        {
          provide: PostHogService,
          useValue: {
            captureException: vi.fn(),
            isInitialized: vi.fn(() => ({ value: true })),
            isEnabled: vi.fn(() => ({ value: true })),
          },
        },
      ],
    });

    store = TestBed.inject(BudgetDetailsStore);
    httpMock = TestBed.inject(HttpTestingController);

    store.setBudgetId(mockBudgetId);
    TestBed.tick();
    await waitForResourceStable();

    // Disable unchecked filter so search tests run in isolation
    store.setIsShowingOnlyUnchecked(false);
  });

  afterEach(() => {
    httpMock?.verify();
  });

  describe('CA2: Real-time filtering on search text', () => {
    it('filters budget lines when user types search text', () => {
      expect(store.filteredBudgetLines().length).toBe(4);

      store.setSearchText('Loyer');

      expect(store.filteredBudgetLines().length).toBe(1);
      expect(store.filteredBudgetLines()[0].name).toBe('Loyer');
    });

    it('updates results immediately when search text changes', () => {
      store.setSearchText('Loyer');
      expect(store.filteredBudgetLines().length).toBe(1);

      store.setSearchText('Salaire');
      expect(store.filteredBudgetLines().length).toBe(1);
      expect(store.filteredBudgetLines()[0].name).toBe('Salaire');
    });
  });

  describe('CA3: Partial and case-insensitive name matching', () => {
    it('matches partial name — "loy" finds "Loyer"', () => {
      store.setSearchText('loy');

      expect(store.filteredBudgetLines().length).toBe(1);
      expect(store.filteredBudgetLines()[0].name).toBe('Loyer');
    });

    it('matches case-insensitively — "SALAIRE" finds "Salaire"', () => {
      store.setSearchText('SALAIRE');

      expect(store.filteredBudgetLines().length).toBe(1);
      expect(store.filteredBudgetLines()[0].name).toBe('Salaire');
    });

    it('matches partial case-insensitive — "cours" finds "Courses alimentaires"', () => {
      store.setSearchText('cours');

      expect(store.filteredBudgetLines().length).toBe(1);
      expect(store.filteredBudgetLines()[0].name).toBe('Courses alimentaires');
    });
  });

  describe('CA4: Amount matching as string', () => {
    it('matches exact amount — "400" finds line with amount 400', () => {
      store.setSearchText('400');

      const names = store.filteredBudgetLines().map((l) => l.name);
      expect(names).toContain('Courses alimentaires');
    });

    it('matches partial amount — "150" finds lines with 1500 and 150', () => {
      store.setSearchText('150');

      const results = store.filteredBudgetLines();
      const amounts = results.map((l) => l.amount);
      expect(amounts).toContain(1500);
    });

    it('matches on name OR amount — a line appears if either matches', () => {
      store.setSearchText('5000');

      expect(store.filteredBudgetLines().length).toBe(1);
      expect(store.filteredBudgetLines()[0].name).toBe('Salaire');
    });
  });

  describe('CA6: Empty results when nothing matches', () => {
    it('returns empty list when search matches no budget lines', () => {
      store.setSearchText('zzzznotfound');

      expect(store.filteredBudgetLines()).toHaveLength(0);
    });

    it('returns empty transactions when no budget lines match (allocated follow parent)', () => {
      store.setSearchText('zzzznotfound');

      expect(store.filteredTransactions()).toHaveLength(0);
    });
  });

  describe('CA7: Clearing search restores all results', () => {
    it('restores all budget lines when search text is cleared', () => {
      store.setSearchText('Loyer');
      expect(store.filteredBudgetLines().length).toBe(1);

      store.setSearchText('');
      expect(store.filteredBudgetLines().length).toBe(4);
    });

    it('restores all transactions when search text is cleared', () => {
      store.setSearchText('zzzznotfound');
      expect(store.filteredTransactions()).toHaveLength(0);

      store.setSearchText('');
      expect(store.filteredTransactions().length).toBe(4);
    });
  });

  describe('Search + checked filter interaction', () => {
    it('applies both checked and search filters together', () => {
      store.setIsShowingOnlyUnchecked(true);
      store.setSearchText('150');

      const results = store.filteredBudgetLines();
      // "Épargne mensuelle" (1500, checked) should be excluded by unchecked filter
      // "Loyer" (1500, unchecked) should match
      expect(results.every((l) => l.checkedAt === null)).toBe(true);
      expect(results.map((l) => l.name)).toContain('Loyer');
      expect(results.map((l) => l.name)).not.toContain('Épargne mensuelle');
    });
  });

  describe('Transactions follow parent budget line visibility', () => {
    it('allocated transaction is visible when parent budget line matches search', () => {
      store.setSearchText('Loyer');

      const transactions = store.filteredTransactions();
      const allocatedTx = transactions.find((tx) => tx.id === 'tx-allocated');
      expect(allocatedTx).toBeDefined();
    });

    it('allocated transaction is hidden when parent budget line does not match search', () => {
      store.setSearchText('Salaire');

      const transactions = store.filteredTransactions();
      const allocatedTx = transactions.find((tx) => tx.id === 'tx-allocated');
      expect(allocatedTx).toBeUndefined();
    });

    it('allocated transaction name matches → parent budget line is visible', () => {
      store.setSearchText('Virement');

      const lines = store.filteredBudgetLines();
      expect(lines.map((l) => l.name)).toContain('Loyer');
    });

    it('allocated transaction amount matches → parent budget line is visible', () => {
      store.setSearchText('87');

      const lines = store.filteredBudgetLines();
      expect(lines.map((l) => l.name)).toContain('Courses alimentaires');
    });

    it('free transactions are filtered by their own name and amount', () => {
      store.setSearchText('imprévu');

      const transactions = store.filteredTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].name).toBe('Achat imprévu');
    });
  });

  describe('Accent-insensitive search', () => {
    it('matches budget line without accents — "epargne" finds "Épargne mensuelle"', () => {
      store.setSearchText('epargne');

      const names = store.filteredBudgetLines().map((l) => l.name);
      expect(names).toContain('Épargne mensuelle');
    });

    it('matches allocated transaction without accents — "proprietaire" surfaces parent line', () => {
      store.setSearchText('proprietaire');

      const lines = store.filteredBudgetLines();
      expect(lines.map((l) => l.name)).toContain('Loyer');
    });

    it('matches free transaction without accents — "imprevu" finds "Achat imprévu"', () => {
      store.setSearchText('imprevu');

      const transactions = store.filteredTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].name).toBe('Achat imprévu');
    });
  });
});
