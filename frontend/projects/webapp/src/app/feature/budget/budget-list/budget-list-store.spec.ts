import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { type Budget } from 'pulpe-shared';
import { BudgetListStore } from './budget-list-store';
import { BudgetApi } from '@core/budget/budget-api';
import { Logger } from '@core/logging/logger';

describe('BudgetListStore', () => {
  let store: BudgetListStore;
  let budgetApiMock: Partial<BudgetApi>;
  let loggerMock: Partial<Logger>;

  beforeEach(() => {
    budgetApiMock = {
      getAllBudgets$: vi.fn().mockReturnValue(of([])),
    };

    loggerMock = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        BudgetListStore,
        { provide: BudgetApi, useValue: budgetApiMock },
        { provide: Logger, useValue: loggerMock },
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
});
