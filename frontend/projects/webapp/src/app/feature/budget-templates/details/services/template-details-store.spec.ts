import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import type { SavingsGoal } from 'pulpe-shared';
import { TemplateDetailsStore } from './template-details-store';
import { type BudgetTemplateDetailViewModel } from './template-details-store';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { createMockDataCache } from '@core/testing';

const mockCache = createMockDataCache();
const mockSavingsGoalCache = createMockDataCache();

describe('TemplateDetailsStore', () => {
  let store: TemplateDetailsStore;
  let mockApi: Partial<BudgetTemplatesApi>;
  let mockSavingsGoalApi: Partial<SavingsGoalApi>;

  const mockTemplate = {
    id: 'template-1',
    name: 'Template 1',
    description: 'Test template',
    isDefault: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockTransactions = [
    {
      id: 'line-1',
      templateId: 'template-1',
      savingsGoalId: null,
      name: 'Salary',
      amount: 3000,
      kind: 'income' as const,
      recurrence: 'fixed' as const,
      description: '',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ];

  const mockDetailViewModel: BudgetTemplateDetailViewModel = {
    template: mockTemplate,
    transactions: mockTransactions,
  };

  const mockGoals: SavingsGoal[] = [
    {
      id: 'goal-1',
      userId: 'user-1',
      name: 'Vacances',
      startDate: null,
      targetAmount: 3000,
      targetDate: '2027-08-01',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as SavingsGoal,
  ];

  beforeEach(() => {
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
    mockCache.invalidate.mockClear();
    mockSavingsGoalCache.get.mockReturnValue(null);
    mockSavingsGoalCache.set.mockClear();
    mockSavingsGoalCache.invalidate.mockClear();
    mockSavingsGoalCache._dataVersion.set(0);

    mockApi = {
      getById$: vi
        .fn()
        .mockReturnValue(of({ data: mockTemplate, success: true })),
      getTemplateTransactions$: vi
        .fn()
        .mockReturnValue(of({ data: mockTransactions, success: true })),
      cache: mockCache as unknown as BudgetTemplatesApi['cache'],
    };
    mockSavingsGoalApi = {
      getAll$: vi.fn().mockReturnValue(
        of({
          data: mockGoals,
          success: true,
        }),
      ),
      cache: mockSavingsGoalCache as unknown as SavingsGoalApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateDetailsStore,
        { provide: BudgetTemplatesApi, useValue: mockApi },
        { provide: SavingsGoalApi, useValue: mockSavingsGoalApi },
      ],
    });

    store = TestBed.inject(TemplateDetailsStore);
  });

  describe('initializeTemplateId', () => {
    it('should trigger resource loading when template ID is set', async () => {
      store.initializeTemplateId('template-1');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockApi.getById$).toHaveBeenCalledWith('template-1');
      expect(mockApi.getTemplateTransactions$).toHaveBeenCalledWith(
        'template-1',
      );
    });
  });

  describe('reloadTemplateDetails', () => {
    it('should call reload on the resource', async () => {
      store.initializeTemplateId('template-1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      (mockApi.getById$ as ReturnType<typeof vi.fn>).mockClear();
      store.reloadTemplateDetails();
    });
  });

  describe('templateDetails', () => {
    it('should return null when no data is loaded', () => {
      expect(store.templateDetails()).toBeNull();
    });

    it('should return detail view model after loading', async () => {
      store.initializeTemplateId('template-1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.templateDetails()).toEqual(mockDetailViewModel);
    });
  });

  describe('isLoading', () => {
    it('should delegate to resource isInitialLoading', () => {
      expect(store.isLoading()).toBe(false);
    });
  });

  describe('hasValue', () => {
    it('should return false when no data loaded', () => {
      expect(store.hasValue()).toBe(false);
    });

    it('should return true after data is loaded', async () => {
      store.initializeTemplateId('template-1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.hasValue()).toBe(true);
    });
  });

  describe('template', () => {
    it('should return null when no details loaded', () => {
      expect(store.template()).toBeNull();
    });

    it('should extract template from templateDetails', async () => {
      store.initializeTemplateId('template-1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.template()).toEqual(mockTemplate);
    });
  });

  describe('templateLines', () => {
    it('should return empty array when no details loaded', () => {
      expect(store.templateLines()).toEqual([]);
    });

    it('should extract transactions from templateDetails', async () => {
      store.initializeTemplateId('template-1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(store.templateLines()).toEqual(mockTransactions);
    });
  });

  describe('savingsGoalNameById', () => {
    it('loads the shared list once on a cold cache and maps names by id', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSavingsGoalApi.getAll$).toHaveBeenCalledOnce();
      expect(store.savingsGoalNameById()).toEqual(
        new Map([['goal-1', 'Vacances']]),
      );
      expect(mockSavingsGoalCache.get).toHaveBeenCalledWith(
        ['savings-goals', 'list'],
        undefined,
      );
    });

    it('does not request goals again when the shared cache is warm', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      (mockSavingsGoalApi.getAll$ as ReturnType<typeof vi.fn>).mockClear();
      mockSavingsGoalCache.get.mockReturnValue({
        data: mockGoals,
        fresh: true,
      });

      const warmStore = TestBed.runInInjectionContext(
        () => new TemplateDetailsStore(),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSavingsGoalApi.getAll$).not.toHaveBeenCalled();
      expect(warmStore.savingsGoalNameById().get('goal-1')).toBe('Vacances');
    });

    it('reacts to a cached rename without an extra request', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockSavingsGoalApi.getAll$).toHaveBeenCalledOnce();
      mockSavingsGoalCache.get.mockReturnValue({
        data: [{ ...mockGoals[0], name: 'Voyage au Japon' }],
        fresh: true,
      });

      mockSavingsGoalCache._dataVersion.update((version) => version + 1);
      await Promise.resolve();

      expect(store.savingsGoalNameById().get('goal-1')).toBe('Voyage au Japon');
      expect(mockSavingsGoalApi.getAll$).toHaveBeenCalledOnce();
    });
  });
});
