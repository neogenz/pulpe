import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, switchMap } from 'rxjs';
import { type TemplateLine } from 'pulpe-shared';
import { TemplateStore } from './template-store';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';

const mockCache = {
  get: vi.fn().mockReturnValue(undefined),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  clearDirty: vi.fn(),
  version: signal(0),
};

const mockBudgetCache = {
  get: vi.fn().mockReturnValue(undefined),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  clearDirty: vi.fn(),
  version: signal(0),
};

describe('TemplateStore', () => {
  let store: TemplateStore;
  let budgetApiMock: Partial<BudgetApi>;
  let budgetTemplatesApiMock: Partial<BudgetTemplatesApi>;

  const mockTemplates = [
    {
      id: 'template1',
      userId: 'user1',
      name: 'Standard Month',
      description: 'Default template',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'template2',
      userId: 'user1',
      name: 'Vacation Month',
      description: 'Template for vacation',
      isDefault: false,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  const mockTemplateLines: TemplateLine[] = [
    {
      id: 'line1',
      templateId: 'template1',
      kind: 'income',
      name: 'Salary',
      description: 'Monthly salary',
      amount: 5000,
      recurrence: 'fixed',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'line2',
      templateId: 'template1',
      kind: 'expense',
      name: 'Rent',
      description: 'Monthly rent',
      amount: 1500,
      recurrence: 'fixed',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    mockCache.get.mockReturnValue(undefined);
    mockCache.set.mockClear();
    mockBudgetCache.invalidate.mockClear();

    budgetApiMock = {
      createBudget$: vi.fn().mockReturnValue(
        of({
          budget: { id: 'new-budget', month: 3, year: 2026 },
          message: 'Budget créé',
        }),
      ),
      cache: mockBudgetCache as unknown as BudgetApi['cache'],
    };

    budgetTemplatesApiMock = {
      getAll$: vi
        .fn()
        .mockReturnValue(of({ data: mockTemplates, success: true })),
      getTemplateTransactions$: vi
        .fn()
        .mockReturnValue(of({ data: mockTemplateLines, success: true })),
      cache: mockCache as unknown as BudgetTemplatesApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TemplateStore,
        { provide: BudgetApi, useValue: budgetApiMock },
        { provide: BudgetTemplatesApi, useValue: budgetTemplatesApiMock },
      ],
    });

    store = TestBed.inject(TemplateStore);
  });

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  describe('template selection', () => {
    it('should select a template', () => {
      store.selectTemplate('template1');
      expect(store.selectedTemplateId()).toBe('template1');
    });

    it('should clear selection', () => {
      store.selectTemplate('template1');
      store.clearSelection();
      expect(store.selectedTemplateId()).toBeNull();
    });

    it('should initialize default selection with default template', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      store.initializeDefaultSelection();
      expect(store.selectedTemplateId()).toBe('template1');
    });

    it('should initialize selection with newest template if no default', async () => {
      const templatesWithoutDefault = mockTemplates.map((t) => ({
        ...t,
        isDefault: false,
      }));
      budgetTemplatesApiMock.getAll$ = vi
        .fn()
        .mockReturnValue(of({ data: templatesWithoutDefault, success: true }));

      store = TestBed.inject(TemplateStore);

      await new Promise((resolve) => setTimeout(resolve, 100));

      store.initializeDefaultSelection();
      expect(store.selectedTemplateId()).toBe('template2');
    });

    it('should not change selection if already selected', () => {
      store.selectTemplate('template2');
      store.initializeDefaultSelection();
      expect(store.selectedTemplateId()).toBe('template2');
    });
  });

  describe('template lines loading', () => {
    it('should load and cache template lines', async () => {
      const lines = await store.loadTemplateLines('template1');

      expect(lines).toEqual(mockTemplateLines);
      expect(
        budgetTemplatesApiMock.getTemplateTransactions$,
      ).toHaveBeenCalledWith('template1');
      expect(mockCache.set).toHaveBeenCalledWith(
        ['templates', 'lines', 'template1'],
        mockTemplateLines,
      );
    });

    it('should return cached lines without API call', async () => {
      mockCache.get.mockReturnValue({ data: mockTemplateLines });

      const lines = await store.loadTemplateLines('template1');

      expect(lines).toEqual(mockTemplateLines);
      expect(
        budgetTemplatesApiMock.getTemplateTransactions$,
      ).not.toHaveBeenCalled();
    });
  });

  describe('template totals loading', () => {
    it('should load totals for multiple templates', async () => {
      await store.loadTemplateTotals(['template1', 'template2']);

      expect(
        budgetTemplatesApiMock.getTemplateTransactions$,
      ).toHaveBeenCalledTimes(2);
      expect(store.templateTotalsMap()['template1']).toBeDefined();
      expect(store.templateTotalsMap()['template2']).toBeDefined();
    });

    it('should skip already loaded templates', async () => {
      await store.loadTemplateTotals(['template1']);
      vi.clearAllMocks();
      mockCache.get.mockReturnValue(undefined);

      await store.loadTemplateTotals(['template1', 'template2']);

      expect(
        budgetTemplatesApiMock.getTemplateTransactions$,
      ).toHaveBeenCalledTimes(1);
      expect(
        budgetTemplatesApiMock.getTemplateTransactions$,
      ).toHaveBeenCalledWith('template2');
    });
  });

  describe('budget creation', () => {
    it('should create a budget and invalidate budget cache', async () => {
      const budgetData = {
        month: 3,
        year: 2026,
        description: 'Test',
        templateId: 'template1',
      };

      const result = await store.createBudget(budgetData);

      expect(result).toBeDefined();
      expect(budgetApiMock.createBudget$).toHaveBeenCalledWith(budgetData);
      expect(mockBudgetCache.invalidate).toHaveBeenCalledWith(['budget']);
    });

    it('should return undefined on error', async () => {
      budgetApiMock.createBudget$ = vi.fn().mockReturnValue(
        of(null).pipe(
          switchMap(() => {
            throw new Error('API error');
          }),
        ),
      );

      const result = await store.createBudget({
        month: 3,
        year: 2026,
        description: '',
        templateId: 'template1',
      });

      expect(result).toBeUndefined();
      expect(store.createBudgetError()).toBeDefined();
    });
  });

  describe('computed values', () => {
    it('should compute selected template', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      store.selectTemplate('template1');
      const selected = store.selectedTemplate();

      expect(selected).toEqual(mockTemplates[0]);
    });

    it('should return null when no template selected', () => {
      const selected = store.selectedTemplate();
      expect(selected).toBeNull();
    });

    it('should compute sorted templates with default first', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const sorted = store.sortedTemplates();

      expect(sorted[0].isDefault).toBe(true);
      expect(sorted[0].id).toBe('template1');
    });
  });
});
