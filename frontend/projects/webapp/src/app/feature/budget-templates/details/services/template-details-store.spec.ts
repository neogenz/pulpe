import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of } from 'rxjs';
import { TemplateDetailsStore } from './template-details-store';
import {
  BudgetTemplatesApi,
  type BudgetTemplateDetailViewModel,
} from '@core/budget-template/budget-templates-api';

const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  version: signal(0),
};

describe('TemplateDetailsStore', () => {
  let store: TemplateDetailsStore;
  let mockApi: Partial<BudgetTemplatesApi>;

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

  beforeEach(() => {
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
    mockCache.invalidate.mockClear();

    mockApi = {
      getDetail$: vi.fn().mockReturnValue(of(mockDetailViewModel)),
      cache: mockCache as unknown as BudgetTemplatesApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateDetailsStore,
        { provide: BudgetTemplatesApi, useValue: mockApi },
      ],
    });

    store = TestBed.inject(TemplateDetailsStore);
  });

  describe('initializeTemplateId', () => {
    it('should trigger resource loading when template ID is set', async () => {
      store.initializeTemplateId('template-1');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockApi.getDetail$).toHaveBeenCalledWith('template-1');
    });
  });

  describe('reloadTemplateDetails', () => {
    it('should call reload on the resource', async () => {
      store.initializeTemplateId('template-1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      (mockApi.getDetail$ as ReturnType<typeof vi.fn>).mockClear();
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
});
