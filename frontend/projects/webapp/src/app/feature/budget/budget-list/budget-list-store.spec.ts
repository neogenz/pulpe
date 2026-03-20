import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { type Budget } from 'pulpe-shared';
import { BudgetListStore } from './budget-list-store';
import { BudgetApi } from '@core/budget/budget-api';
import { UserSettingsStore } from '@core/user-settings';
import { createMockBudget } from '@app/testing/mock-factories';

const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  clearDirty: vi.fn(),
  version: signal(0),
};

const mockUserSettingsStore = {
  payDayOfMonth: signal<number | null>(25),
};

describe('BudgetListStore', () => {
  let store: BudgetListStore;
  let budgetApiMock: Partial<BudgetApi>;

  beforeEach(() => {
    mockCache.get.mockReturnValue(null);

    budgetApiMock = {
      getAllBudgets$: vi.fn().mockReturnValue(of([])),
      exportAllBudgets$: vi.fn(),
      cache: mockCache as unknown as BudgetApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BudgetListStore,
        { provide: BudgetApi, useValue: budgetApiMock },
        { provide: UserSettingsStore, useValue: mockUserSettingsStore },
      ],
    });

    store = TestBed.inject(BudgetListStore);
  });

  describe('nextAvailableMonth', () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    it('should return current month when no budgets exist', async () => {
      budgetApiMock.getAllBudgets$ = vi.fn().mockReturnValue(of([]));

      await TestBed.runInInjectionContext(async () => {
        store.budgets.reload();

        // Wait for resource to resolve
        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = store.nextAvailableMonth();
        expect(result).toEqual({ month: currentMonth, year: currentYear });
      });
    });

    it('should return next month when current month has budget', async () => {
      const mockBudgets: Budget[] = [
        {
          id: 'budget1',
          userId: 'user1',
          month: currentMonth,
          year: currentYear,
          description: 'Current month budget',
          endingBalance: 0,
          templateId: 'template1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      budgetApiMock.getAllBudgets$ = vi.fn().mockReturnValue(of(mockBudgets));

      await TestBed.runInInjectionContext(async () => {
        store.budgets.reload();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = store.nextAvailableMonth();
        const expectedMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const expectedYear =
          currentMonth === 12 ? currentYear + 1 : currentYear;

        expect(result).toEqual({ month: expectedMonth, year: expectedYear });
      });
    });

    it('should return January of next year when all months from current to December have budgets', async () => {
      // Create budgets from current month to December
      const mockBudgets: Budget[] = [];
      for (let month = currentMonth; month <= 12; month++) {
        mockBudgets.push({
          id: `budget${month}`,
          userId: 'user1',
          month,
          year: currentYear,
          description: `Month ${month} budget`,
          endingBalance: 0,
          templateId: 'template1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });
      }

      budgetApiMock.getAllBudgets$ = vi.fn().mockReturnValue(of(mockBudgets));

      await TestBed.runInInjectionContext(async () => {
        store.budgets.reload();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = store.nextAvailableMonth();
        expect(result).toEqual({ month: 1, year: currentYear + 1 });
      });
    });

    it('should find first available month in sparse budget list', async () => {
      // Create budgets with gaps based on current month
      const mockBudgets: Budget[] = [];

      // Add current month and skip next month
      mockBudgets.push({
        id: `budget-current`,
        userId: 'user1',
        month: currentMonth,
        year: currentYear,
        description: `Current month budget`,
        endingBalance: 0,
        templateId: 'template1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      // Skip the next month (that's the gap we want to find)
      const skipMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const skipYear = currentMonth === 12 ? currentYear + 1 : currentYear;

      // Add the month after the gap
      const afterGapMonth = skipMonth === 12 ? 1 : skipMonth + 1;
      const afterGapYear = skipMonth === 12 ? skipYear + 1 : skipYear;

      mockBudgets.push({
        id: `budget-after-gap`,
        userId: 'user1',
        month: afterGapMonth,
        year: afterGapYear,
        description: `Month after gap budget`,
        endingBalance: 0,
        templateId: 'template1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      budgetApiMock.getAllBudgets$ = vi.fn().mockReturnValue(of(mockBudgets));

      await TestBed.runInInjectionContext(async () => {
        store.budgets.reload();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = store.nextAvailableMonth();

        // Should find the skipped month (gap)
        expect(result).toEqual({ month: skipMonth, year: skipYear });
      });
    });

    it('should handle multiple years of budgets', async () => {
      // Create budgets for rest of current year and first 6 months of next year
      const mockBudgets: Budget[] = [];

      // Fill rest of current year from current month
      for (let month = currentMonth; month <= 12; month++) {
        mockBudgets.push({
          id: `budget-cy-${month}`,
          userId: 'user1',
          month,
          year: currentYear,
          description: `Current year month ${month}`,
          endingBalance: 0,
          templateId: 'template1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });
      }

      // Fill first 6 months of next year
      for (let month = 1; month <= 6; month++) {
        mockBudgets.push({
          id: `budget-ny-${month}`,
          userId: 'user1',
          month,
          year: currentYear + 1,
          description: `Next year month ${month}`,
          endingBalance: 0,
          templateId: 'template1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });
      }

      budgetApiMock.getAllBudgets$ = vi.fn().mockReturnValue(of(mockBudgets));

      await TestBed.runInInjectionContext(async () => {
        store.budgets.reload();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = store.nextAvailableMonth();
        // Should return July of next year (month 7)
        expect(result).toEqual({ month: 7, year: currentYear + 1 });
      });
    });

    it('should return current month as fallback when all months are taken within search limit', async () => {
      // Create budgets for MAX_FUTURE_MONTHS_TO_SEARCH (36 months) starting from current month
      const mockBudgets: Budget[] = [];
      const MAX_FUTURE_MONTHS_TO_SEARCH = 36; // Same as in BudgetListStore

      for (let i = 0; i < MAX_FUTURE_MONTHS_TO_SEARCH; i++) {
        const totalMonths = currentYear * 12 + currentMonth - 1 + i;
        const year = Math.floor(totalMonths / 12);
        const month = (totalMonths % 12) + 1;

        mockBudgets.push({
          id: `budget-${i}`,
          userId: 'user1',
          month,
          year,
          description: `Year ${year} month ${month}`,
          endingBalance: 0,
          templateId: 'template1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });
      }

      budgetApiMock.getAllBudgets$ = vi.fn().mockReturnValue(of(mockBudgets));

      await TestBed.runInInjectionContext(async () => {
        store.budgets.reload();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result = store.nextAvailableMonth();
        // Should return current month as fallback
        expect(result).toEqual({ month: currentMonth, year: currentYear });
      });
    });
  });

  describe('plannedYears', () => {
    it('should return empty array when no budgets exist', async () => {
      await vi.waitFor(() => {
        expect(store.plannedYears()).toEqual([]);
      });
    });

    it('should return sorted unique years from budgets', async () => {
      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([
            createMockBudget({ year: 2026, month: 3, id: 'b1' }),
            createMockBudget({ year: 2025, month: 1, id: 'b2' }),
            createMockBudget({ year: 2026, month: 7, id: 'b3' }),
            createMockBudget({ year: 2024, month: 12, id: 'b4' }),
          ]),
        );
      store.budgets.reload();

      await vi.waitFor(() => {
        expect(store.plannedYears()).toEqual([2024, 2025, 2026]);
      });
    });
  });

  describe('plannedBudgetsGroupedByYears', () => {
    it('should group budgets by year with months sorted descending', async () => {
      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([
            createMockBudget({ year: 2025, month: 1, id: 'b1' }),
            createMockBudget({ year: 2025, month: 6, id: 'b2' }),
            createMockBudget({ year: 2025, month: 3, id: 'b3' }),
          ]),
        );
      store.budgets.reload();

      await vi.waitFor(() => {
        const grouped = store.plannedBudgetsGroupedByYears();
        const months = grouped.get(2025)!.map((b) => b.month);
        expect(months).toEqual([6, 3, 1]);
      });
    });

    it('should separate budgets into their respective years', async () => {
      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([
            createMockBudget({ year: 2025, month: 3, id: 'b1' }),
            createMockBudget({ year: 2026, month: 1, id: 'b2' }),
          ]),
        );
      store.budgets.reload();

      await vi.waitFor(() => {
        const grouped = store.plannedBudgetsGroupedByYears();
        expect(grouped.has(2025)).toBe(true);
        expect(grouped.has(2026)).toBe(true);
        expect(grouped.get(2025)!).toHaveLength(1);
        expect(grouped.get(2026)!).toHaveLength(1);
      });
    });
  });

  describe('allMonthsGroupedByYears', () => {
    it('should fill all 12 months per year with placeholders for missing months', async () => {
      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([
            createMockBudget({ year: 2025, month: 3, id: 'b1' }),
            createMockBudget({ year: 2025, month: 7, id: 'b2' }),
          ]),
        );
      store.budgets.reload();

      await vi.waitFor(() => {
        const grouped = store.allMonthsGroupedByYears();
        const year2025 = grouped.get(2025)!;
        expect(year2025).toHaveLength(12);
        // Month 3 (index 2) should be a Budget (has 'id')
        expect('id' in year2025[2]).toBe(true);
        // Month 7 (index 6) should be a Budget
        expect('id' in year2025[6]).toBe(true);
        // Month 1 (index 0) should be a placeholder
        expect('id' in year2025[0]).toBe(false);
        expect(year2025[0]).toEqual({ month: 1, year: 2025 });
      });
    });
  });

  describe('selectedYear', () => {
    const thisYear = new Date().getFullYear();

    it('should default to current year when it exists in planned years', async () => {
      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([
            createMockBudget({ year: thisYear, month: 1, id: 'b1' }),
            createMockBudget({ year: thisYear - 1, month: 6, id: 'b2' }),
          ]),
        );
      store.budgets.reload();

      await vi.waitFor(() => {
        expect(store.selectedYear()).toBe(thisYear);
      });
    });

    it('should fall back to first year when current year is not planned', async () => {
      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([
            createMockBudget({ year: 2020, month: 1, id: 'b1' }),
            createMockBudget({ year: 2021, month: 6, id: 'b2' }),
          ]),
        );
      store.budgets.reload();

      await vi.waitFor(() => {
        expect(store.selectedYear()).toBe(2020);
      });
    });

    it('should be null when no budgets exist', async () => {
      await vi.waitFor(() => {
        expect(store.selectedYear()).toBeNull();
      });
    });
  });

  describe('setSelectedYear', () => {
    it('should update the selected year', async () => {
      const thisYear = new Date().getFullYear();
      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([
            createMockBudget({ year: thisYear, month: 1, id: 'b1' }),
            createMockBudget({ year: thisYear - 1, month: 6, id: 'b2' }),
          ]),
        );
      store.budgets.reload();

      await vi.waitFor(() => {
        expect(store.selectedYear()).toBe(thisYear);
      });

      store.setSelectedYear(thisYear - 1);
      expect(store.selectedYear()).toBe(thisYear - 1);
    });
  });

  describe('refreshData', () => {
    it('should refresh budget data from API', async () => {
      await vi.waitFor(() => {
        expect(store.budgets.value()).toEqual([]);
      });

      budgetApiMock.getAllBudgets$ = vi
        .fn()
        .mockReturnValue(
          of([createMockBudget({ year: 2025, month: 1, id: 'b1' })]),
        );

      store.refreshData();

      await vi.waitFor(() => {
        expect(store.budgets.value()).toHaveLength(1);
      });
    });
  });

  describe('exportAllBudgets', () => {
    it('should delegate to BudgetApi and return export data', async () => {
      const mockExport = { data: [], success: true as const };
      budgetApiMock.exportAllBudgets$ = vi.fn().mockReturnValue(of(mockExport));

      const result = await store.exportAllBudgets();

      expect(result).toEqual(mockExport);
      expect(budgetApiMock.exportAllBudgets$).toHaveBeenCalled();
    });
  });
});
